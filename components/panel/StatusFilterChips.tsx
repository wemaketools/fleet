"use client";

import { useFleetStore } from "@/lib/store/useFleetStore";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type TruckStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER: TruckStatus[] = ["in_transit", "loading", "unloading", "idle", "offline"];

export default function StatusFilterChips() {
  const trucks = useFleetStore((s) => s.trucks);
  const statusFilter = useFleetStore((s) => s.statusFilter);
  const toggle = useFleetStore((s) => s.toggleStatusFilter);
  const clear = useFleetStore((s) => s.clearStatusFilter);

  const allActive = statusFilter.size === 0;

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={clear}
        className={cn(
          "px-2 h-6 rounded-full text-[11px] uppercase tracking-wider transition-colors border",
          allActive
            ? "bg-[#CE1126]/20 border-[#CE1126]/60 text-slate-100"
            : "bg-transparent border-white/10 text-slate-400 hover:text-slate-200",
        )}
      >
        All
      </button>
      {ORDER.map((status) => {
        const active = statusFilter.has(status);
        const count = trucks.filter((t) => t.status === status).length;
        return (
          <button
            key={status}
            onClick={() => toggle(status)}
            className={cn(
              "flex items-center gap-1.5 px-2 h-6 rounded-full text-[11px] uppercase tracking-wider transition-colors border",
              active
                ? "bg-white/10 border-white/30 text-slate-100"
                : "bg-transparent border-white/10 text-slate-400 hover:text-slate-200",
            )}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: STATUS_COLORS[status] }}
            />
            {STATUS_LABELS[status]} ({count})
          </button>
        );
      })}
    </div>
  );
}
