"use client";

import { Check, Phone } from "lucide-react";
import { useFleetStore } from "@/lib/store/useFleetStore";
import { useNow } from "@/lib/hooks/useNow";
import {
  compassWord,
  formatAgo,
  formatDuration,
  formatHourMinute,
  formatLatLng,
  isoToMs,
} from "@/lib/format";
import { nodeName } from "@/lib/port-graph";
import { lastSeenPhrase, statusSentence } from "@/lib/status-copy";
import {
  STATUS_COLOR_VARS,
  VEHICLE_TYPE_LABELS,
  type TruckRoute,
} from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import StatusPill from "@/components/ui/StatusPill";
import SectionHeader from "@/components/ui/SectionHeader";
import KeyValue, { type KeyValueItem } from "@/components/ui/KeyValue";
import TruckAvatar from "@/components/ui/TruckAvatar";
import PlateBadge from "@/components/ui/PlateBadge";
import DriverAvatar from "@/components/ui/DriverAvatar";
import { cn } from "@/lib/utils";

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 py-3">
      <SectionHeader>{label}</SectionHeader>
      <div className="text-[14px] text-ink leading-relaxed">{children}</div>
    </section>
  );
}

function ago(iso: string | undefined, now: number) {
  const ms = isoToMs(iso);
  return ms && now ? formatAgo(ms, now) : "a moment ago";
}

