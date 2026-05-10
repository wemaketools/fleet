import type { PortEdge } from "@/lib/types";
import type { PortGraphIndex } from "./pathing";

export const MIN_VEHICLE_SPACING_METERS = 28;

export interface SegmentOccupant {
  truckId: string;
  fromId: string;
  toId: string;
  progressMeters: number;
}

export function roadSegmentKey(fromId: string, toId: string): string {
  return [fromId, toId].sort().join("::");
}

export function occupiedRoadSegments(
  occupants: SegmentOccupant[],
  ignoredTruckId?: string,
): Set<string> {
  return new Set(
    occupants
      .filter((occupant) => occupant.truckId !== ignoredTruckId)
      .map((occupant) => roadSegmentKey(occupant.fromId, occupant.toId)),
  );
}

export function findPathAvoidingOccupiedSegments(
  graph: Pick<PortGraphIndex, "neighbors">,
  fromId: string,
  toId: string,
  occupiedSegments: Set<string>,
): string[] | null {
  if (fromId === toId) return [fromId];

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  dist.set(fromId, 0);

  while (true) {
    let current: string | null = null;
    let currentDist = Infinity;

    for (const [id, d] of dist) {
      if (!visited.has(id) && d < currentDist) {
        current = id;
        currentDist = d;
      }
    }

    if (!current) break;
    if (current === toId) break;
    visited.add(current);

    for (const { to, edge } of graph.neighbors(current)) {
      if (visited.has(to)) continue;
      if (occupiedSegments.has(roadSegmentKey(current, to))) continue;

      const candidate = currentDist + edgeLength(edge);
      if (candidate < (dist.get(to) ?? Infinity)) {
        dist.set(to, candidate);
        prev.set(to, current);
      }
    }
  }

  if (!dist.has(toId)) return null;

  const path: string[] = [toId];
  let cursor = toId;
  while (cursor !== fromId) {
    const previous = prev.get(cursor);
    if (!previous) return null;
    path.unshift(previous);
    cursor = previous;
  }
  return path;
}

export function constrainProgressForSpacing({
  truckId,
  fromId,
  toId,
  currentProgressMeters,
  desiredProgressMeters,
  edgeLengthMeters,
  occupants,
  minSpacingMeters = MIN_VEHICLE_SPACING_METERS,
}: {
  truckId: string;
  fromId: string;
  toId: string;
  currentProgressMeters: number;
  desiredProgressMeters: number;
  edgeLengthMeters: number;
  occupants: SegmentOccupant[];
  minSpacingMeters?: number;
}): number {
  let safeProgress = clamp(desiredProgressMeters, 0, edgeLengthMeters);

  for (const occupant of occupants) {
    if (occupant.truckId === truckId) continue;
    if (occupant.fromId !== fromId || occupant.toId !== toId) continue;
    if (occupant.progressMeters < currentProgressMeters) continue;

    const maxProgressBehindOccupant =
      clamp(occupant.progressMeters, 0, edgeLengthMeters) - minSpacingMeters;
    if (safeProgress > maxProgressBehindOccupant) {
      safeProgress = maxProgressBehindOccupant;
    }
  }

  return Math.max(currentProgressMeters, clamp(safeProgress, 0, edgeLengthMeters));
}

function edgeLength(edge: Pick<PortEdge, "lengthMeters">): number {
  return Number.isFinite(edge.lengthMeters) ? edge.lengthMeters : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
