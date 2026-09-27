import portGraph from "@/data/port-graph.json";
import trucksSeed from "@/data/trucks-seed.json";
import { DEFAULT_SPEED_MULTIPLIER } from "@/lib/simulation-config";
import type {
  PortEdge,
  PortGraph,
  Truck,
  TruckRoute,
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
  // The graph data this state was built from. In dev, editing the port data
  // hot-reloads it as a new object, which forces a rebuild instead of trucks
  // driving an outdated road network.
  graphSource: unknown;
}

declare global {
  var __gphaSim: SimState | undefined;
}

// The seed file was authored as a snapshot taken at this moment. Its
// timestamps are rebased onto the boot time so "x min ago" reads correctly.
const SEED_CAPTURED_AT_MS = Date.parse("2026-05-10T14:23:00Z");

function shiftIso(iso: string, offsetMs: number): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? iso : new Date(ms + offsetMs).toISOString();
}

function rebaseSeedTimestamps(truck: Truck, offsetMs: number) {
  truck.lastStopped.timestamp = shiftIso(truck.lastStopped.timestamp, offsetMs);
  truck.lastUnloaded.timestamp = shiftIso(
    truck.lastUnloaded.timestamp,
    offsetMs,
  );
  if (truck.currentRoute) {
    truck.currentRoute.etaTimestamp = shiftIso(
      truck.currentRoute.etaTimestamp,
      offsetMs,
    );
  }
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
  if (globalThis.__gphaSim?.graphSource === portGraph) {
    return globalThis.__gphaSim;
  }

  const graph = new PortGraphIndex(portGraph as unknown as PortGraph);
  const trucks = new Map<string, TruckSim>();
  const seed = trucksSeed as Truck[];
  const bootMs = Date.now();
  const seedOffsetMs = bootMs - SEED_CAPTURED_AT_MS;

  for (const t of seed) {
    const truck: Truck = JSON.parse(JSON.stringify(t));
    const sim: TruckSim = { truck };
    rebaseSeedTimestamps(truck, seedOffsetMs);

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
        truck.currentRoute = routeSummary(
          graph,
          mission.path,
          DEFAULT_SPEED_MULTIPLIER,
          bootMs,
        );
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
      // Stays offline, parked at the nearest place so it sits on a road.
      const node = graph.node(
        closestNode(graph, truck.currentLocation.lat, truck.currentLocation.lng),
      );
      if (node) {
        truck.currentLocation.lat = node.lat;
        truck.currentLocation.lng = node.lng;
        truck.currentLocation.speedKmh = 0;
      }
      truck.lastSeenAt = truck.lastStopped.timestamp;
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
    graphSource: portGraph,
  };
  return globalThis.__gphaSim;
}

export function speedFor(edge: PortEdge): number {
  return edge.isExternal ? TICK_SPEED_EXTERNAL_KMH : TICK_SPEED_INSIDE_KMH;
}

// Estimated simulation time to drive `path` end to end.
export function estimateMissionMs(path: string[], graph: PortGraphIndex): number {
  let totalMs = 0;
  for (let i = 1; i < path.length; i++) {
    const edge = graph.edgeBetween(path[i - 1], path[i]);
    if (!edge) continue;
    const seconds = edge.lengthMeters / ((speedFor(edge) * 1000) / 3600);
    totalMs += seconds * 1000;
  }
  return totalMs;
}

// Client-facing route summary. The ETA is wall-clock time (the dashboard
// clock), so simulation time is divided back out by the speed multiplier.
export function routeSummary(
  graph: PortGraphIndex,
  path: string[],
  speedMultiplier: number,
  nowMs: number,
): TruckRoute {
  return {
    originNodeId: path[0],
    destinationNodeId: path[path.length - 1],
    waypointNodeIds: path.slice(1),
    etaTimestamp: new Date(
      nowMs + estimateMissionMs(path, graph) / speedMultiplier,
    ).toISOString(),
    progressPercent: 0,
  };
}

export function dwellRangeFor(status: TruckStatus): [number, number] {
  return DWELL_AFTER_ARRIVAL_S[status] ?? [30, 80];
}

export { pointAlong };
