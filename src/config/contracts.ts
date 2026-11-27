import type { Address } from "viem";

export interface DeployedContracts {
  handler: Address;
  fragmenter: Address;
  bridge: Address;
  zkPool: Address;
  settler: Address;
  poolToken: Address;
  account: Address;
  relayer: Address;
}

const CONTRACTS_BY_CHAIN: Record<number, DeployedContracts | undefined> = {};

const ENV_CHAIN_ID = Number(
  import.meta.env.VITE_TARGET_CHAIN_ID ?? "8453",
);

if (import.meta.env.VITE_HANDLER_ADDRESS) {
  CONTRACTS_BY_CHAIN[ENV_CHAIN_ID] = {
    handler: import.meta.env.VITE_HANDLER_ADDRESS as Address,
    fragmenter: import.meta.env.VITE_FRAGMENTER_ADDRESS as Address,
    bridge: import.meta.env.VITE_BRIDGE_ADDRESS as Address,
    zkPool: import.meta.env.VITE_ZKPOOL_ADDRESS as Address,
    settler: import.meta.env.VITE_SETTLER_ADDRESS as Address,
    poolToken: import.meta.env.VITE_POOL_TOKEN as Address,
    account: import.meta.env.VITE_ACCOUNT_ADDRESS as Address,
    relayer: import.meta.env.VITE_RELAYER_ADDRESS as Address,
  };
}

export function getContracts(
  chainId: number | undefined,
): DeployedContracts | null {
  if (!chainId) return null;
  return CONTRACTS_BY_CHAIN[chainId] ?? null;
}

export function isDeployed(chainId: number | undefined): boolean {
  return getContracts(chainId) !== null;
}
