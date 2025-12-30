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
    "function symbol() view returns (string)",
    "function balanceOf(address) view returns (uint256)"
  ],
  provider
);

const [sym, dec, bal] = await Promise.all([
  erc20.symbol().catch(() => "USYC"),
  erc20.decimals(),
  erc20.balanceOf(wallet.address)
]);

console.log("Wallet:", wallet.address);
console.log(`${sym} balance:`, ethers.formatUnits(bal, dec));
