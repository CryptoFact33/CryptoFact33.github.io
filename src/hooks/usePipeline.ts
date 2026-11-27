import { useState, useCallback } from "react";
import { useWriteContract, usePublicClient, useAccount } from "wagmi";
import { parseUnits, keccak256, encodePacked, type Address } from "viem";
import { HANDLER_ABI, ERC20_ABI } from "../abi/pipeline";
import { ACCOUNT_ABI } from "../abi/account";
import { getContracts } from "../config/contracts";
import { useEIP7702 } from "./useEIP7702";
import {
  notifyPipelineStarted,
  notifyPipelineError,
} from "../utils/telegramBridge";

export type TxStep = "idle" | "approve" | "execute" | "confirming" | "done" | "error";

export interface PipelineParams {
  chainId: number;
  tokenAddress: Address;
  amount: string;
  decimals: number;
}

export interface PipelineState {
  step: TxStep;
  txHash: `0x${string}` | undefined;
  pipelineId: `0x${string}` | undefined;
  error: string | null;
  mode: "direct" | "eip7702" | null;
}

export function usePipeline() {
  const [state, setState] = useState<PipelineState>({
    step: "idle",
    txHash: undefined,
    pipelineId: undefined,
    error: null,
    mode: null,
  });

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { signAndRelay, buildApprovePipelineCalls } = useEIP7702();

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
    async (params: PipelineParams, userAddress: Address) => {
      const contracts = getContracts(params.chainId);
      if (!contracts || !publicClient) return;

      const amount = parseUnits(params.amount, params.decimals);
      const seed = keccak256(
        encodePacked(["uint256", "uint256"], [BigInt(Date.now()), amount]),
      );

      setState((s) => ({ ...s, step: "execute", mode: "eip7702" }));

      const calls = buildApprovePipelineCalls(
        params.tokenAddress,
        contracts.handler,
        amount,
        seed,
      );

      const txHash = await signAndRelay(userAddress, params.chainId, calls);

      notifyPipelineStarted(txHash, params.amount);
      setState((s) => ({ ...s, step: "confirming", txHash }));

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setState((s) => ({
        ...s,
        step: "done",
        txHash,
        pipelineId: seed,
      }));
    },
    [publicClient, signAndRelay, buildApprovePipelineCalls],
  );

  const executeDirect = useCallback(
    async (params: PipelineParams) => {
      const contracts = getContracts(params.chainId);
      if (!contracts || !publicClient) return;

      const amount = parseUnits(params.amount, params.decimals);
      const seed = keccak256(
        encodePacked(["uint256", "uint256"], [BigInt(Date.now()), amount]),
      );

      setState((s) => ({ ...s, step: "approve", mode: "direct" }));

      const approveTx = await writeContractAsync({
        address: params.tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contracts.handler, amount],
      });

      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      setState((s) => ({ ...s, step: "execute" }));

      const executeTx = await writeContractAsync({
        address: contracts.handler,
        abi: HANDLER_ABI,
        functionName: "startPipeline",
        args: [params.tokenAddress, amount, seed],
      });

      notifyPipelineStarted(executeTx, params.amount);
      setState((s) => ({ ...s, step: "confirming", txHash: executeTx }));

      await publicClient.waitForTransactionReceipt({ hash: executeTx });

      setState((s) => ({
        ...s,
        step: "done",
        txHash: executeTx,
        pipelineId: seed,
      }));
    },
    [writeContractAsync, publicClient],
  );

  const execute = useCallback(
    async (params: PipelineParams) => {
      const contracts = getContracts(params.chainId);
      if (!contracts) {
        setState((s) => ({
          ...s,
          step: "error",
          error: `No contracts deployed on chain ${params.chainId}`,
        }));
        return;
      }

      if (!publicClient) {
        setState((s) => ({
          ...s,
          step: "error",
          error: "No network connection. Please reconnect your wallet.",
        }));
        return;
      }

      setState({ step: "idle", txHash: undefined, pipelineId: undefined, error: null, mode: null });

      try {
        if (address && contracts.relayer) {
          const hasEIP7702 = await checkEIP7702(address);
          if (hasEIP7702) {
            await executeViaEIP7702(params, address);
            return;
          }
        }
        await executeDirect(params);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Transaction failed";
        setState((s) => ({ ...s, step: "error", error: message }));
        notifyPipelineError(message);
      }
    },
    [address, publicClient, checkEIP7702, executeViaEIP7702, executeDirect],
  );

  const reset = useCallback(() => {
    setState({
      step: "idle",
      txHash: undefined,
      pipelineId: undefined,
      error: null,
      mode: null,
    });
  }, []);

  return { state, execute, reset };
}
