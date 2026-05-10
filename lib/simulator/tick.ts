import type { PortNode, TruckStatus } from "@/lib/types";
import {
  constrainProgressForSpacing,
  findPathAvoidingOccupiedSegments,
  occupiedRoadSegments,
  roadSegmentKey,
  type SegmentOccupant,
} from "./collision";
import { generateMission } from "./missionEngine";
import { dwellRangeFor, getSim, pointAlong, speedFor } from "./state";

const OFFLINE_FLIP_PROB_PER_TICK = 0.002;
const ONLINE_FLIP_PROB_PER_TICK = 0.05;

function statusAfterArrival(node: PortNode | undefined): TruckStatus {
  if (!node) return "idle";
  switch (node.kind) {
    case "berth":
      return Math.random() < 0.5 ? "loading" : "unloading";
    case "yard":
      return Math.random() < 0.6 ? "loading" : "unloading";
    case "weighbridge":
    case "customs":
    case "fuel":
      return "loading";
    case "parking":
      return "idle";
    case "gate":
    case "external":
      return "idle";
  }
}

// Advance the simulation by `wallDtMs` of real time. Returns true if anything changed.
export function tickSim(wallDtMs: number): void {
  const sim = getSim();
  const simDtMs = wallDtMs * sim.speedMultiplier;
  sim.simTimeMs += simDtMs;
  sim.lastTickWallMs = Date.now();

  for (const ts of sim.trucks.values()) {
    const t = ts.truck;

    // Random offline/online flips (rare)
    if (t.status !== "offline" && Math.random() < OFFLINE_FLIP_PROB_PER_TICK) {
      t.status = "offline";
      t.currentLocation.speedKmh = 0;
      continue;
    }
    if (t.status === "offline") {
      if (Math.random() < ONLINE_FLIP_PROB_PER_TICK) {
        // Come back online idle at current spot
        t.status = "idle";
        const m = ts.mission;
        if (!m || m.path.length === 0) {
          // bootstrap a dwell at current pseudo-node
          const newMission = generateMission(sim.graph, t, m?.path[0] ?? "");
          if (newMission) ts.mission = newMission;
        }
      }
      continue;
    }

    const mission = ts.mission;
    if (!mission) continue;

    // Dwelling?
    if (mission.dwellUntilSim !== undefined) {
      if (sim.simTimeMs >= mission.dwellUntilSim) {
        mission.dwellUntilSim = undefined;
        // Either start a new mission or, if path has segments left, resume
        if (mission.segmentIndex >= mission.path.length) {
          const here = mission.path[mission.path.length - 1];
          const newMission = generateMission(sim.graph, t, here);
          if (newMission) {
            ts.mission = newMission;
            t.status = "in_transit";
            // populate currentRoute summary
            const destId = newMission.path[newMission.path.length - 1];
            const destNode = sim.graph.node(destId);
            t.currentRoute = {
              originNodeId: here,
              destinationNodeId: destId,
              waypointNodeIds: newMission.path.slice(1),
              etaTimestamp: new Date(
                sim.simTimeMs + estimateMissionMs(newMission, sim.graph),
              ).toISOString(),
              progressPercent: 0,
            };
            if (destNode) t.currentLocation.heading = 0;
          } else {
            t.status = "idle";
          }
        } else {
          t.status = "in_transit";
        }
      }
      // Still dwelling — no position change this tick
      continue;
    }

    if (mission.segmentIndex >= mission.path.length) continue;

    // Advance along current edge
    let fromId = mission.path[mission.segmentIndex - 1];
    let toId = mission.path[mission.segmentIndex];
    let edge = sim.graph.edgeBetween(fromId, toId);
    if (!edge) {
      // Broken segment — recover with a new mission
      const fallback = generateMission(sim.graph, t, fromId);
      if (fallback) ts.mission = fallback;
      continue;
    }

    const occupants = currentSegmentOccupants(sim, t.id);
    const occupiedSegments = occupiedRoadSegments(occupants, t.id);
    if (
      mission.edgeProgressMeters === 0 &&
      occupiedSegments.has(roadSegmentKey(fromId, toId))
    ) {
      const destinationId = mission.path[mission.path.length - 1];
      const reroute = findPathAvoidingOccupiedSegments(
        sim.graph,
        fromId,
        destinationId,
        occupiedSegments,
      );

      if (reroute && reroute.length >= 2) {
        mission.path = reroute;
        mission.segmentIndex = 1;
        mission.edgeProgressMeters = 0;
        fromId = mission.path[mission.segmentIndex - 1];
        toId = mission.path[mission.segmentIndex];
        edge = sim.graph.edgeBetween(fromId, toId);
        if (!edge) continue;

        if (t.currentRoute) {
          t.currentRoute.originNodeId = fromId;
          t.currentRoute.waypointNodeIds = reroute.slice(1);
          t.currentRoute.etaTimestamp = new Date(
            sim.simTimeMs + estimateMissionMs(mission, sim.graph),
          ).toISOString();
        }
      } else {
        // No safe alternate path exists, so wait at the node instead of
        // entering an occupied road segment.
        t.status = "in_transit";
        t.currentLocation.speedKmh = 0;
        continue;
      }
    }

    const speedKmh = speedFor(edge);
    const advanceM = ((speedKmh * 1000) / 3600) * (simDtMs / 1000);
    const previousProgressMeters = mission.edgeProgressMeters;
    mission.edgeProgressMeters = constrainProgressForSpacing({
      truckId: t.id,
      fromId,
      toId,
      currentProgressMeters: previousProgressMeters,
      desiredProgressMeters: previousProgressMeters + advanceM,
      edgeLengthMeters: edge.lengthMeters,
      occupants,
    });
    t.status = "in_transit";
    t.currentLocation.speedKmh = Math.round(
      speedForProgress(previousProgressMeters, mission.edgeProgressMeters, simDtMs),
    );

    if (mission.edgeProgressMeters === previousProgressMeters) {
      continue;
    }

    if (mission.edgeProgressMeters >= edge.lengthMeters) {
      // Arrived at toId
      const toNode = sim.graph.node(toId);
      if (toNode) {
        t.currentLocation.lat = toNode.lat;
        t.currentLocation.lng = toNode.lng;
        t.lastStopped = {
          locationName: toNode.name,
          lat: toNode.lat,
          lng: toNode.lng,
          timestamp: new Date(sim.simTimeMs).toISOString(),
        };
      }
      mission.edgeProgressMeters = 0;
      mission.segmentIndex += 1;

      if (mission.segmentIndex >= mission.path.length) {
        // Final destination — start dwell
        const arrivedStatus = statusAfterArrival(toNode);
        const [minS, maxS] = dwellRangeFor(arrivedStatus);
        const dwellSec = minS + Math.random() * Math.max(1, maxS - minS);
        mission.dwellUntilSim = sim.simTimeMs + dwellSec * 1000;
        t.status = arrivedStatus;
        t.currentLocation.speedKmh = 0;
        if (arrivedStatus === "unloading" && toNode) {
          t.lastUnloaded = {
            locationName: toNode.name,
            cargoDescription: t.currentCargo.description,
            timestamp: new Date(sim.simTimeMs).toISOString(),
          };
        }
        delete t.currentRoute;
      } else {
        // Still en route — update currentRoute progress
        if (t.currentRoute) {
          t.currentRoute.progressPercent = Math.min(
            99,
            Math.round(
              ((mission.segmentIndex - 1) / (mission.path.length - 1)) * 100,
            ),
          );
        }
      }
      continue;
    }

    // Mid-edge interpolation
    const t01 = mission.edgeProgressMeters / Math.max(1, edge.lengthMeters);
    const p = pointAlong(edge.polyline, t01);
    t.currentLocation.lat = p.lat;
    t.currentLocation.lng = p.lng;
    t.currentLocation.heading = Math.round(p.heading);

    if (t.currentRoute) {
      const totalSegs = mission.path.length - 1;
      const overall =
        (mission.segmentIndex - 1 + t01) / Math.max(1, totalSegs);
      t.currentRoute.progressPercent = Math.min(99, Math.round(overall * 100));
    }
  }
}

