"use client";

import { useFleetStore } from "@/lib/store/useFleetStore";
import { useStatusCounts } from "@/lib/hooks/useStatusCounts";
import {
  STATUS_COLOR_VARS,
  STATUS_LABELS,
  STATUS_ON_COLOR,
  STATUS_ORDER,
} from "@/lib/types";
import StatusIcon from "@/components/ui/StatusIcon";
import { cn } from "@/lib/utils";

const chip =
  "flex items-center gap-1.5 shrink-0 h-8 pl-2.5 pr-3 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap";

export default function StatusFilterChips() {
  const counts = useStatusCounts();
  const statusFilter = useFleetStore((s) => s.statusFilter);
  const toggle = useFleetStore((s) => s.toggleStatusFilter);
  const clear = useFleetStore((s) => s.clearStatusFilter);

  const allActive = statusFilter.size === 0;

  return (
    <div
      role="group"
      aria-label="Filter by status"
      className="no-scrollbar -mx-4 px-4 flex gap-1.5 overflow-x-auto"
    >
      <button
        type="button"
        onClick={clear}
        aria-pressed={allActive}
        className={cn(
          chip,
          "pl-3",
          allActive ? "bg-ink text-white" : "bg-tint text-ink-2 hover:bg-tint-2",
        )}
      >
        All
      </button>
      {STATUS_ORDER.map((status) => {
        const active = statusFilter.has(status);
        return (
          <button
            key={status}
            type="button"
            onClick={() => toggle(status)}
            aria-pressed={active}
            className={cn(chip, !active && "bg-tint text-ink-2 hover:bg-tint-2")}
            style={
              active
                ? {
                    background: STATUS_COLOR_VARS[status],
                    color: STATUS_ON_COLOR[status],
                  }
                : undefined
            }
          >
            <StatusIcon
              status={status}
              className="w-3.5 h-3.5"
              style={{
                color: active ? STATUS_ON_COLOR[status] : STATUS_COLOR_VARS[status],
              }}
            />
            {STATUS_LABELS[status]}
            <span className={cn("text-[12px]", active ? "opacity-80" : "text-ink-3")}>
              {counts[status]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
