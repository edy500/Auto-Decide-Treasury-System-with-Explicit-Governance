import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { ethers } from "ethers";

import { decideWithGemini } from "./decision_gemini.mjs";
import { readErc20Balance } from "./onchain_usdc.mjs";
import { signAllocationIntent } from "./intent_sign.mjs";






dotenv.config();
const AUTO_EXECUTE = String(process.env.AUTO_EXECUTE ?? "0") === "1";

const MIN_USDC_BUFFER = Number(process.env.MIN_USDC_BUFFER ?? 200);
const MAX_ALLOC_PCT = Number(process.env.MAX_ALLOC_PCT ?? 0.6);

const MANAGED_USDC_CAP = Number(process.env.MANAGED_USDC_CAP ?? 0);

// ---- Load data ----
const revenue = JSON.parse(fs.readFileSync("data/revenue.json", "utf-8"));
const usage = JSON.parse(fs.readFileSync("data/usage.json", "utf-8"));

// ---- Fake balances (por enquanto) ----
// Depois vamos substituir por leitura onchain
const RPC = process.env.ARC_RPC_URL;
const PK = process.env.WALLET_PRIVATE_KEY;
const USDC_ADDRESS = process.env.USDC_ADDRESS;

if (!RPC) throw new Error("Missing ARC_RPC_URL in .env");
if (!PK) throw new Error("Missing WALLET_PRIVATE_KEY in .env");
if (!USDC_ADDRESS) throw new Error("Missing USDC_ADDRESS in .env");

const wallet = new ethers.Wallet(PK);
const walletAddress = wallet.address;


const usdcBal = await readErc20Balance({
  rpcUrl: RPC,
  tokenAddress: USDC_ADDRESS,
  walletAddress
});

const realUsdc = usdcBal.human;

const managedUsdc =
  MANAGED_USDC_CAP > 0
    ? Math.min(realUsdc, MANAGED_USDC_CAP)
    : realUsdc;

const balances = {
  usdc: managedUsdc,
  usyc: 0
};

console.log("Note:", {
  real_usdc: realUsdc,
  managed_usdc: managedUsdc,
  cap: MANAGED_USDC_CAP || "none"
});





console.log("=== Autonomous Billing & Treasury Agent (Gemini) ===\n");

console.log("Balances:", balances);
console.log("Revenue:", revenue);
console.log("Usage:", usage);
console.log("Policy:", { MIN_USDC_BUFFER, MAX_ALLOC_PCT });
console.log("");

// Contexto pro Gemini
const context = {
  balances,
  revenue,
  usage,
  policy: { MIN_USDC_BUFFER, MAX_ALLOC_PCT }
};

// 1) Gemini decide
let decision;
try {
  decision = await decideWithGemini(context);
} catch (err) {
  console.error("\nGemini error:", err?.message || err);
  process.exit(1);
}

console.log("Gemini decision (raw):", decision);

// 2) Guardrails (hard safety)
let action = decision.action;
let amount = Number(decision.amount_usdc ?? 0);


// clamp básico
if (!Number.isFinite(amount) || amount < 0) amount = 0;

// projected USDC if we execute action (simulado)
const projectedUsdc =
  balances.usdc +
  Number(revenue.daily_usdc_revenue ?? 0) -
  Number(usage.estimated_daily_cost_usdc ?? 0);

// limite de alocação por % do excedente
const maxAlloc = Math.max(0, (projectedUsdc - MIN_USDC_BUFFER) * MAX_ALLOC_PCT);

if (action === "ALLOCATE") {
  amount = Math.min(amount, maxAlloc);

  const postUsdc = projectedUsdc - amount;
  if (postUsdc < MIN_USDC_BUFFER) {
    action = "HOLD";
    amount = 0;
  }
} else if (action === "DEALLOCATE") {
  // sem USYC, não tem o que desalocar
  if (balances.usyc <= 0) {
    action = "HOLD";
    amount = 0;
  }
} else {
  action = "HOLD";
  amount = 0;
}

console.log("\nFinal action after guardrails:");
console.log({
  action,
  amount_usdc: Number(amount.toFixed(2)),
  note: "(still no onchain tx executed)"
});

// --- Build & sign allocation intent (no onchain tx) ---
const chainIdHex = await fetch(RPC, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_chainId",
    params: [],
    id: 1
  })
})
  .then((r) => r.json())
  .then((j) => j.result);

const intent = {
  agent_address: walletAddress,
  chain_id: chainIdHex,
  action,
  amount_usdc: Number(amount.toFixed(2)),
  managed_usdc_cap: MANAGED_USDC_CAP || "none",
  min_usdc_buffer: MIN_USDC_BUFFER,
  max_alloc_pct: MAX_ALLOC_PCT,
  observed_balances: balances,
  observed_inputs: { revenue, usage },
  timestamp: Math.floor(Date.now() / 1000),
  nonce: Math.floor(Math.random() * 1e9)
};

const signed = await signAllocationIntent({
  rpcUrl: RPC,
  privateKey: PK,
  chainIdHex,
  intent
});

const out = {
  intent,
  eip712: {
    domain: signed.domain,
    types: signed.types,
    value: signed.value,
    digest: signed.digest,
    signature: signed.signature
  }
};

const filename = `intent-${intent.timestamp}-${intent.nonce}.json`;
const filePath = path.join("intents", filename);
fs.writeFileSync(filePath, JSON.stringify(out, null, 2), "utf-8");

console.log("\n✅ Signed intent saved:", filePath);
console.log("Intent digest:", signed.digest);

// ---- Optional auto execute: anchor + USYC proof ----
console.log("\nNext step command:");
console.log(`node scripts/execute-allocation.mjs "${filePath}"`);

if (AUTO_EXECUTE && action === "ALLOCATE" && Number(amount.toFixed(2)) > 0) {
  console.log("\nAUTO_EXECUTE=1 -> running execute-allocation now...\n");

  try {
    // Windows-friendly: keep quotes around path
    execSync(`node scripts/execute-allocation.mjs "${filePath}"`, {
      stdio: "inherit"
    });
  } catch (e) {
    console.error("\n❌ Auto execution failed:", e?.message || e);
  }
} else {
  console.log("\nAUTO_EXECUTE is off (or action not ALLOCATE). Skipping auto execution.");
}




