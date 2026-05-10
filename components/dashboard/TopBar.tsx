"use client";

import Image from "next/image";
import { useFleetStore } from "@/lib/store/useFleetStore";
import StatusTiles from "./StatusTiles";
import SimClock from "./SimClock";

export default function TopBar() {
  const trucks = useFleetStore((s) => s.trucks);

  return (
    <header className="topbar-bg flex items-center h-14 px-4 border-b border-white/10 z-30 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 flex items-center justify-center shrink-0">
          <Image
            src="/gpha-logo.png"
            alt="GPHA"
            width={36}
            height={36}
            unoptimized
            priority
          />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[13px] font-semibold text-slate-100 tracking-tight">
            GPHA Cargo Tracker
          </span>
          <span className="text-[11px] text-slate-400 truncate">
            Tema Port · {trucks.length} trucks
          </span>
        </div>
      </div>

      <div className="ml-8 hidden lg:flex flex-1 justify-center">
        <StatusTiles />
      </div>

      <div className="ml-auto flex items-center gap-4 max-lg:gap-2">
        <SimClock />
      </div>
    </header>
  );
}
