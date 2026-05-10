"use client";

import { ArrowLeft, MapPin, Phone } from "lucide-react";
import { useFleetStore } from "@/lib/store/useFleetStore";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type Truck,
} from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
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

function VehicleTypeLabel({ type }: { type: Truck["vehicleType"] }) {
  const map: Record<Truck["vehicleType"], string> = {
    container_truck: "Container truck",
    flatbed: "Flatbed",
    tanker: "Tanker",
    terminal_tractor: "Terminal tractor",
  };
  return <span>{map[type]}</span>;
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3 border-b border-white/5">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
        {label}
      </div>
      <div className="text-[13px] text-slate-200 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export default function TruckDetail({ truckId }: { truckId: string }) {
  const truck = useFleetStore((s) =>
    s.trucks.find((t) => t.id === truckId),
  );
  const selectTruck = useFleetStore((s) => s.selectTruck);
  const followSelected = useFleetStore((s) => s.followSelected);
  const toggleFollow = useFleetStore((s) => s.toggleFollow);

  if (!truck) {
    return (
      <div className="p-5 text-[13px] text-slate-500">Truck not found.</div>
    );
  }

  const color = STATUS_COLORS[truck.status];
  const isOffline = truck.status === "offline";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
        <button
          onClick={() => selectTruck(null)}
          className="flex items-center gap-1.5 px-2 h-7 rounded text-[13px] text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <button
          onClick={toggleFollow}
          className={cn(
            "flex items-center gap-1.5 px-2 h-7 rounded text-[12px] transition-colors",
            followSelected
              ? "bg-[#CE1126]/20 text-slate-100"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
          )}
        >
          <MapPin className="w-3.5 h-3.5" />
          Follow
        </button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 pt-5 pb-3 border-b border-white/5">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[12px] font-semibold uppercase tracking-wider"
            style={{
              background: `${color}26`,
              color,
              boxShadow: `inset 0 0 0 1px ${color}55`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: color }}
            />
            {STATUS_LABELS[truck.status]}
          </div>
          <div
            className="mt-3 font-mono text-[23px] font-semibold leading-tight"
            style={{ color }}
          >
            {truck.id}
          </div>
          <div className="text-[13px] text-slate-400 mt-0.5">
            {truck.plateNumber} · <VehicleTypeLabel type={truck.vehicleType} />
          </div>
        </div>

        <Section label="Driver">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold text-slate-100 shrink-0"
              style={{
                background: "rgba(206, 17, 38, 0.2)",
                color: "#FCA5A5",
              }}
            >
              {initials(truck.driver.name)}
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-slate-100">
                {truck.driver.name}
              </div>
              <div className="text-[12px] text-slate-400 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {truck.driver.phone}
              </div>
            </div>
          </div>
        </Section>

        <Section label="Current Cargo">
          <div className="font-medium text-slate-100">
            {truck.currentCargo.description}
          </div>
          <div className="text-[12px] text-slate-400 mt-1">
            {truck.currentCargo.weightTonnes > 0
              ? `${truck.currentCargo.weightTonnes} t`
              : "Empty"}
          </div>
          {truck.currentCargo.containerNumber && (
            <div className="text-[12px] text-slate-500 mt-1 font-mono">
              Container #: {truck.currentCargo.containerNumber}
            </div>
          )}
        </Section>

        <Section label="Location">
          <div className="font-mono text-[13px] text-slate-200">
            {truck.currentLocation.lat.toFixed(4)}° N,{" "}
            {truck.currentLocation.lng.toFixed(4)}° E
          </div>
          {!isOffline && (
            <div className="text-[12px] text-slate-400 mt-1">
              {truck.currentLocation.speedKmh} km/h ·{" "}
              {truck.currentLocation.speedKmh > 0
                ? `heading ${truck.currentLocation.heading}°`
                : "stationary"}
            </div>
          )}
          <div className="text-[12px] text-slate-500 mt-1">
            {isOffline ? "Last seen at " : "Last stopped: "}
            {truck.lastStopped.locationName} ·{" "}
            {relativeTime(truck.lastStopped.timestamp)}
          </div>
        </Section>

        {truck.currentRoute && (
          <Section label="Route">
            <div className="text-[13px] text-slate-200">
              {truck.currentRoute.originNodeId.replace(/-/g, " ")} →{" "}
              {truck.currentRoute.destinationNodeId.replace(/-/g, " ")}
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${truck.currentRoute.progressPercent}%`,
                  background: color,
                }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
              <span>{truck.currentRoute.progressPercent}%</span>
              <span className="tabular-nums">
                ETA{" "}
                {new Date(truck.currentRoute.etaTimestamp).toLocaleTimeString(
                  [],
                  { hour: "2-digit", minute: "2-digit" },
                )}
              </span>
            </div>
          </Section>
        )}

        <Section label="History">
          <div className="text-[12px] text-slate-400">
            Last unloaded: {truck.lastUnloaded.locationName} ·{" "}
            {relativeTime(truck.lastUnloaded.timestamp)}
          </div>
          <div className="text-[12px] text-slate-500 mt-1">
            {truck.lastUnloaded.cargoDescription}
          </div>
        </Section>
      </ScrollArea>
    </div>
  );
}
