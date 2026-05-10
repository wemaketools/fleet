"use client";

import { useEffect } from "react";
import { useFleetStore } from "@/lib/store/useFleetStore";
import type { Truck } from "@/lib/types";

interface StreamPayload {
  trucks: Truck[];
}

export function useFleetStream() {
  const applySnapshot = useFleetStore((s) => s.applySnapshot);
  const setConnected = useFleetStore((s) => s.setConnected);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    const onMessage = (e: MessageEvent<string>) => {
      try {
        const data = JSON.parse(e.data) as StreamPayload;
        applySnapshot(data);
      } catch (err) {
        console.error("stream parse error", err);
      }
    };
    es.addEventListener("snapshot", onMessage);
    es.addEventListener("update", onMessage);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    return () => {
      es.close();
      setConnected(false);
    };
  }, [applySnapshot, setConnected]);
}
