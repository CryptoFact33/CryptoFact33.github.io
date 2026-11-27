import {
  mainnet,
  arbitrum,
  base,
  optimism,
  polygon,
  bsc,
  avalanche,
} from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";

export const SUPPORTED_NETWORKS: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  arbitrum,
  base,
  optimism,
  polygon,
  bsc,
  avalanche,
];

export const NETWORK_META: Record<number, { name: string; color: string }> = {
  1: { name: "Ethereum", color: "#627EEA" },
  42161: { name: "Arbitrum", color: "#28A0F0" },
  8453: { name: "Base", color: "#0052FF" },
  10: { name: "Optimism", color: "#FF0420" },
  137: { name: "Polygon", color: "#8247E5" },
  56: { name: "BNB Chain", color: "#F0B90B" },
  43114: { name: "Avalanche", color: "#E84142" },
};
