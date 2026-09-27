import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);

// Both modules only use type imports, so they transpile standalone.
function loadModule(path) {
  const source = readFileSync(join(root, path), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const cjsModule = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: cjsModule.exports,
    module: cjsModule,
    require,
  });
  return cjsModule.exports;
}

const graphData = JSON.parse(
  readFileSync(join(root, "data/port-graph.json"), "utf8"),
);

test("routeToLineString chains edge polylines in travel order", () => {
  const { PortGraphIndex, routeToLineString } = loadModule(
    "lib/simulator/pathing.ts",
  );
  const graph = new PortGraphIndex(graphData);
  const path = graph.shortestPath("gate-1", "berth-4");
  assert.ok(path && path.length >= 3);

  const line = routeToLineString(
    { originNodeId: path[0], waypointNodeIds: path.slice(1) },
    graph,
  );
  const start = graph.node("gate-1");
  const end = graph.node("berth-4");
  assert.deepEqual(line[0], [start.lng, start.lat]);
  assert.deepEqual(line[line.length - 1], [end.lng, end.lat]);
  // Joints between edges are not duplicated.
  for (let i = 1; i < line.length; i++) {
    assert.notDeepEqual(line[i], line[i - 1]);
  }
});

test("splitLineAt divides a route at the vehicle's position", () => {
  const { splitLineAt } = loadModule("lib/simulator/pathing.ts");
  const line = [
    [0, 0],
    [10, 0],
    [10, 10],
  ];
  // Round-trip through JSON: arrays from the vm context have another realm's
  // prototype, which strict deep equality rejects.
  const { travelled, remaining } = JSON.parse(
    JSON.stringify(splitLineAt(line, [10, 4])),
  );
  assert.deepEqual(travelled, [
    [0, 0],
    [10, 0],
    [10, 4],
  ]);
  assert.deepEqual(remaining, [
    [10, 4],
    [10, 10],
  ]);
});

test("format helpers produce operator-friendly strings", () => {
  const {
    compassPoint,
    compassWord,
    formatAgo,
    formatDuration,
    formatHourMinute,
    formatLatLng,
  } = loadModule("lib/format.ts");

  assert.equal(compassPoint(0), "N");
  assert.equal(compassPoint(134), "SE");
  assert.equal(compassPoint(359), "N");
  assert.equal(compassPoint(-90), "W");
  assert.equal(compassWord(134), "south-east");
  assert.equal(formatDuration(12_000), "12 s");
  assert.equal(formatDuration(8 * 60_000), "8 min");
  assert.equal(formatDuration(82 * 60_000), "1 h 22 min");
  assert.equal(formatAgo(1_000, 3_000), "just now");
  assert.equal(formatAgo(0, 18 * 60_000), "18 min ago");
  // Port time is GMT regardless of the viewer's zone.
  assert.equal(formatHourMinute(Date.parse("2026-05-10T14:31:00Z")), "14:31");
  assert.equal(formatLatLng(5.6234, -0.0012), "5.6234° N, 0.0012° W");
});

function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a[1])) * Math.cos(toRad(b[1]));
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function insidePolygon([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

test("port graph edges follow road geometry between their nodes", () => {
  const nodes = new Map(graphData.nodes.map((n) => [n.id, n]));
  assert.ok(graphData.edges.length >= graphData.nodes.length);
  for (const edge of graphData.edges) {
    const from = nodes.get(edge.fromNodeId);
    const to = nodes.get(edge.toNodeId);
    assert.ok(from && to, `${edge.fromNodeId}-${edge.toNodeId} has both ends`);
    const line = edge.polyline;
    assert.deepEqual(line[0], [from.lng, from.lat]);
    assert.deepEqual(line[line.length - 1], [to.lng, to.lat]);
    let length = 0;
    for (let i = 1; i < line.length; i++) length += haversine(line[i - 1], line[i]);
    // Simplified polylines stay within a few metres of the road length.
    assert.ok(
      Math.abs(length - edge.lengthMeters) <= Math.max(10, edge.lengthMeters * 0.03),
      `${edge.fromNodeId}-${edge.toNodeId} length`,
    );
  }
});

test("port places sit inside the real port outline", () => {
  const overlay = JSON.parse(
    readFileSync(join(root, "data/port-overlay.json"), "utf8"),
  );
  const boundary = overlay.features.find((f) => f.properties.kind === "boundary");
  const ring = boundary.geometry.coordinates[0];
  // Exits lead out of the port, and Customs sits by the Longroom outside it.
  const outside = new Set(["ext-accra", "ext-akosombo", "customs"]);
  // Gates sit on the fence line, so they may be just either side of it.
  const nearFence = (p) =>
    ring.some((a, i) => {
      const b = ring[(i + 1) % ring.length];
      for (let t = 0; t <= 1; t += 0.05) {
        const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        if (haversine(p, q) < 40) return true;
      }
      return false;
    });
  for (const node of graphData.nodes) {
    if (outside.has(node.id)) continue;
    const p = [node.lng, node.lat];
    const ok = insidePolygon(p, ring) || (node.kind === "gate" && nearFence(p));
    assert.ok(ok, `${node.id} inside port`);
  }
  assert.match(graphData.source, /OpenStreetMap/);
});
