"use client";

import { useMemo } from "react";
import { useFleetStore } from "@/lib/store/useFleetStore";
import { STATUS_ORDER, type TruckStatus } from "@/lib/types";

export function useStatusCounts(): Record<TruckStatus, number> {
  const trucks = useFleetStore((s) => s.trucks);
  return useMemo(() => {
    const counts = Object.fromEntries(
      STATUS_ORDER.map((status) => [status, 0]),
    ) as Record<TruckStatus, number>;
    for (const t of trucks) counts[t.status] += 1;
    return counts;
  }, [trucks]);
}
