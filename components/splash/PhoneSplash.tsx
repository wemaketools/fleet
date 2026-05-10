"use client";

import { useState } from "react";
import Image from "next/image";
import { Copy, Check } from "lucide-react";

export default function PhoneSplash() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (typeof window === "undefined") return;
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-8 bg-[#0B0F19] text-slate-200">
      <div className="w-16 h-16 flex items-center justify-center mb-6">
        <Image
          src="/gpha-logo.png"
          alt="GPHA"
          width={64}
          height={64}
          unoptimized
          priority
        />
      </div>
      <h1 className="text-xl font-semibold text-slate-100 text-center">
        GPHA Cargo Tracker
      </h1>
      <p className="text-[13px] text-slate-400 text-center mt-1">
        Tema Port
      </p>
      <div className="my-8 h-px w-12 bg-white/10" />
      <p className="text-[13px] text-slate-300 text-center max-w-xs leading-relaxed">
        Best viewed on a desktop or tablet.
      </p>
      <button
        onClick={copy}
        className="mt-6 flex items-center gap-2 h-10 px-4 rounded-md bg-white/5 border border-white/10 text-[13px] text-slate-200 hover:bg-white/10 transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy link
          </>
        )}
      </button>
    </div>
  );
}
