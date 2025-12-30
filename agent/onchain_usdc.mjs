import { ethers } from "ethers";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

export async function readErc20Balance({ rpcUrl, tokenAddress, walletAddress }) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  const [symbol, decimals, bal] = await Promise.all([
    token.symbol(),
    token.decimals(),
    token.balanceOf(walletAddress)
  ]);

  return {
    symbol,
    decimals,
    raw: bal,
    human: Number(ethers.formatUnits(bal, decimals))
  };
}
