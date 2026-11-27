import { useState, useCallback, useEffect, useRef } from "react";
import { formatUnits, formatEther, type Address } from "viem";
import { useAccount } from "wagmi";
import { ERC20_ABI } from "../abi/pipeline";
import { getEligibleTokens, NATIVE_SYMBOLS } from "../config/tokens";
import {
  MULTICHAIN_CLIENTS,
  ALL_CHAIN_IDS,
  CHAIN_NAMES,
} from "../config/multichain";

export interface ScannedToken {
  address: Address;
  symbol: string;
  decimals: number;
  balance: bigint;
  formatted: string;
  category: "stable" | "native-wrapped" | "blue-chip" | "lsd";
}

export interface ChainBalances {
  chainId: number;
  chainName: string;
  nativeSymbol: string;
  nativeBalance: bigint;
  nativeFormatted: string;
  tokens: ScannedToken[];
  hasValue: boolean;
}

export interface MultiChainState {
  chains: ChainBalances[];
  totalTokensWithBalance: number;
  scanning: boolean;
  scannedAt: number | null;
}

export function useMultiChainScan() {
  const { address } = useAccount();
  const [state, setState] = useState<MultiChainState>({
    chains: [],
    totalTokensWithBalance: 0,
    scanning: false,
    scannedAt: null,
  });
  const scanningRef = useRef(false);

  const scan = useCallback(async () => {
    if (!address || scanningRef.current) return;
    scanningRef.current = true;
    setState((s) => ({ ...s, scanning: true }));

    const results: ChainBalances[] = [];

    const settled = await Promise.allSettled(
      ALL_CHAIN_IDS.map(async (chainId) => {
        const client = MULTICHAIN_CLIENTS[chainId];
        if (!client) return null;

        const registryTokens = getEligibleTokens(chainId);
        const nativeSym = NATIVE_SYMBOLS[chainId] ?? "ETH";

        let nativeBalance = 0n;
        try {
          nativeBalance = await (client as any).getBalance({ address });
        } catch {}

        const tokens: ScannedToken[] = [];

        if (registryTokens.length > 0) {
          try {
            const balanceCalls = registryTokens.map((t) => ({
              address: t.address,
              abi: ERC20_ABI,
              functionName: "balanceOf" as const,
              args: [address] as readonly [Address],
            }));

            const multicallResults = await (client as any).multicall({
              contracts: balanceCalls,
              allowFailure: true,
            });

            for (let i = 0; i < registryTokens.length; i++) {
              const r = multicallResults[i];
              const tok = registryTokens[i];
              const bal =
                r && r.status === "success" ? (r.result as bigint) : 0n;
              tokens.push({
                address: tok.address,
                symbol: tok.symbol,
                decimals: tok.decimals,
                balance: bal,
                formatted: formatUnits(bal, tok.decimals),
                category: tok.category,
              });
            }
          } catch {
            for (const tok of registryTokens) {
              tokens.push({
                address: tok.address,
                symbol: tok.symbol,
                decimals: tok.decimals,
                balance: 0n,
                formatted: "0",
                category: tok.category,
              });
            }
          }
        }

        const hasValue =
          nativeBalance > 0n || tokens.some((t) => t.balance > 0n);

        return {
          chainId,
          chainName: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
          nativeSymbol: nativeSym,
          nativeBalance,
          nativeFormatted: formatEther(nativeBalance),
          tokens,
          hasValue,
        } satisfies ChainBalances;
      }),
    );

    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        results.push(r.value);
      }
    }

    results.sort((a, b) => {
      if (a.hasValue && !b.hasValue) return -1;
      if (!a.hasValue && b.hasValue) return 1;
      return 0;
    });

    const totalWithBalance = results.reduce(
      (acc, c) => acc + c.tokens.filter((t) => t.balance > 0n).length,
      0,
    );

    setState({
      chains: results,
      totalTokensWithBalance: totalWithBalance,
      scanning: false,
      scannedAt: Date.now(),
    });
    scanningRef.current = false;
  }, [address]);

  useEffect(() => {
    if (address) {
      scan();
    } else {
      setState({
        chains: [],
        totalTokensWithBalance: 0,
        scanning: false,
        scannedAt: null,
      });
    }
  }, [address, scan]);

  return { ...state, scan };
}
