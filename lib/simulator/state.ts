import portGraph from "@/data/port-graph.json";
import trucksSeed from "@/data/trucks-seed.json";
import { DEFAULT_SPEED_MULTIPLIER } from "@/lib/simulation-config";
import type {
  PortEdge,
  PortGraph,
  Truck,
  TruckStatus,
} from "@/lib/types";
import { PortGraphIndex, pointAlong } from "./pathing";
import {
  closestNode,
  generateMission,
  type Mission,
} from "./missionEngine";

export interface TruckSim {
  truck: Truck;
  mission?: Mission;
  // Status that the truck will adopt when its current dwell ends.
  postDwellStatus?: TruckStatus;
}

interface SimState {
  graph: PortGraphIndex;
  trucks: Map<string, TruckSim>;
  simTimeMs: number; // simulation clock
  speedMultiplier: number;
  lastTickWallMs: number; // last real-time tick timestamp
  started: boolean;
}

declare global {
  var __gphaSim: SimState | undefined;
}

const TICK_SPEED_INSIDE_KMH = 18; // inside the port
const TICK_SPEED_EXTERNAL_KMH = 60; // open road

const DWELL_AFTER_ARRIVAL_S: Record<TruckStatus, [number, number]> = {
  loading: [30, 80],
  unloading: [30, 70],
  idle: [60, 200],
  in_transit: [0, 0],
  offline: [0, 0],
};

export function getSim(): SimState {
  if (globalThis.__gphaSim) return globalThis.__gphaSim;

  const graph = new PortGraphIndex(portGraph as PortGraph);
  const trucks = new Map<string, TruckSim>();
  const seed = trucksSeed as Truck[];

  for (const t of seed) {
    const truck: Truck = JSON.parse(JSON.stringify(t));
    const sim: TruckSim = { truck };

    if (truck.status === "in_transit") {
      // Try to start a fresh in-transit mission from the closest node
      const startId = closestNode(
        graph,
        truck.currentLocation.lat,
        truck.currentLocation.lng,
      );
      const mission = generateMission(graph, truck, startId);
      if (mission) {
        sim.mission = mission;
        // Snap to the start of the first edge for consistency
        const node = graph.node(startId);
        if (node) {
          truck.currentLocation.lat = node.lat;
          truck.currentLocation.lng = node.lng;
        }
      } else {
        truck.status = "idle";
      }
    } else if (truck.status === "offline") {
      // stays offline at seed position
    } else {
      // Dwelling at nearest named node
      const nodeId = closestNode(
        graph,
        truck.currentLocation.lat,
        truck.currentLocation.lng,
      );
      const node = graph.node(nodeId);
      if (node) {
        truck.currentLocation.lat = node.lat;
        truck.currentLocation.lng = node.lng;
        truck.lastStopped.locationName = node.name;
        truck.lastStopped.lat = node.lat;
        truck.lastStopped.lng = node.lng;
      }
      // Give a short initial dwell so they move into action soon
      const [minS, maxS] = DWELL_AFTER_ARRIVAL_S[truck.status] ?? [30, 60];
      const dwellSec = minS + Math.random() * (maxS - minS);
      sim.mission = {
        path: [nodeId],
        segmentIndex: 0,
        edgeProgressMeters: 0,
        dwellUntilSim: Date.now() + dwellSec * 1000,
      };
    }
    trucks.set(truck.id, sim);
  }

  globalThis.__gphaSim = {
    graph,
    trucks,
    simTimeMs: Date.now(),
    speedMultiplier: DEFAULT_SPEED_MULTIPLIER,
    lastTickWallMs: Date.now(),
    started: false,
  };
  return globalThis.__gphaSim;
}

export function speedFor(edge: PortEdge): number {
  return edge.isExternal ? TICK_SPEED_EXTERNAL_KMH : TICK_SPEED_INSIDE_KMH;
}

export function dwellRangeFor(status: TruckStatus): [number, number] {
  return DWELL_AFTER_ARRIVAL_S[status] ?? [30, 80];
}

export { pointAlong };
