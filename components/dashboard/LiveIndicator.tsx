"use client";

import { useFleetStore } from "@/lib/store/useFleetStore";
import { cn } from "@/lib/utils";

// Feed health, kept visually apart from the truck status colours.
export default function LiveIndicator() {
  const connected = useFleetStore((s) => s.connected);
  const hasEverConnected = useFleetStore((s) => s.hasEverConnected);

  const state = connected
    ? "live"
    : hasEverConnected
      ? "reconnecting"
      : "connecting";

  const label = {
    live: "Live",
    reconnecting: "Reconnecting…",
    connecting: "Connecting…",
  }[state];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 h-8 px-3 rounded-full text-[13px] font-medium",
        state === "live" && "bg-green-50 text-green-800",
        state === "reconnecting" && "bg-amber-50 text-amber-800",
        state === "connecting" && "bg-tint text-ink-2",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "w-2 h-2 rounded-full",
          state === "live" && "bg-green-600 live-dot",
          state === "reconnecting" && "bg-amber-500",
          state === "connecting" && "bg-ink-3",
        )}
      />
      {label}
    </div>
  );
}
