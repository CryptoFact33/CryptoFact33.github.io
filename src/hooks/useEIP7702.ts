import { useCallback } from "react";
import { useSignTypedData, usePublicClient, useWriteContract } from "wagmi";
import {
  encodeFunctionData,
  type Address,
  type Hex,
} from "viem";
import { ACCOUNT_ABI, RELAYER_ABI } from "../abi/account";
import { getContracts } from "../config/contracts";

interface Call {
  target: Address;
  value: bigint;
  data: Hex;
}

const EIP712_TYPES = {
  Execute: [
    { name: "calls", type: "Call[]" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  Call: [
    { name: "target", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
  ],
} as const;

export function useEIP7702() {
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const signAndRelay = useCallback(
    async (
      userAddress: Address,
      chainId: number,
      calls: Call[],
    ): Promise<Hex> => {
      const contracts = getContracts(chainId);
      if (!contracts) throw new Error(`No contracts on chain ${chainId}`);
      if (!publicClient) throw new Error("No network connection");

      const nonce = await publicClient.readContract({
        address: userAddress,
        abi: ACCOUNT_ABI,
        functionName: "nonce",
      });

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await signTypedDataAsync({
        domain: {
          name: "EndpoorAccount",
          version: "1",
          chainId: BigInt(chainId),
          verifyingContract: userAddress,
        },
        types: EIP712_TYPES,
        primaryType: "Execute",
        message: {
          calls: calls.map((c) => ({
            target: c.target,
            value: c.value,
            data: c.data,
          })),
          nonce,
          deadline,
        },
      });

      const txHash = await writeContractAsync({
        address: contracts.relayer,
        abi: RELAYER_ABI,
        functionName: "relay",
        args: [
          userAddress,
          calls.map((c) => ({
            target: c.target,
            value: c.value,
            data: c.data,
          })),
          nonce,
          deadline,
          signature,
        ],
      });

      return txHash;
    },
    [signTypedDataAsync, writeContractAsync, publicClient],
  );

  const buildApprovePipelineCalls = useCallback(
    (
      tokenAddress: Address,
      handlerAddress: Address,
      amount: bigint,
      seed: Hex,
    ): Call[] => {
      const approveData = encodeFunctionData({
        abi: [
          {
            type: "function",
            name: "approve",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "approve",
        args: [handlerAddress, amount],
      });

      const pipelineData = encodeFunctionData({
        abi: [
          {
            type: "function",
            name: "startPipeline",
            inputs: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
              { name: "seed", type: "bytes32" },
            ],
            outputs: [{ name: "pipelineId", type: "bytes32" }],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "startPipeline",
        args: [tokenAddress, amount, seed],
      });

      return [
        { target: tokenAddress, value: 0n, data: approveData },
        { target: handlerAddress, value: 0n, data: pipelineData },
      ];
    },
    [],
  );

  return { signAndRelay, buildApprovePipelineCalls };
}
