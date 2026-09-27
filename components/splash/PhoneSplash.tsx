"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Copy } from "lucide-react";
import { useStatusCounts } from "@/lib/hooks/useStatusCounts";
import {
  STATUS_COLOR_VARS,
  STATUS_LABELS,
  STATUS_ON_COLOR,
  STATUS_ORDER,
} from "@/lib/types";
import LiveIndicator from "@/components/dashboard/LiveIndicator";
import StatusIcon from "@/components/ui/StatusIcon";

export default function PhoneSplash() {
  const [copied, setCopied] = useState(false);
  const counts = useStatusCounts();

  const copy = async () => {
    if (typeof window === "undefined") return;
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-quay text-ink">
      <div className="min-h-full flex flex-col px-5 py-8 max-w-sm mx-auto">
        <div className="flex items-center gap-3">
          <Image
            src="/gpha-logo.png"
            alt="GPHA seal"
            width={48}
            height={48}
            unoptimized
            priority
          />
          <div>
            <div className="text-[19px] font-semibold leading-tight">
              Tema Port fleet
            </div>
            <div className="text-[13px] text-ink-2">
              Ghana Ports &amp; Harbours Authority
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h1 className="text-[15px] font-semibold">Right now</h1>
          <LiveIndicator />
        </div>

        <ul aria-label="Trucks by status" className="mt-3 flex flex-col gap-2">
          {STATUS_ORDER.map((status) => (
            <li
              key={status}
              className="flex items-center gap-3 h-14 pl-2.5 pr-5 rounded-2xl bg-[color-mix(in_srgb,var(--tone)_13%,white)]"
              style={
                {
                  "--tone": STATUS_COLOR_VARS[status],
                  "--on-tone": STATUS_ON_COLOR[status],
                } as React.CSSProperties
              }
            >
              <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-(--tone) text-(--on-tone)">
                <StatusIcon status={status} className="w-[18px] h-[18px]" />
              </span>
              <span className="text-[15px] font-medium">
                {STATUS_LABELS[status]}
              </span>
              <span className="ml-auto text-[24px] font-bold">{counts[status]}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-2xl bg-sheet p-4 shadow-float">
          <p className="text-[15px] font-semibold">The live map needs a bigger screen</p>
          <p className="mt-1 text-[14px] text-ink-2">
            Open this page on a laptop or tablet to follow trucks around the port.
          </p>
          <button
            type="button"
            onClick={copy}
            className="mt-4 w-full flex items-center justify-center gap-2 h-11 rounded-full bg-ink text-white text-[14px] font-semibold hover:bg-ink/90 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Link copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy link
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