function estimateMissionMs(
  mission: { path: string[] },
  graph: ReturnType<typeof getSim>["graph"],
): number {
  let totalMs = 0;
  for (let i = 1; i < mission.path.length; i++) {
    const edge = graph.edgeBetween(mission.path[i - 1], mission.path[i]);
    if (!edge) continue;
    const speedKmh = speedFor(edge);
    const seconds = edge.lengthMeters / ((speedKmh * 1000) / 3600);
    totalMs += seconds * 1000;
  }
  return totalMs;
}

function currentSegmentOccupants(
  sim: ReturnType<typeof getSim>,
  ignoredTruckId?: string,
): SegmentOccupant[] {
  const occupants: SegmentOccupant[] = [];

  for (const candidate of sim.trucks.values()) {
    if (candidate.truck.id === ignoredTruckId) continue;
    const mission = candidate.mission;
    if (!mission || mission.dwellUntilSim !== undefined) continue;
    if (mission.segmentIndex <= 0 || mission.segmentIndex >= mission.path.length) {
      continue;
    }

    occupants.push({
      truckId: candidate.truck.id,
      fromId: mission.path[mission.segmentIndex - 1],
      toId: mission.path[mission.segmentIndex],
      progressMeters: mission.edgeProgressMeters,
    });
  }

  return occupants;
}

function speedForProgress(
  previousProgressMeters: number,
  nextProgressMeters: number,
  simDtMs: number,
): number {
  if (simDtMs <= 0) return 0;
  const metersPerSecond =
    (Math.max(0, nextProgressMeters - previousProgressMeters) / simDtMs) * 1000;
  return (metersPerSecond * 3600) / 1000;
}

export function snapshot() {
  const sim = getSim();
  return {
    simTime: new Date(sim.simTimeMs).toISOString(),
    speedMultiplier: sim.speedMultiplier,
    trucks: Array.from(sim.trucks.values()).map((s) => s.truck),
  };
}
