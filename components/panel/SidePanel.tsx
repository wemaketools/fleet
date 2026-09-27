"use client";

import { ArrowLeft, ChevronRight, LocateFixed } from "lucide-react";
import { useFleetStore } from "@/lib/store/useFleetStore";
import { cn } from "@/lib/utils";
import TruckList from "./TruckList";
import TruckDetail from "./TruckDetail";
import CollapsedRail from "./CollapsedRail";

const iconButton =
  "w-9 h-9 rounded-xl flex items-center justify-center text-ink-2 hover:text-ink hover:bg-tint transition-colors";

export default function SidePanel() {
  const panelState = useFleetStore((s) => s.panelState);
  const setPanelState = useFleetStore((s) => s.setPanelState);
  const selectedId = useFleetStore((s) => s.selectedId);
  const selectTruck = useFleetStore((s) => s.selectTruck);
  const followSelected = useFleetStore((s) => s.followSelected);
  const toggleFollow = useFleetStore((s) => s.toggleFollow);
  const total = useFleetStore((s) => s.trucks.length);

  if (panelState === "collapsed") {
    return <CollapsedRail />;
  }

  const showDetail = panelState === "detail" && selectedId !== null;

  return (
    <aside
      aria-label="Trucks"
      className="absolute top-3 right-3 bottom-3 w-[384px] max-lg:w-[320px] z-20 flex flex-col rounded-[20px] bg-sheet shadow-sheet overflow-hidden"
    >
      <div className="flex items-center gap-2 h-14 pl-4 pr-2 shrink-0">
        {showDetail ? (
          <>
            <button
              type="button"
              onClick={() => selectTruck(null)}
              className="-ml-2 flex items-center gap-1.5 h-9 pl-2 pr-3 rounded-xl text-[14px] font-medium text-ink-2 hover:text-ink hover:bg-tint transition-colors"
            >
              <ArrowLeft aria-hidden className="w-4 h-4" />
              All trucks
            </button>
            <button
              type="button"
              onClick={toggleFollow}
              aria-pressed={followSelected}
              title="Keep the map centred on this truck"
              className={cn(
                "ml-auto flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-semibold transition-colors",
                followSelected
                  ? "bg-gold text-ink"
                  : "bg-tint text-ink-2 hover:text-ink hover:bg-tint-2",
              )}
            >
              <LocateFixed aria-hidden className="w-4 h-4" />
              {followSelected ? "Following" : "Follow"}
            </button>
          </>
        ) : (
          <h2 className="flex items-baseline gap-2 mr-auto">
            <span className="text-[20px] font-semibold text-ink">Trucks</span>
            <span className="text-[13px] text-ink-3">{total} in the fleet</span>
          </h2>
        )}
        <button
          type="button"
          onClick={() => setPanelState("collapsed")}
          className={iconButton}
          aria-label="Hide truck list"
          title="Hide truck list"
        >
          <ChevronRight className="w-[18px] h-[18px]" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {showDetail ? <TruckDetail truckId={selectedId} /> : <TruckList />}
      </div>
    </aside>
  );
}
