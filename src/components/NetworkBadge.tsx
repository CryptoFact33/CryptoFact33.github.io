import { NETWORK_META } from "../config/networks";

export function NetworkBadge({ chainId }: { chainId: number | undefined }) {
  const meta = chainId ? NETWORK_META[chainId] : undefined;
  if (!meta) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white/90"
      style={{ backgroundColor: meta.color + "CC" }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.name}
    </span>
  );
}
