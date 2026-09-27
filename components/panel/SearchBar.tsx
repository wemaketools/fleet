"use client";

import { Search, X } from "lucide-react";
import { useFleetStore } from "@/lib/store/useFleetStore";

export default function SearchBar() {
  const query = useFleetStore((s) => s.searchQuery);
  const setQuery = useFleetStore((s) => s.setSearchQuery);

  return (
    <div className="relative">
      <Search
        aria-hidden
        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none"
      />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find a truck, plate or driver"
        aria-label="Find a truck by ID, plate or driver"
        className="w-full h-11 pl-10 pr-10 rounded-full bg-tint text-[14px] text-ink placeholder:text-ink-3 outline-none focus-visible:outline-none focus:bg-white focus:ring-2 focus:ring-ink transition-colors [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-ink-2 hover:text-ink hover:bg-tint-2"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
