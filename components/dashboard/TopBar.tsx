"use client";

import Image from "next/image";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useFleetStore } from "@/lib/store/useFleetStore";
import StatusStrip from "./StatusStrip";
import LiveIndicator from "./LiveIndicator";
import SimClock from "./SimClock";

export default function TopBar() {
  const panelState = useFleetStore((s) => s.panelState);
  const setPanelState = useFleetStore((s) => s.setPanelState);
  const selectedId = useFleetStore((s) => s.selectedId);
  const collapsed = panelState === "collapsed";

  const togglePanel = () =>
    setPanelState(collapsed ? (selectedId ? "detail" : "list") : "collapsed");

  return (
    <header className="relative z-30 flex items-center h-16 shrink-0 pl-4 pr-3 gap-5 bg-sheet shadow-[0_1px_0_var(--edge)]">
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <Image
          src="/gpha-logo.png"
          alt="GPHA seal"
          width={40}
          height={40}
          unoptimized
          priority
        />
        <div className="flex flex-col min-w-0">
          <span className="text-[17px] font-semibold leading-tight text-ink truncate">
            Tema Port fleet
          </span>
          <span className="text-[12px] leading-tight text-ink-2 truncate">
            Ghana Ports &amp; Harbours Authority
          </span>
        </div>
      </div>

      <div className="hidden md:flex flex-1 justify-center min-w-0">
        <StatusStrip />
      </div>

      <div className="ml-auto flex items-center gap-3 shrink-0">
        <LiveIndicator />
        <SimClock />
        <button
          type="button"
          onClick={togglePanel}
          aria-pressed={!collapsed}
          aria-label={collapsed ? "Show truck list" : "Hide truck list"}
          title={collapsed ? "Show truck list" : "Hide truck list"}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-2 hover:text-ink hover:bg-tint transition-colors"
        >
          {collapsed ? (
            <PanelRightOpen className="w-[18px] h-[18px]" />
          ) : (
            <PanelRightClose className="w-[18px] h-[18px]" />
          )}
        </button>
      </div>
    </header>
  );
}
