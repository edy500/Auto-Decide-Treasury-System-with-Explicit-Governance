import { ethers } from "ethers";

export async function signAllocationIntent({
  rpcUrl,
  privateKey,
  chainIdHex,
  intent
}) {
  // chainId
  const chainId =
    typeof chainIdHex === "string" && chainIdHex.startsWith("0x")
      ? Number(BigInt(chainIdHex))
      : Number(chainIdHex);

  const wallet = new ethers.Wallet(privateKey);

  // EIP-712 domain + types
  const domain = {
    name: "ArcAutonomousTreasuryAgent",
    version: "1",
    chainId,
    verifyingContract: "0x0000000000000000000000000000000000000000" // offchain intent
  };

  const types = {
    AllocationIntent: [
      { name: "agent", type: "address" },
      { name: "action", type: "string" },
      { name: "amountUsdc", type: "string" },
      { name: "managedCapUsdc", type: "string" },
      { name: "minBufferUsdc", type: "string" },
      { name: "maxAllocPct", type: "string" },
      { name: "timestamp", type: "uint256" },
      { name: "nonce", type: "uint256" }
    ]
  };

  const value = {
    agent: wallet.address,
    action: intent.action,
    amountUsdc: String(intent.amount_usdc),
    managedCapUsdc: String(intent.managed_usdc_cap),
    minBufferUsdc: String(intent.min_usdc_buffer),
    maxAllocPct: String(intent.max_alloc_pct),
    timestamp: intent.timestamp,
    nonce: intent.nonce
  };

  const signature = await wallet.signTypedData(domain, types, value);
  const digest = ethers.TypedDataEncoder.hash(domain, types, value);

  return { domain, types, value, signature, digest };
}
