"use client";

import { create } from "zustand";
import type { Truck, TruckStatus } from "@/lib/types";

export type PanelState = "list" | "detail" | "collapsed";

interface FleetStore {
  trucks: Truck[];
  // Server-authoritative latest snapshot wall time (when the snapshot arrived)
  lastSnapshotAt: number;
  // Previous trucks (for client-side interpolation between snapshots)
  prevTrucks: Truck[];

  selectedId: string | null;
  panelState: PanelState;
  searchQuery: string;
  statusFilter: Set<TruckStatus>;
  followSelected: boolean;
  connected: boolean;
  hasEverConnected: boolean;

  applySnapshot: (s: {
    trucks: Truck[];
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
  prevTrucks: [],
  lastSnapshotAt: 0,
  selectedId: null,
  panelState: "list",
  searchQuery: "",
  statusFilter: new Set(),
  followSelected: false,
  connected: false,
  hasEverConnected: false,

  applySnapshot: (s) =>
    set((state) => ({
      prevTrucks: state.trucks,
      trucks: s.trucks,
      lastSnapshotAt: Date.now(),
    })),

  setTrucks: (trucks) => set({ trucks, prevTrucks: trucks }),
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
