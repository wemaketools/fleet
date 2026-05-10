import type { PortNode, Truck, VehicleType } from "@/lib/types";
import { PortGraphIndex } from "./pathing";

export interface Mission {
  path: string[]; // node ids, including current position as first
  segmentIndex: number; // index of next-to-reach node in `path` (>=1)
  edgeProgressMeters: number;
  dwellUntilSim?: number; // ms since epoch (sim time); when set, truck dwells at path[segmentIndex-1]
}

const RNG = () => Math.random();

function pickRandom<T>(xs: readonly T[]): T {
  return xs[Math.floor(RNG() * xs.length)];
}

function nodesByKind(graph: PortGraphIndex, kinds: PortNode["kind"][]) {
  return Array.from(graph.nodesById.values()).filter((n) =>
    kinds.includes(n.kind),
  );
}

// Pick a plausible next destination node for a truck given its type and current position.
function pickDestination(
  graph: PortGraphIndex,
  truck: Truck,
  currentNodeId: string,
): string {
  const here = graph.node(currentNodeId);
  const vehicleType: VehicleType = truck.vehicleType;

  let candidates: PortNode[];
  switch (vehicleType) {
    case "terminal_tractor":
      // Stays inside the port: yards, berths, weighbridge
      candidates = nodesByKind(graph, ["yard", "berth", "weighbridge"]);
      break;
    case "tanker":
      candidates = nodesByKind(graph, ["fuel", "berth", "gate"]);
      break;
    case "flatbed":
      // Comes in via gate, loads at berth, exits to external
      if (here?.kind === "berth") {
        candidates = nodesByKind(graph, ["gate", "external"]);
      } else if (here?.kind === "external" || here?.kind === "gate") {
        candidates = nodesByKind(graph, ["berth"]);
      } else {
        candidates = nodesByKind(graph, ["berth", "gate"]);
      }
      break;
    case "container_truck":
    default:
      // Gate ↔ Yard ↔ Berth cycle
      if (here?.kind === "external") {
        candidates = nodesByKind(graph, ["gate"]);
      } else if (here?.kind === "gate") {
        candidates = nodesByKind(graph, ["yard", "weighbridge", "customs"]);
      } else if (here?.kind === "yard") {
        candidates = nodesByKind(graph, ["berth", "yard", "gate"]);
      } else if (here?.kind === "berth") {
        candidates = nodesByKind(graph, ["yard", "gate"]);
      } else {
        candidates = nodesByKind(graph, ["yard", "berth", "gate"]);
      }
      break;
  }

  candidates = candidates.filter((n) => n.id !== currentNodeId);
  if (candidates.length === 0) {
    candidates = Array.from(graph.nodesById.values()).filter(
      (n) => n.id !== currentNodeId,
    );
  }
  return pickRandom(candidates).id;
}

// Generate a fresh mission for a truck currently dwelling/idle at `currentNodeId`.
export function generateMission(
  graph: PortGraphIndex,
  truck: Truck,
  currentNodeId: string,
): Mission | null {
  for (let attempt = 0; attempt < 6; attempt++) {
    const destId = pickDestination(graph, truck, currentNodeId);
    const path = graph.shortestPath(currentNodeId, destId);
    if (path && path.length >= 2) {
      return { path, segmentIndex: 1, edgeProgressMeters: 0 };
    }
  }
  return null;
}

// Find the closest node in the graph to a given lat/lng (used to bootstrap missions from seed positions).
export function closestNode(
  graph: PortGraphIndex,
  lat: number,
  lng: number,
): string {
  let bestId = "";
  let bestD = Infinity;
  for (const n of graph.nodesById.values()) {
    const d = (n.lat - lat) ** 2 + (n.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      bestId = n.id;
    }
  }
  return bestId;
}
