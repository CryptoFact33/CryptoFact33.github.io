import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { SUPPORTED_NETWORKS } from "./networks";

const PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID ?? "PLACEHOLDER_PROJECT_ID";

export const wagmiAdapter = new WagmiAdapter({
  networks: SUPPORTED_NETWORKS,
  projectId: PROJECT_ID,
});

export const appkitConfig = {
  adapters: [wagmiAdapter],
  networks: SUPPORTED_NETWORKS,
  projectId: PROJECT_ID,
  metadata: {
    name: "ENDPOOR",
    description: "Cross-Chain Settlement Pipeline",
    url: "https://cryptofact33.github.io",
    icons: ["https://cryptofact33.github.io/icon.png"],
  },
  features: {
    analytics: true,
    email: false,
    socials: false,
  },
  featuredWalletIds: [],
} as const;
