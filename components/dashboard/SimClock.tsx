"use client";

import { useSyncExternalStore } from "react";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

let clockNow = 0;
let clockInterval: ReturnType<typeof setInterval> | undefined;
const clockListeners = new Set<() => void>();

function publishClockTick() {
  clockNow = Date.now();
  clockListeners.forEach((listener) => listener());
}

function subscribeToClock(onStoreChange: () => void) {
  clockListeners.add(onStoreChange);
  if (!clockInterval) {
    clockInterval = setInterval(publishClockTick, 500);
    queueMicrotask(publishClockTick);
  }

  return () => {
    clockListeners.delete(onStoreChange);
    if (clockListeners.size === 0 && clockInterval) {
      clearInterval(clockInterval);
      clockInterval = undefined;
      clockNow = 0;
    }
  };
}

function getNowSnapshot() {
  return clockNow;
}

function getServerNowSnapshot() {
  return 0;
}

export default function SimClock() {
  const now = useSyncExternalStore(
    subscribeToClock,
    getNowSnapshot,
    getServerNowSnapshot,
  );

  if (now === 0) {
    return (
      <div
        className="flex flex-col items-end leading-tight font-mono"
        suppressHydrationWarning
      >
        <span className="text-[13px] text-slate-100 tabular-nums">
          --:--:--
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end leading-tight font-mono">
      <span className="text-[13px] text-slate-100 tabular-nums">
        {formatTime(new Date(now))}
      </span>
    </div>
  );
}
