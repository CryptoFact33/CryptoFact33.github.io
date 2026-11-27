import { useMemo } from "react";
import {
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
} from "@reown/appkit/react";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { SUPPORTED_NETWORKS, NETWORK_META } from "../config/networks";

export interface WalletContext {
  address: `0x${string}` | undefined;
  isConnected: boolean;
  chainId: number | undefined;
  chainName: string | undefined;
  caipNetworkId: string | undefined;
  isSupportedNetwork: boolean;
  switchNetwork: (network: AppKitNetwork) => Promise<void>;
  supportedNetworks: typeof SUPPORTED_NETWORKS;
  walletProvider: unknown;
  walletProviderType: string | undefined;
}

export function useWalletContext(): WalletContext {
  const { address, isConnected } = useAppKitAccount();
  const { chainId, caipNetworkId, switchNetwork } = useAppKitNetwork();
  const { walletProvider, walletProviderType } = useAppKitProvider("eip155");

  const numericChainId =
    typeof chainId === "number"
      ? chainId
      : typeof chainId === "string"
        ? Number(chainId)
        : undefined;

  const isSupportedNetwork = useMemo(
    () =>
      numericChainId !== undefined &&
      SUPPORTED_NETWORKS.some((n) => n.id === numericChainId),
    [numericChainId],
  );

  const chainName = numericChainId
    ? NETWORK_META[numericChainId]?.name
    : undefined;

  const eoaAddress =
    address && address.startsWith("0x")
      ? (address as `0x${string}`)
      : undefined;

  return {
    address: eoaAddress,
    isConnected,
    chainId: numericChainId,
    chainName,
    caipNetworkId,
    isSupportedNetwork,
    switchNetwork,
    supportedNetworks: SUPPORTED_NETWORKS,
    walletProvider,
    walletProviderType: walletProviderType ?? undefined,
  };
}
