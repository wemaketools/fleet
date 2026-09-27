"use client";

import { useMemo } from "react";
import { SearchX } from "lucide-react";
import { useFleetStore } from "@/lib/store/useFleetStore";
import { STATUS_PRIORITY, type Truck } from "@/lib/types";
import SearchBar from "./SearchBar";
import StatusFilterChips from "./StatusFilterChips";
import TruckRow from "./TruckRow";
import { ScrollArea } from "@/components/ui/scroll-area";

function LoadingSkeleton() {
  return (
    <div aria-hidden className="px-2">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 px-3 py-2.5 animate-pulse"
        >
          <div className="w-11 h-11 rounded-xl bg-tint-2" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-3.5 w-32 rounded-full bg-tint-2" />
            <div className="h-3 w-24 rounded-full bg-tint" />
            <div className="h-3 w-40 rounded-full bg-tint" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TruckList() {
  const trucks = useFleetStore((s) => s.trucks);
  const query = useFleetStore((s) => s.searchQuery);
  const setQuery = useFleetStore((s) => s.setSearchQuery);
  const statusFilter = useFleetStore((s) => s.statusFilter);
  const clearFilter = useFleetStore((s) => s.clearStatusFilter);
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

  const isLoading = !connected && !hasEverConnected && trucks.length === 0;
  const isFiltered = statusFilter.size > 0 || query.trim() !== "";

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pb-3 flex flex-col gap-3 shrink-0">
        <SearchBar />
        <StatusFilterChips />
      </div>
      {!connected && hasEverConnected && (
        <div
          role="status"
          className="mx-4 mb-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900"
        >
          Lost the live feed. Reconnecting, positions may be a few seconds old.
        </div>
      )}
      {isFiltered && !isLoading && filtered.length > 0 && (
        <div className="px-5 pb-1 shrink-0 text-[13px] text-ink-3">
          Showing {filtered.length} of {trucks.length}
        </div>
      )}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <div className="px-8 py-12 flex flex-col items-center text-center">
            <span className="w-12 h-12 rounded-2xl bg-tint flex items-center justify-center">
              <SearchX aria-hidden className="w-5 h-5 text-ink-2" />
            </span>
            <p className="mt-3 text-[15px] font-semibold text-ink">
              No trucks match
            </p>
            <p className="mt-1 text-[13px] text-ink-2">
              Check the ID, plate or driver name, or show every status.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                clearFilter();
              }}
              className="mt-4 h-9 px-4 rounded-full bg-ink text-white text-[13px] font-semibold hover:bg-ink/90 transition-colors"
            >
              Show all trucks
            </button>
          </div>
        ) : (
          <ul className="px-2 pb-3">
            {filtered.map((t) => (
              <li key={t.id}>
                <TruckRow truck={t} />
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
