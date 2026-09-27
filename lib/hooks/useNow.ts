"use client";

import { useSyncExternalStore } from "react";

// One shared wall-clock tick for every component that shows relative time,
// so the top-bar clock and "x ago" labels advance together.
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

// Returns 0 until mounted on the client (avoids hydration mismatches).
export function useNow(): number {
  return useSyncExternalStore(
    subscribeToClock,
    getNowSnapshot,
    getServerNowSnapshot,
  );
}
