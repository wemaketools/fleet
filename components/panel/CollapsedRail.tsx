"use client";

import { ChevronLeft } from "lucide-react";
import { useFleetStore } from "@/lib/store/useFleetStore";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type TruckStatus,
} from "@/lib/types";

const ORDER: TruckStatus[] = ["in_transit", "loading", "unloading", "idle", "offline"];

export default function CollapsedRail() {
  const trucks = useFleetStore((s) => s.trucks);
  const setPanelState = useFleetStore((s) => s.setPanelState);
  const toggleFilter = useFleetStore((s) => s.toggleStatusFilter);
  const clearFilter = useFleetStore((s) => s.clearStatusFilter);

  const expand = () => setPanelState("list");

  return (
    <aside className="panel-glass absolute top-0 right-0 h-full w-12 border-l border-white/10 z-20 flex flex-col items-center py-3 gap-2">
      <button
        onClick={expand}
        className="w-8 h-8 rounded hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
        aria-label="Expand panel"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="w-6 h-px bg-white/10 my-1" />
      <div className="flex flex-col gap-2 mt-1">
        {ORDER.map((status) => {
          const count = trucks.filter((t) => t.status === status).length;
          return (
            <button
              key={status}
              onClick={() => {
                clearFilter();
                toggleFilter(status);
                expand();
              }}
              title={`${STATUS_LABELS[status]} (${count})`}
              className="flex flex-col items-center gap-0.5 group"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: STATUS_COLORS[status] }}
              />
              <span className="text-[11px] tabular-nums text-slate-400 group-hover:text-slate-200 transition-colors">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
