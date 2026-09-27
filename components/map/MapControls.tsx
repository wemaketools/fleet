"use client";

import { Minus, Plus, Scan } from "lucide-react";
import { cn } from "@/lib/utils";

const button =
  "w-10 h-10 flex items-center justify-center text-ink hover:bg-tint transition-colors";

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onRecentre,
  className,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecentre: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col rounded-2xl bg-sheet shadow-float overflow-hidden">
        <button type="button" onClick={onZoomIn} className={button} aria-label="Zoom in" title="Zoom in">
          <Plus className="w-[18px] h-[18px]" />
        </button>
        <span aria-hidden className="mx-2.5 h-px bg-edge" />
        <button type="button" onClick={onZoomOut} className={button} aria-label="Zoom out" title="Zoom out">
          <Minus className="w-[18px] h-[18px]" />
        </button>
      </div>
      <button
        type="button"
        onClick={onRecentre}
        className={cn(button, "rounded-2xl bg-sheet shadow-float")}
        aria-label="Show the whole port"
        title="Show the whole port"
      >
        <Scan className="w-[18px] h-[18px]" />
      </button>
    </div>
  );
}
