import fs from "fs";
import { ethers } from "ethers";

const file = process.argv[2];
if (!file) {
  console.log("Usage: node scripts/verify-intent.mjs intents/intent-xxxx.json");
  process.exit(1);
}

const raw = fs.readFileSync(file, "utf-8");
const obj = JSON.parse(raw);

const { intent, eip712 } = obj;

if (!intent || !eip712?.domain || !eip712?.types || !eip712?.value || !eip712?.signature) {
  console.error("Invalid intent file format.");
  process.exit(1);
}

// Recover signer
const recovered = ethers.verifyTypedData(
  eip712.domain,
  eip712.types,
  eip712.value,
  eip712.signature
);

// Recompute digest (should match)
const digest = ethers.TypedDataEncoder.hash(
  eip712.domain,
  eip712.types,
  eip712.value
);

console.log("\n=== Intent verification ===");
console.log("File:", file);
console.log("Recovered signer:", recovered);
console.log("Intent agent_address:", intent.agent_address);
console.log("Digest matches file digest:", digest === eip712.digest);

const okSigner =
  recovered.toLowerCase() === String(intent.agent_address).toLowerCase();

console.log("Signer matches agent_address:", okSigner);

if (!okSigner) {
  console.log("\n❌ Verification FAILED");
  process.exit(2);
}

console.log("\n✅ Verification OK");
console.log("\nSummary:");
console.log({
  action: intent.action,
  amount_usdc: intent.amount_usdc,
  chain_id: intent.chain_id,
  min_usdc_buffer: intent.min_usdc_buffer,
  managed_usdc_cap: intent.managed_usdc_cap,
  max_alloc_pct: intent.max_alloc_pct,
  timestamp: intent.timestamp,
  nonce: intent.nonce
});
