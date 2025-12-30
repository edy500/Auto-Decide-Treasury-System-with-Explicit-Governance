import "dotenv/config";
import { ethers } from "ethers";

const txHash = process.argv[2];
if (!txHash) {
  console.log("Usage: node scripts/check-usyc-tx.mjs <txHash>");
  process.exit(1);
}

const RPC = process.env.ARC_RPC_URL;
const USYC = (process.env.USYC_ADDRESS || "").toLowerCase();
if (!RPC) throw new Error("Missing ARC_RPC_URL");
if (!USYC) throw new Error("Missing USYC_ADDRESS");

const provider = new ethers.JsonRpcProvider(RPC);
const receipt = await provider.getTransactionReceipt(txHash);

console.log("\n=== USYC tx check ===");
console.log("Tx:", txHash);
console.log("Block:", receipt.blockNumber);

let found = false;
for (const log of receipt.logs) {
  if ((log.address || "").toLowerCase() === USYC) {
    found = true;
    console.log("\n✅ Found log from USYC contract:", log.address);
    console.log("Topics:", log.topics);
    console.log("Data:", log.data);
  }
}

if (!found) {
  console.log("\n⚠️ No log matched USYC_ADDRESS:", USYC);
  console.log("Receipt log addresses:", [...new Set(receipt.logs.map(l => l.address.toLowerCase()))]);
}
