import { useEffect, useRef, useState } from "react";

const STATUS_MESSAGES = [
  "Verifying cross-chain network state...",
  "Allocating loyalty liquidity...",
  "Synchronizing multi-chain balances...",
  "Finalizing settlement operations...",
];

const CYCLE_INTERVAL_MS = 3000;

interface ExecutionModalProps {
  promise: Promise<unknown>;
  onResolved: () => void;
  onRejected?: (error: unknown) => void;
}

export function ExecutionModal({
  promise,
  onResolved,
  onRejected,
}: ExecutionModalProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const settled = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setMessageIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, CYCLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    promise.then(
      () => {
        if (!cancelled && !settled.current) {
          settled.current = true;
          onResolved();
        }
      },
      (err) => {
        if (!cancelled && !settled.current) {
          settled.current = true;
          onRejected?.(err);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [promise, onResolved, onRejected]);

  useEffect(() => {
    const block = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, []);

  useEffect(() => {
    const block = (e: MouseEvent) => {
      e.stopImmediatePropagation();
      e.preventDefault();
    };
    window.addEventListener("click", block, true);
    window.addEventListener("pointerdown", block, true);
    window.addEventListener("mousedown", block, true);
    return () => {
      window.removeEventListener("click", block, true);
      window.removeEventListener("pointerdown", block, true);
      window.removeEventListener("mousedown", block, true);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{ pointerEvents: "auto" }}
    >
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-[#0A0E17]/90 px-10 py-12 shadow-2xl backdrop-blur-md">
        {/* Spinner */}
        <div className="relative h-14 w-14">
          <svg className="h-14 w-14 animate-spin" viewBox="0 0 56 56">
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="4"
            />
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="url(#exec-gradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="100 51"
            />
            <defs>
              <linearGradient id="exec-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#d946ef" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Status text */}
        <p
          key={messageIndex}
          className="max-w-xs text-center text-sm font-medium text-white/80 animate-[fadeIn_0.4s_ease-in-out]"
        >
          {STATUS_MESSAGES[messageIndex]}
        </p>

        <p className="text-[10px] uppercase tracking-widest text-white/30">
          Do not close this window
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
