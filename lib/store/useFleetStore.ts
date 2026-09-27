"use client";

import { create } from "zustand";
import type { Truck, TruckStatus } from "@/lib/types";

export type PanelState = "list" | "detail" | "collapsed";

interface FleetStore {
  trucks: Truck[];
  // Server-authoritative latest snapshot wall time (when the snapshot arrived)
  lastSnapshotAt: number;
  // Server clock of the latest snapshot, for client-side interpolation
  sampledAt: number;

  selectedId: string | null;
  panelState: PanelState;
  searchQuery: string;
  statusFilter: Set<TruckStatus>;
  followSelected: boolean;
  connected: boolean;
  hasEverConnected: boolean;

  applySnapshot: (s: {
    trucks: Truck[];
    sampledAt?: number;
  }) => void;

  setTrucks: (trucks: Truck[]) => void;
  selectTruck: (id: string | null) => void;
  setPanelState: (state: PanelState) => void;
  setSearchQuery: (q: string) => void;
  toggleStatusFilter: (status: TruckStatus) => void;
  clearStatusFilter: () => void;
  toggleFollow: () => void;
  setConnected: (c: boolean) => void;
}

export const useFleetStore = create<FleetStore>((set, get) => ({
  trucks: [],
  lastSnapshotAt: 0,
  sampledAt: 0,
  selectedId: null,
  panelState: "list",
  searchQuery: "",
  statusFilter: new Set(),
  followSelected: false,
  connected: false,
  hasEverConnected: false,

  applySnapshot: (s) =>
    set(() => {
      const now = Date.now();
      return {
        trucks: s.trucks,
        lastSnapshotAt: now,
        sampledAt: s.sampledAt ?? now,
      };
    }),

  setTrucks: (trucks) => set({ trucks }),
  selectTruck: (id) =>
    set({
      selectedId: id,
      panelState: id ? "detail" : get().panelState === "detail" ? "list" : get().panelState,
    }),
  setPanelState: (panelState) => set({ panelState }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleStatusFilter: (status) =>
    set((s) => {
      const next = new Set(s.statusFilter);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return { statusFilter: next };
    }),
  clearStatusFilter: () => set({ statusFilter: new Set() }),
  toggleFollow: () => set((s) => ({ followSelected: !s.followSelected })),
  setConnected: (connected) =>
    set((state) => ({
      connected,
      hasEverConnected: state.hasEverConnected || connected,
    })),
}));
