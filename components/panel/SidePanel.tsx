"use client";

import { ChevronRight } from "lucide-react";
import { useFleetStore } from "@/lib/store/useFleetStore";
import TruckList from "./TruckList";
import TruckDetail from "./TruckDetail";
import CollapsedRail from "./CollapsedRail";

export default function SidePanel() {
  const panelState = useFleetStore((s) => s.panelState);
  const setPanelState = useFleetStore((s) => s.setPanelState);
  const selectedId = useFleetStore((s) => s.selectedId);

  if (panelState === "collapsed") {
    return <CollapsedRail />;
  }

  return (
    <aside className="panel-glass absolute top-0 right-0 h-full w-[400px] max-lg:w-[320px] border-l border-white/10 z-20 flex flex-col">
      <div className="flex items-center justify-between h-12 px-4 border-b border-white/10 shrink-0">
        <h2 className="text-[14px] font-semibold text-slate-100 tracking-tight">
          {panelState === "detail" && selectedId ? "Truck Detail" : "Fleet"}
        </h2>
        <button
          onClick={() => setPanelState("collapsed")}
          className="w-7 h-7 rounded hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Collapse panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {panelState === "detail" && selectedId ? (
          <TruckDetail truckId={selectedId} />
        ) : (
          <TruckList />
        )}
      </div>
    </aside>
  );
}
