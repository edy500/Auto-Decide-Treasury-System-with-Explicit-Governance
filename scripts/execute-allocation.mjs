import "dotenv/config";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import { execSync } from "child_process";

// Usage:
// node scripts/execute-allocation.mjs "intents/intent-....json"
const intentPath = process.argv[2];
if (!intentPath) {
  console.log('Usage: node scripts/execute-allocation.mjs "intents/intent-....json"');
  process.exit(1);
}

const RPC = process.env.ARC_RPC_URL;
const PK = process.env.WALLET_PRIVATE_KEY;
const USYC = process.env.USYC_ADDRESS;

if (!RPC) throw new Error("Missing ARC_RPC_URL");
if (!PK) throw new Error("Missing WALLET_PRIVATE_KEY");
if (!USYC) throw new Error("Missing USYC_ADDRESS");

const intentObj = JSON.parse(fs.readFileSync(intentPath, "utf-8"));
const action = intentObj?.intent?.action;
const digest = intentObj?.eip712?.digest;

console.log("\n=== Execute Allocation (anchor digest + USYC proof) ===");
console.log("Intent file:", intentPath);
console.log("Action:", action);
console.log("Digest:", digest);

if (action !== "ALLOCATE") {
  console.log("\n⚠️ Intent action is not ALLOCATE. Skipping execution.");
  process.exit(0);
}

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);

// --- 1) Anchor digest onchain (same behavior as execute-intent.mjs, but inline) ---
console.log("\n1) Sending anchor tx (calldata = digest) ...");
const anchorTx = await wallet.sendTransaction({
  to: wallet.address,
  value: 0n,
  data: digest
});

console.log("✅ Anchor tx sent:", anchorTx.hash);
const anchorRcpt = await anchorTx.wait();
console.log("✅ Anchor confirmed in block:", anchorRcpt.blockNumber);

// --- 2) USYC self-transfer minimal unit (proof-of-execution) ---
console.log("\n2) Sending USYC self-transfer (1 unit) ...");
const erc20 = new ethers.Contract(
  USYC,
  [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)"
  ],
  wallet
);

const dec = await erc20.decimals();
const bal = await erc20.balanceOf(wallet.address);

if (bal <= 0n) {
  console.log("⚠️ USYC balance is 0. Cannot self-transfer. (Anchor tx already done.)");
}

let usycTxHash = null;
let usycBlock = null;

if (bal > 0n) {
  const amount = 1n; // minimal unit
  const usycTx = await erc20.transfer(wallet.address, amount);
  console.log("✅ USYC tx sent:", usycTx.hash);
  const usycRcpt = await usycTx.wait();
  console.log("✅ USYC confirmed in block:", usycRcpt.blockNumber);

  usycTxHash = usycTx.hash;
  usycBlock = usycRcpt.blockNumber;
}

// --- 3) Save run log ---
fs.mkdirSync("runs", { recursive: true });

const run = {
  ts: Math.floor(Date.now() / 1000),
  intent_file: intentPath,
  digest,
  action,
  anchor: {
    tx: anchorTx.hash,
    block: anchorRcpt.blockNumber
  },
  usyc_proof: usycTxHash
    ? { token: USYC, tx: usycTxHash, block: usycBlock, note: "USYC self-transfer 1 unit" }
    : { token: USYC, tx: null, block: null, note: "Skipped (no USYC balance)" }
};

const outFile = path.join("runs", `run-${run.ts}.json`);
fs.writeFileSync(outFile, JSON.stringify(run, null, 2), "utf-8");

console.log("\n✅ Run saved:", outFile);
