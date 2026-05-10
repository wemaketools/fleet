"use client";

import { useFleetStore } from "@/lib/store/useFleetStore";
import { STATUS_COLORS, STATUS_LABELS, type Truck } from "@/lib/types";
import { cn } from "@/lib/utils";

function statusLine(truck: Truck): string {
  switch (truck.status) {
    case "in_transit":
      if (truck.currentRoute) {
        return `In transit → ${truck.currentRoute.destinationNodeId.replace(/-/g, " ")}`;
      }
      return "In transit";
    case "loading":
      return `Loading at ${truck.lastStopped.locationName}`;
    case "unloading":
      return `Unloading at ${truck.lastStopped.locationName}`;
    case "idle":
      return `Idle at ${truck.lastStopped.locationName}`;
    case "offline":
      return "Offline";
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.round((now - then) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const hr = Math.floor(diffMin / 60);
  const mn = diffMin % 60;
  return `${hr}h ${mn}m ago`;
}

export default function TruckCard({ truck }: { truck: Truck }) {
  const selectedId = useFleetStore((s) => s.selectedId);
  const selectTruck = useFleetStore((s) => s.selectTruck);
  const isSelected = truck.id === selectedId;
  const color = STATUS_COLORS[truck.status];
  const isOffline = truck.status === "offline";

  return (
    <button
      onClick={() => selectTruck(truck.id)}
      className={cn(
        "relative flex flex-col text-left rounded-lg transition-colors",
        "border border-white/5 bg-white/2 hover:bg-white/5",
        isSelected && "bg-white/6 border-white/15 ring-1 ring-[#CE1126]/40",
        isOffline && "opacity-70",
      )}
    >
      <div className="pl-3 pr-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: color }}
            />
            <span
              className="font-mono text-[13px] font-semibold truncate"
              style={{ color }}
            >
              {truck.id}
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-500 shrink-0">
            {truck.plateNumber}
          </span>
        </div>
        <div className="mt-1 text-[13px] text-slate-300 truncate">
          {truck.driver.name}
        </div>
        <div className="mt-0.5 text-[12px] text-slate-400 truncate">
          {statusLine(truck)}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
          {truck.currentLocation.speedKmh > 0 && (
            <span className="tabular-nums">
              {truck.currentLocation.speedKmh} km/h
            </span>
          )}
          {truck.currentLocation.speedKmh > 0 && <span>·</span>}
          <span>
            {isOffline ? "Last seen " : ""}
            {relativeTime(truck.lastStopped.timestamp)}
          </span>
        </div>
      </div>
      <span className="sr-only">{STATUS_LABELS[truck.status]}</span>
    </button>
  );
}
