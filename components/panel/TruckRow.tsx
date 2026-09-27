"use client";

import { useFleetStore } from "@/lib/store/useFleetStore";
import { useNow } from "@/lib/hooks/useNow";
import { formatAgo } from "@/lib/format";
import { lastSeenPhrase, statusSentence } from "@/lib/status-copy";
import type { Truck } from "@/lib/types";
import TruckAvatar from "@/components/ui/TruckAvatar";
import PlateBadge from "@/components/ui/PlateBadge";
import DriverAvatar from "@/components/ui/DriverAvatar";
import { cn } from "@/lib/utils";

// Feed freshness is only worth a word once it is noticeably stale.
const STALE_AFTER_MS = 5000;

export default function TruckRow({ truck }: { truck: Truck }) {
  const isSelected = useFleetStore((s) => s.selectedId === truck.id);
  const selectTruck = useFleetStore((s) => s.selectTruck);
  const lastSnapshotAt = useFleetStore((s) => s.lastSnapshotAt);
  const now = useNow();

  const isOffline = truck.status === "offline";
  const speed = Math.round(truck.currentLocation.speedKmh);
  const staleMs = now && lastSnapshotAt ? now - lastSnapshotAt : 0;

  let detail = statusSentence(truck);
  if (isOffline) {
    const seen = lastSeenPhrase(truck, now);
    if (seen) detail = `No signal ${seen}`;
  } else if (speed > 0) {
    detail += `, ${speed} km/h`;
  }

  return (
    <button
      type="button"
      onClick={() => selectTruck(truck.id)}
      aria-current={isSelected ? "true" : undefined}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors",
        isSelected ? "bg-tint-2" : "hover:bg-tint",
      )}
    >
      <span className="relative shrink-0">
        <TruckAvatar vehicleType={truck.vehicleType} status={truck.status} />
        {truck.driver.photoUrl && (
          <DriverAvatar
            driver={truck.driver}
            size={24}
            className="absolute -bottom-1.5 -right-1.5"
          />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-ink truncate">
            {truck.id}
          </span>
          <PlateBadge plate={truck.plateNumber} className="ml-auto" />
        </span>
        <span className="block text-[13px] text-ink-2 truncate">
          {truck.driver.name}
        </span>
        <span
          className={cn(
            "block text-[13px] truncate",
            isOffline ? "text-status-offline font-medium" : "text-ink",
          )}
        >
          {detail}
          {!isOffline && staleMs >= STALE_AFTER_MS && (
            <span className="text-amber-700">
              , updated {formatAgo(lastSnapshotAt, now)}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