// Vertical list of stops: done stops get a tick, the next stop pulses, and
// the destination carries the arrival time.
function Journey({
  route,
  color,
  now,
}: {
  route: TruckRoute;
  color: string;
  now: number;
}) {
  const stops = [route.originNodeId, ...route.waypointNodeIds];
  const legs = Math.max(1, stops.length - 1);
  const travelled = (route.progressPercent / 100) * legs;
  const reached = Math.floor(travelled);
  const etaMs = isoToMs(route.etaTimestamp);
  const remainingMs = etaMs && now ? etaMs - now : null;

  return (
    <ol aria-label="Journey">
      {stops.map((id, i) => {
        const isFirst = i === 0;
        const isLast = i === stops.length - 1;
        const done = i <= reached && !isLast;
        const isNext = i === reached + 1;
        const legFill = i < reached ? 1 : i === reached ? travelled - reached : 0;
        return (
          <li key={`${id}-${i}`} className="relative flex gap-3 min-h-11">
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-[11px] top-6 bottom-0 w-0.5 rounded-full bg-tint-2 overflow-hidden"
              >
                <span
                  className="block w-full rounded-full transition-[height] duration-500"
                  style={{ height: `${legFill * 100}%`, background: color }}
                />
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-0.5 w-6 h-6 shrink-0 rounded-full flex items-center justify-center",
                !done && "bg-white ring-2",
              )}
              style={
                done
                  ? { background: color }
                  : ({ "--tw-ring-color": isNext || isLast ? color : "var(--tint-2)" } as React.CSSProperties)
              }
            >
              {done && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              {isNext && !isLast && (
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              )}
            </span>
            <span className="pb-3 min-w-0">
              <span
                className={cn(
                  "block text-[14px]",
                  isLast ? "font-semibold text-ink" : done ? "text-ink-2" : "text-ink",
                )}
              >
                {nodeName(id)}
              </span>
              {isFirst && <span className="block text-[12px] text-ink-3">Started here</span>}
              {isLast && etaMs && (
                <span className="block text-[13px] text-ink-2">
                  {remainingMs !== null && remainingMs <= 5_000
                    ? "Arriving now"
                    : `Arriving ${formatHourMinute(etaMs)}${
                        remainingMs !== null ? `, in ${formatDuration(remainingMs)}` : ""
                      }`}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function TruckDetail({ truckId }: { truckId: string }) {
  const truck = useFleetStore((s) => s.trucks.find((t) => t.id === truckId));
  const now = useNow();

  if (!truck) {
    return (
      <div className="px-5 py-8 text-[14px] text-ink-2">
        This truck has left the fleet feed. Go back to pick another.
      </div>
    );
  }

  const color = STATUS_COLOR_VARS[truck.status];
  const isOffline = truck.status === "offline";
  const { currentLocation: loc, currentCargo: cargo } = truck;
  const speed = Math.round(loc.speedKmh);
  const heading = Math.round(loc.heading);
  const arrivedMs = isoToMs(truck.lastStopped.timestamp);
  const dwelling =
    truck.status === "loading" ||
    truck.status === "unloading" ||
    truck.status === "idle";

  let subline: string | null = null;
  if (isOffline) {
    const seen = lastSeenPhrase(truck, now);
    subline = seen ? `No signal ${seen}` : "No signal";
  } else if (dwelling && arrivedMs && now) {
    subline = `For ${formatDuration(now - arrivedMs)} so far`;
  } else if (truck.status === "in_transit" && truck.currentRoute) {
    subline = `${truck.currentRoute.progressPercent}% of the way there`;
  }

  const cargoItems: KeyValueItem[] = [
    {
      label: "Weight",
      value: cargo.weightTonnes > 0 ? `${cargo.weightTonnes} t` : "Empty",
    },
  ];
  if (cargo.containerNumber) {
    cargoItems.push({ label: "Container", value: cargo.containerNumber });
  }

  return (
    <ScrollArea className="h-full">
      <div
        className="mx-3 rounded-2xl p-4"
        style={{ background: `color-mix(in srgb, ${color} 12%, white)` }}
      >
        <div className="flex items-start gap-3">
          <TruckAvatar
            vehicleType={truck.vehicleType}
            status={truck.status}
            size={60}
            className="bg-white!"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[22px] font-semibold leading-tight text-ink truncate">
                {truck.id}
              </span>
              <StatusPill status={truck.status} className="ml-auto" />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <PlateBadge plate={truck.plateNumber} size="lg" />
              <span className="text-[13px] text-ink-2 truncate">
                {VEHICLE_TYPE_LABELS[truck.vehicleType]}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 text-[17px] font-semibold text-ink leading-snug">
          {statusSentence(truck)}
        </div>
        {subline && (
          <div
            className={cn(
              "text-[13px]",
              isOffline ? "text-status-offline font-medium" : "text-ink-2",
            )}
          >
            {subline}
          </div>
        )}
      </div>

      <div className={cn("pt-2 pb-4", isOffline && "opacity-70")}>
        {truck.status === "in_transit" && truck.currentRoute && (
          <Section label="Journey">
            <Journey route={truck.currentRoute} color={color} now={now} />
          </Section>
        )}

        <Section label="Driver">
          <div className="flex items-center gap-3">
            <DriverAvatar driver={truck.driver} size={48} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium truncate">
                {truck.driver.name}
              </span>
              <span className="block text-[13px] text-ink-2">
                {truck.driver.phone}
              </span>
            </span>
            <a
              href={`tel:${truck.driver.phone.replace(/\s+/g, "")}`}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-ink text-white text-[13px] font-semibold hover:bg-ink/90 transition-colors shrink-0"
            >
              <Phone aria-hidden className="w-3.5 h-3.5" />
              Call
            </a>
          </div>
        </Section>

        <Section label="Carrying">
          <p className="mb-2.5">{cargo.description}</p>
          <KeyValue items={cargoItems} />
        </Section>

        <Section label="Where it is">
          {!isOffline && (
            <p title={speed > 0 ? `Heading ${heading}°` : undefined}>
              {speed > 0
                ? `Driving ${compassWord(heading)} at ${speed} km/h`
                : "Standing still"}
            </p>
          )}
          <p className="text-ink-2 text-[13px]">
            Last stopped at {truck.lastStopped.locationName},{" "}
            {ago(truck.lastStopped.timestamp, now)}
          </p>
          <p className="mt-1 text-[12px] text-ink-3">
            {formatLatLng(loc.lat, loc.lng)}
          </p>
        </Section>

        <Section label="Last drop-off">
          <p>
            Unloaded at {truck.lastUnloaded.locationName},{" "}
            {ago(truck.lastUnloaded.timestamp, now)}
          </p>
          <p className="text-[13px] text-ink-2">
            {truck.lastUnloaded.cargoDescription}
          </p>
        </Section>
      </div>
    </ScrollArea>
  );
}
