import { formatAgo, formatHourMinute, isoToMs } from "@/lib/format";
import { nearestNodeName, nodeName } from "@/lib/port-graph";
import type { Truck } from "@/lib/types";

// One plain-language line describing what a truck is doing right now.
export function statusSentence(truck: Truck): string {
  switch (truck.status) {
    case "in_transit":
      if (truck.currentRoute) {
        return `Heading to ${nodeName(truck.currentRoute.destinationNodeId)}`;
      }
      return truck.currentLocation.speedKmh > 0 ? "On the move" : "Waiting to move";
    case "loading":
      return `Loading at ${truck.lastStopped.locationName}`;
    case "unloading":
      return `Unloading at ${truck.lastStopped.locationName}`;
    case "idle":
      return `Parked at ${truck.lastStopped.locationName}`;
    case "offline":
      return `Last seen near ${nearestNodeName(
        truck.currentLocation.lat,
        truck.currentLocation.lng,
      )}`;
  }
}

// When the tracker went quiet, e.g. "since 14:02, 4 min ago".
export function lastSeenPhrase(truck: Truck, now: number): string | null {
  const ms = isoToMs(truck.lastSeenAt ?? truck.lastStopped.timestamp);
  if (!ms || !now) return null;
  return `since ${formatHourMinute(ms)}, ${formatAgo(ms, now)}`;
}
