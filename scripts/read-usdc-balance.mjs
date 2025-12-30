import "dotenv/config";
import { ethers } from "ethers";

const RPC = process.env.ARC_RPC_URL;
const PK = process.env.WALLET_PRIVATE_KEY;

// ⚠️ coloque aqui o address do contrato USDC na Arc testnet
const USDC_ADDRESS = process.env.USDC_ADDRESS;

if (!RPC) throw new Error("Missing ARC_RPC_URL in .env");
if (!PK) throw new Error("Missing WALLET_PRIVATE_KEY in .env");
if (!USDC_ADDRESS) throw new Error("Missing USDC_ADDRESS in .env");

// ERC20 minimal ABI
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);

const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);

const [symbol, decimals, bal] = await Promise.all([
  usdc.symbol(),
  usdc.decimals(),
  usdc.balanceOf(wallet.address)
]);

const human = ethers.formatUnits(bal, decimals);

console.log("Wallet:", wallet.address);
console.log(`${symbol} balance:`, human);
