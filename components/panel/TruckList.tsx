"use client";

import { useMemo } from "react";
import { useFleetStore } from "@/lib/store/useFleetStore";
import { STATUS_PRIORITY, type Truck } from "@/lib/types";
import SearchBar from "./SearchBar";
import StatusFilterChips from "./StatusFilterChips";
import TruckCard from "./TruckCard";
import { ScrollArea } from "@/components/ui/scroll-area";

function LoadingSkeleton() {
  return (
    <div className="px-3 pb-4 flex flex-col gap-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="h-[88px] rounded-lg border border-white/5 bg-white/[0.025] overflow-hidden"
        >
          <div className="h-full animate-pulse p-3">
            <div className="h-3 w-28 rounded bg-white/10" />
            <div className="mt-3 h-2.5 w-40 rounded bg-white/5" />
            <div className="mt-2 h-2.5 w-24 rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TruckList() {
  const trucks = useFleetStore((s) => s.trucks);
  const query = useFleetStore((s) => s.searchQuery);
  const statusFilter = useFleetStore((s) => s.statusFilter);
  const connected = useFleetStore((s) => s.connected);
  const hasEverConnected = useFleetStore((s) => s.hasEverConnected);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trucks
      .filter((t) => statusFilter.size === 0 || statusFilter.has(t.status))
      .filter((t) => {
        if (!q) return true;
        return (
          t.id.toLowerCase().includes(q) ||
          t.plateNumber.toLowerCase().includes(q) ||
          t.driver.name.toLowerCase().includes(q)
        );
      })
      .sort((a: Truck, b: Truck) => {
        const p = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (p !== 0) return p;
        return a.id.localeCompare(b.id);
      });
  }, [trucks, query, statusFilter]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 shrink-0">
        <SearchBar />
      </div>
      <div className="px-4 pb-3 shrink-0">
        <StatusFilterChips />
      </div>
      {!connected && hasEverConnected && (
        <div className="mx-4 mb-3 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-100">
          Reconnecting to live truck feed…
        </div>
      )}
      <div className="px-4 pb-2 shrink-0 text-[12px] text-slate-500 uppercase tracking-wider">
        {filtered.length} of {trucks.length} trucks
      </div>
      <ScrollArea className="flex-1 min-h-0">
        {!connected && !hasEverConnected && trucks.length === 0 ? (
          <LoadingSkeleton />
        ) : (
          <div className="px-3 pb-4 flex flex-col gap-2">
            {filtered.map((t) => (
              <TruckCard key={t.id} truck={t} />
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-10 text-center text-[13px] text-slate-500">
                No trucks match your filter.
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
