import portGraph from "@/data/port-graph.json";
import type { PortGraph, PortNode, TruckRoute } from "@/lib/types";
import { PortGraphIndex, routeToLineString } from "@/lib/simulator/pathing";
import { closestNode } from "@/lib/simulator/missionEngine";

// Client-side read-only view of the port graph, for labels and route lines.
export const portGraphIndex = new PortGraphIndex(portGraph as unknown as PortGraph);

export function portNode(id: string): PortNode | undefined {
  return portGraphIndex.node(id);
}

// Human name for a graph node id ("yard-b" → "Yard B").
export function nodeName(id: string): string {
  const node = portGraphIndex.node(id);
  if (node) return node.name;
  return id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function routeLine(
  route: Pick<TruckRoute, "originNodeId" | "waypointNodeIds">,
): [number, number][] {
  return routeToLineString(route, portGraphIndex);
}

export function nearestNodeName(lat: number, lng: number): string {
  return nodeName(closestNode(portGraphIndex, lat, lng));
}
