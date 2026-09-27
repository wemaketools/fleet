"use client";

import { useFleetStore } from "@/lib/store/useFleetStore";
import { useStatusCounts } from "@/lib/hooks/useStatusCounts";
import {
  STATUS_COLOR_VARS,
  STATUS_LABELS,
  STATUS_ON_COLOR,
  STATUS_ORDER,
  type TruckStatus,
} from "@/lib/types";
import StatusIcon from "@/components/ui/StatusIcon";
import { cn } from "@/lib/utils";

// The fleet at a glance: one soft tile per status with its icon and count.
// Tapping a tile filters the list and fades other trucks on the map.
export default function StatusStrip() {
  const counts = useStatusCounts();
  const statusFilter = useFleetStore((s) => s.statusFilter);
  const toggleFilter = useFleetStore((s) => s.toggleStatusFilter);
  const panelState = useFleetStore((s) => s.panelState);
  const setPanelState = useFleetStore((s) => s.setPanelState);
  const filtering = statusFilter.size > 0;

  const onToggle = (status: TruckStatus) => {
    toggleFilter(status);
    if (panelState !== "list") setPanelState("list");
  };

  return (
    <div
      role="group"
      aria-label="Filter trucks by status"
      className="flex items-center gap-2"
    >
      {STATUS_ORDER.map((status) => {
        const active = statusFilter.has(status);
        const label = STATUS_LABELS[status];
        return (
          <button
            key={status}
            type="button"
            onClick={() => onToggle(status)}
            aria-pressed={active}
            aria-label={`${label}: ${counts[status]}`}
            title={active ? "Show all trucks" : `Show only ${label.toLowerCase()} trucks`}
            className={cn(
              "flex items-center gap-2.5 h-11 pl-1.5 pr-3.5 rounded-xl transition-[background-color,opacity,color] duration-150",
              "max-xl:pr-2.5 max-xl:gap-2",
              active
                ? "bg-(--tone) text-(--on-tone)"
                : "bg-[color-mix(in_srgb,var(--tone)_13%,white)] hover:bg-[color-mix(in_srgb,var(--tone)_22%,white)] text-ink",
              filtering && !active && "opacity-50 hover:opacity-100",
            )}
            style={
              {
                "--tone": STATUS_COLOR_VARS[status],
                "--on-tone": STATUS_ON_COLOR[status],
              } as React.CSSProperties
            }
          >
            <span
              aria-hidden
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                active ? "bg-white text-(--tone)" : "bg-(--tone) text-(--on-tone)",
              )}
            >
              <StatusIcon status={status} className="w-[17px] h-[17px]" />
            </span>
            <span className="flex flex-col items-start leading-none">
              <span className="text-[18px] font-bold">{counts[status]}</span>
              <span
                className={cn(
                  "mt-0.5 text-[12px] font-medium whitespace-nowrap max-xl:hidden",
                  active ? "opacity-90" : "text-ink-2",
                )}
              >
                {label}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
