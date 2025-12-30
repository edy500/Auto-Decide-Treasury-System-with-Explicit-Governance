import "dotenv/config";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

// Usage:
// node scripts/execute-intent.mjs "intents/intent-....json"

function die(msg) {
  console.error("❌", msg);
  process.exit(1);
}

const file = process.argv[2];
if (!file) die('Missing intent file. Example: node scripts/execute-intent.mjs "intents/intent-xxx.json"');

const RPC = process.env.ARC_RPC_URL;
const PK = process.env.WALLET_PRIVATE_KEY;

if (!RPC) die("Missing ARC_RPC_URL in .env");
if (!PK) die("Missing WALLET_PRIVATE_KEY in .env");

// --- load intent artifact ---
const abs = path.resolve(file);
if (!fs.existsSync(abs)) die(`Intent file not found: ${abs}`);

const raw = JSON.parse(fs.readFileSync(abs, "utf-8"));
const intent = raw?.intent;
const eip712 = raw?.eip712;

if (!intent || !eip712) die("Invalid file: missing intent/eip712 object.");

// --- basic checks ---
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);

const agent = (intent.agent_address || "").toLowerCase();
if (!agent) die("intent.agent_address missing");

if (wallet.address.toLowerCase() !== agent) {
  die(`This private key is not the agent_address.\nWallet: ${wallet.address}\nAgent:  ${intent.agent_address}`);
}

// --- rebuild typed data and verify signature ---
const domain = eip712.domain;
const types = eip712.types;
const value = eip712.value;
const sig = eip712.signature;

const digestLocal = ethers.TypedDataEncoder.hash(domain, types, value);
const recovered = ethers.verifyTypedData(domain, types, value, sig);

const okDigest = (digestLocal.toLowerCase() === (eip712.digest || "").toLowerCase());
const okSigner = (recovered.toLowerCase() === agent);

console.log("\n=== Execute Intent (onchain anchor) ===");
console.log("Intent file:", file);
console.log("Wallet:", wallet.address);
console.log("Recovered signer:", recovered);
console.log("Digest (recomputed):", digestLocal);
console.log("Digest matches file digest:", okDigest);
console.log("Signer matches agent_address:", okSigner);

if (!okDigest || !okSigner) die("Intent verification failed. Not executing.");

// --- Onchain anchor tx: send 0 value to self with digest in calldata ---
// data = 0x + digest bytes (32 bytes)
const calldata = digestLocal; // already 0x...

// Optional: include tiny prefix (4 bytes) to identify "INTENT" (0x494e544e) + digest
// const prefix = "0x494e544e"; // 'INTN'
// const calldata = prefix + digestLocal.slice(2);

const txReq = {
  to: wallet.address,   // self
  value: 0n,
  data: calldata
};

console.log("\nSending onchain anchor tx...");
let tx;
try {
  tx = await wallet.sendTransaction(txReq);
} catch (e) {
  console.error("❌ sendTransaction failed:", e?.shortMessage || e?.message || e);
  process.exit(1);
}

console.log("✅ Tx sent:", tx.hash);
console.log("Waiting for confirmation...");

const receipt = await tx.wait();
console.log("✅ Confirmed in block:", receipt.blockNumber);

// --- persist execution record ---
const out = {
  executed_at: new Date().toISOString(),
  intent_file: file,
  tx_hash: tx.hash,
  blockNumber: receipt.blockNumber,
  chain_id: intent.chain_id,
  anchor: {
    to: txReq.to,
    value: "0",
    data: calldata
  },
  verification: {
    recovered_signer: recovered,
    digest_recomputed: digestLocal,
    digest_matches_file: okDigest,
    signer_matches_agent: okSigner
  },
  summary: {
    action: intent.action,
    amount_usdc: intent.amount_usdc,
    min_usdc_buffer: intent.min_usdc_buffer,
    managed_usdc_cap: intent.managed_usdc_cap,
    max_alloc_pct: intent.max_alloc_pct,
    timestamp: intent.timestamp,
    nonce: intent.nonce
  }
};

const dir = path.resolve("executions");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const filename = `execution-${intent.timestamp}-${intent.nonce}.json`;
const savePath = path.join(dir, filename);
fs.writeFileSync(savePath, JSON.stringify(out, null, 2), "utf-8");

console.log("✅ Execution saved:", savePath);
