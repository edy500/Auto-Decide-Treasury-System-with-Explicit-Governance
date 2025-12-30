import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";

const txHash = process.argv[2];
const intentFile = process.argv[3];

if (!txHash) {
  console.log('Usage: node scripts/check-tx-input.mjs <txHash> [intent.json]');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
const tx = await provider.getTransaction(txHash);

console.log("\n=== Tx input check ===");
console.log("Tx:", txHash);
console.log("To:", tx.to);
console.log("From:", tx.from);
console.log("Data:", tx.data);

if (intentFile) {
  const obj = JSON.parse(fs.readFileSync(intentFile, "utf-8"));
  const digest = obj?.eip712?.digest;
  console.log("\nIntent digest:", digest);
  console.log("Matches:", (digest || "").toLowerCase() === (tx.data || "").toLowerCase());
}
