"use client";

import { ChevronLeft } from "lucide-react";
import { useFleetStore } from "@/lib/store/useFleetStore";
import { useStatusCounts } from "@/lib/hooks/useStatusCounts";
import {
  STATUS_COLOR_VARS,
  STATUS_LABELS,
  STATUS_ON_COLOR,
  STATUS_ORDER,
} from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import StatusIcon from "@/components/ui/StatusIcon";
import { cn } from "@/lib/utils";

// Collapsed panel: the status tiles stacked in a slim column.
export default function CollapsedRail() {
  const counts = useStatusCounts();
  const statusFilter = useFleetStore((s) => s.statusFilter);
  const setPanelState = useFleetStore((s) => s.setPanelState);
  const toggleFilter = useFleetStore((s) => s.toggleStatusFilter);
  const clearFilter = useFleetStore((s) => s.clearStatusFilter);

  const expand = () => setPanelState("list");

  return (
    <aside
      aria-label="Trucks (collapsed)"
      className="absolute top-3 right-3 w-16 z-20 flex flex-col items-center gap-2 p-2 rounded-[20px] bg-sheet shadow-sheet"
    >
      <button
        type="button"
        onClick={expand}
        className="w-10 h-10 rounded-xl hover:bg-tint flex items-center justify-center text-ink-2 hover:text-ink transition-colors"
        aria-label="Show truck list"
        title="Show truck list"
      >
        <ChevronLeft className="w-[18px] h-[18px]" />
      </button>
      {STATUS_ORDER.map((status) => {
        const label = STATUS_LABELS[status];
        const active = statusFilter.has(status);
        return (
          <Tooltip key={status}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  clearFilter();
                  toggleFilter(status);
                  expand();
                }}
                aria-label={`Show ${label.toLowerCase()} trucks (${counts[status]})`}
                className={cn(
                  "w-12 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors",
                  active
                    ? "bg-(--tone) text-(--on-tone)"
                    : "bg-[color-mix(in_srgb,var(--tone)_13%,white)] hover:bg-[color-mix(in_srgb,var(--tone)_22%,white)] text-ink",
                )}
                style={
                  {
                    "--tone": STATUS_COLOR_VARS[status],
                    "--on-tone": STATUS_ON_COLOR[status],
                  } as React.CSSProperties
                }
              >
                <StatusIcon
                  status={status}
                  className={cn("w-4 h-4", !active && "text-(--tone)")}
                />
                <span className="text-[16px] font-bold leading-none">
                  {counts[status]}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              {label}: {counts[status]}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </aside>
  );
}
