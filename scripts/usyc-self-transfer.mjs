import "dotenv/config";
import { ethers } from "ethers";

const RPC = process.env.ARC_RPC_URL;
const PK = process.env.WALLET_PRIVATE_KEY;
const USYC = process.env.USYC_ADDRESS;

if (!RPC) throw new Error("Missing ARC_RPC_URL");
if (!PK) throw new Error("Missing WALLET_PRIVATE_KEY");
if (!USYC) throw new Error("Missing USYC_ADDRESS");

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);

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

// envia o mínimo possível: 1 “unit” (10^-dec) se tiver saldo
const amount = bal > 0n ? 1n : 0n;
if (amount === 0n) {
  console.log("USYC balance is 0. Nothing to transfer.");
  process.exit(0);
}

console.log("Sending USYC self-transfer...");
const tx = await erc20.transfer(wallet.address, amount);
console.log("✅ Tx sent:", tx.hash);

const rcpt = await tx.wait();
console.log("✅ Confirmed in block:", rcpt.blockNumber);
