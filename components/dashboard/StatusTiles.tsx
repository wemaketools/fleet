"use client";

import { useFleetStore } from "@/lib/store/useFleetStore";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type TruckStatus,
} from "@/lib/types";

const ORDER: TruckStatus[] = ["in_transit", "loading", "unloading", "idle", "offline"];

export default function StatusTiles() {
  const trucks = useFleetStore((s) => s.trucks);

  const counts = ORDER.reduce<Record<TruckStatus, number>>(
    (acc, s) => {
      acc[s] = trucks.filter((t) => t.status === s).length;
      return acc;
    },
    { in_transit: 0, loading: 0, unloading: 0, idle: 0, offline: 0 },
  );

  return (
    <div className="flex items-center gap-6">
      {ORDER.map((status) => (
        <div key={status} className="flex flex-col items-center min-w-22.5">
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: STATUS_COLORS[status] }}
            />
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              {STATUS_LABELS[status]}
            </span>
          </div>
          <span className="text-center text-xl font-semibold text-slate-100 tabular-nums leading-tight">
            {counts[status]}
          </span>
        </div>
      ))}
    </div>
  );
}
