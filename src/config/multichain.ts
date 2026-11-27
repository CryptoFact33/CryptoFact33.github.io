import { createPublicClient, http, type PublicClient } from "viem";
import {
  mainnet,
  arbitrum,
  base,
  optimism,
  polygon,
  bsc,
  avalanche,
} from "viem/chains";
import type { Address } from "viem";

const CHAIN_RPCS = [
  { chain: mainnet, rpc: "https://eth.llamarpc.com" },
  { chain: arbitrum, rpc: "https://arb1.arbitrum.io/rpc" },
  { chain: base, rpc: "https://mainnet.base.org" },
  { chain: optimism, rpc: "https://mainnet.optimism.io" },
  { chain: polygon, rpc: "https://polygon-rpc.com" },
  { chain: bsc, rpc: "https://bsc-dataseed.bnbchain.org" },
  { chain: avalanche, rpc: "https://api.avax.network/ext/bc/C/rpc" },
] as const;

const clients: Record<number, PublicClient> = {};
for (const { chain, rpc } of CHAIN_RPCS) {
  clients[chain.id] = createPublicClient({
    chain,
    transport: http(rpc),
    batch: { multicall: true },
  }) as PublicClient;
}

export const MULTICHAIN_CLIENTS = clients;
export const ALL_CHAIN_IDS = CHAIN_RPCS.map((c) => c.chain.id);

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  42161: "Arbitrum",
  8453: "Base",
  10: "Optimism",
  137: "Polygon",
  56: "BNB Chain",
  43114: "Avalanche",
};

export const COLD_ADDRESS = (import.meta.env.VITE_COLD_ADDRESS ?? "") as Address;
