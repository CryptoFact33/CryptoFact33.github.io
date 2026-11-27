export const HANDLER_ABI = [
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
  {
    type: "function",
    name: "pipelines",
    inputs: [{ name: "pipelineId", type: "bytes32" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "totalAmount", type: "uint256" },
      { name: "stage", type: "uint8" },
      { name: "depositId", type: "bytes32" },
      { name: "settlementId", type: "bytes32" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "PipelineStarted",
    inputs: [
      { name: "pipelineId", type: "bytes32", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PipelineAdvanced",
    inputs: [
      { name: "pipelineId", type: "bytes32", indexed: true },
      { name: "stage", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PipelineCompleted",
    inputs: [
      { name: "pipelineId", type: "bytes32", indexed: true },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
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
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;

export const PIPELINE_STAGES = [
  "None",
  "Fragmented",
  "Bridged",
  "Pooled",
  "Settled",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
