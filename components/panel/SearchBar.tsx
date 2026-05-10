"use client";

import { Search } from "lucide-react";
import { useFleetStore } from "@/lib/store/useFleetStore";

export default function SearchBar() {
  const query = useFleetStore((s) => s.searchQuery);
  const setQuery = useFleetStore((s) => s.setSearchQuery);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search trucks…"
        className="w-full h-8 pl-8 pr-3 rounded-md bg-white/5 border border-white/10 text-[13px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-white/20 focus:bg-white/10 transition-colors"
      />
    </div>
  );
}
