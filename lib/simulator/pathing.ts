import type { PortGraph, PortNode, PortEdge } from "@/lib/types";

export class PortGraphIndex {
  readonly nodesById: Map<string, PortNode>;
  readonly adjacency: Map<string, Array<{ to: string; edge: PortEdge }>>;

  constructor(graph: PortGraph) {
    this.nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
    this.adjacency = new Map();
    for (const n of graph.nodes) this.adjacency.set(n.id, []);
    for (const e of graph.edges) {
      this.adjacency.get(e.fromNodeId)?.push({ to: e.toNodeId, edge: e });
      const reverse: PortEdge = {
        fromNodeId: e.toNodeId,
        toNodeId: e.fromNodeId,
        polyline: [...e.polyline].reverse(),
        lengthMeters: e.lengthMeters,
        isExternal: e.isExternal,
      };
      this.adjacency.get(e.toNodeId)?.push({ to: e.fromNodeId, edge: reverse });
    }
  }

  node(id: string): PortNode | undefined {
    return this.nodesById.get(id);
  }

  neighbors(id: string) {
    return this.adjacency.get(id) ?? [];
  }

  // Dijkstra by edge length. Returns ordered list of node IDs from→to inclusive,
  // or null if unreachable.
  shortestPath(fromId: string, toId: string): string[] | null {
    if (fromId === toId) return [fromId];
    const dist = new Map<string, number>();
    const prev = new Map<string, string>();
    const visited = new Set<string>();
    dist.set(fromId, 0);

    // Simple O(V^2) since V is tiny.
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
      for (const { to, edge } of this.neighbors(current)) {
        if (visited.has(to)) continue;
        const candidate = currentDist + edge.lengthMeters;
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
      const p = prev.get(cursor);
      if (!p) return null;
      path.unshift(p);
      cursor = p;
    }
    return path;
  }

  edgeBetween(fromId: string, toId: string): PortEdge | null {
    for (const { to, edge } of this.neighbors(fromId)) {
      if (to === toId) return edge;
    }
    return null;
  }
}

// Linear interpolation along a polyline. t in [0,1] -> [lng,lat]
export function pointAlong(
  polyline: [number, number][],
  t: number,
): { lng: number; lat: number; heading: number } {
  if (polyline.length === 0) return { lng: 0, lat: 0, heading: 0 };
  if (polyline.length === 1)
    return { lng: polyline[0][0], lat: polyline[0][1], heading: 0 };

  // Compute cumulative lengths
  const lengths: number[] = [0];
  let total = 0;
  for (let i = 1; i < polyline.length; i++) {
    const d = haversine(polyline[i - 1], polyline[i]);
    total += d;
    lengths.push(total);
  }
  if (total === 0)
    return { lng: polyline[0][0], lat: polyline[0][1], heading: 0 };
  const target = Math.min(Math.max(t, 0), 1) * total;
  let i = 1;
  while (i < lengths.length && lengths[i] < target) i++;
  if (i >= polyline.length) i = polyline.length - 1;
  const segStart = polyline[i - 1];
  const segEnd = polyline[i];
  const segLen = lengths[i] - lengths[i - 1];
  const segT = segLen > 0 ? (target - lengths[i - 1]) / segLen : 0;
  const lng = segStart[0] + (segEnd[0] - segStart[0]) * segT;
  const lat = segStart[1] + (segEnd[1] - segStart[1]) * segT;
  const heading = bearing(segStart, segEnd);
  return { lng, lat, heading };
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function bearing(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLng = toRad(b[0] - a[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
