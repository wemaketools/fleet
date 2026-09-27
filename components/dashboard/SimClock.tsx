"use client";

import { useNow } from "@/lib/hooks/useNow";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatTime(d: Date) {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// Port time: Ghana keeps UTC+0 all year, so the clock shows UTC as GMT
// regardless of where the viewer is.
export default function SimClock() {
  const now = useNow();

  return (
    <div
      className="flex items-baseline gap-1 leading-none"
      suppressHydrationWarning
    >
      <span className="text-[16px] font-semibold text-ink tabular-nums">
        {now === 0 ? "--:--:--" : formatTime(new Date(now))}
      </span>
      <span className="text-[11px] font-medium text-ink-3">GMT</span>
    </div>
  );
}
