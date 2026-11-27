import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { AppKitProvider } from "@reown/appkit/react";
import { wagmiAdapter, appkitConfig } from "./config/appkit";
import { RewardsDashboard } from "./components/RewardsDashboard";

const queryClient = new QueryClient();

export default function App() {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AppKitProvider {...appkitConfig}>
          <RewardsDashboard />
        </AppKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
