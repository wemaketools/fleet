// Builds data/port-graph.json and data/port-overlay.json from real
// OpenStreetMap roads around Tema Port, so simulated trucks drive on the
// same streets the base map draws (never across the harbour basin).
//
//   node scripts/build-port-graph.mjs            # use the cached extract
//   node scripts/build-port-graph.mjs --refresh  # re-download from Overpass
//
// Road data © OpenStreetMap contributors, ODbL.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const EXTRACT = join(root, "data/osm/tema-roads.json");
const BBOX = [5.618, -0.01, 5.652, 0.026]; // south, west, north, east
const PORT_WAY_ID = 941509331; // landuse=industrial + industrial=port

// Places the simulator knows about, anchored near real roads (`bearing`
// overrides the zone outline's direction where the road runs across it). Each anchor is
// snapped to the closest drivable OSM node. Ids stay stable for the seed data.
const PLACES = [
  { id: "gate-1", name: "Gate 1", kind: "gate", at: [5.6345, 0.0083] },
  { id: "gate-2", name: "Gate 2", kind: "gate", at: [5.6305, 0.0052] },
  { id: "gate-3", name: "Gate 3", kind: "gate", at: [5.6262, 0.0038] },
  { id: "gate-4", name: "Gate 4", kind: "gate", at: [5.6257, -0.0037] },
  { id: "gate-5", name: "Gate 5 (East)", kind: "gate", at: [5.6366, 0.0094] },

  { id: "berth-1", name: "Berth 1", kind: "berth", at: [5.6278, 0.0068], dwellTimeRange: [40, 100] },
  { id: "berth-2", name: "Berth 2", kind: "berth", at: [5.6302, 0.0086], dwellTimeRange: [40, 100] },
  { id: "berth-3", name: "Berth 3", kind: "berth", at: [5.6326, 0.0104], dwellTimeRange: [40, 100] },
  { id: "berth-4", name: "Berth 4", kind: "berth", at: [5.6262, 0.0088], dwellTimeRange: [40, 100] },

  { id: "yard-a", name: "Yard A", kind: "yard", at: [5.6256, 0.0005], dwellTimeRange: [30, 80], bearing: 88 },
  { id: "yard-b", name: "Yard B", kind: "yard", at: [5.629, 0.0068], dwellTimeRange: [30, 80] },
  { id: "yard-c", name: "Yard C", kind: "yard", at: [5.6313, 0.0075], dwellTimeRange: [30, 80] },
  { id: "yard-d", name: "Yard D", kind: "yard", at: [5.6334, 0.0098], dwellTimeRange: [30, 80] },
  { id: "yard-e", name: "Yard E", kind: "yard", at: [5.6341, 0.01], dwellTimeRange: [30, 80] },

  { id: "weighbridge-1", name: "Weighbridge", kind: "weighbridge", at: [5.6336, 0.0078], dwellTimeRange: [10, 30] },
  { id: "customs", name: "Customs", kind: "customs", at: [5.634, 0.004], dwellTimeRange: [20, 60] },
  { id: "fuel", name: "Fuel Depot", kind: "fuel", at: [5.6285, 0.0052], dwellTimeRange: [15, 40] },
  { id: "parking", name: "Parking", kind: "parking", at: [5.625, -0.002], dwellTimeRange: [60, 200] },

  { id: "ext-accra", name: "Accra (N1)", kind: "external", at: [5.649, 0.002] },
  { id: "ext-akosombo", name: "Akosombo Hwy", kind: "external", at: [5.65, 0.0236] },
];

// Zone outlines drawn on the map: [lengthM along the road, widthM across].
const ZONE_SIZE = { berth: [140, 40], yard: [120, 70] };
const YARD_A_SIZE = [360, 120];

const DRIVABLE = new Set([
  "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link",
  "tertiary", "tertiary_link", "unclassified", "residential", "service", "living_street",
]);
// Trucks prefer main roads and port service roads over side streets.
const COST = { residential: 3, living_street: 4, unclassified: 1.6 };

// ------------------------------------------------------------------ helpers

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

const round6 = (n) => Math.round(n * 1e6) / 1e6;

// Douglas-Peucker in local metres; keeps shapes, drops redundant vertices.
function simplify(points, toleranceM) {
  if (points.length <= 2) return points;
  const [ox, oy] = points[0];
  const kx = 111320 * Math.cos((oy * Math.PI) / 180);
  const ky = 110540;
  const xy = points.map(([lng, lat]) => [(lng - ox) * kx, (lat - oy) * ky]);
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    const [ax, ay] = xy[s];
    const [bx, by] = xy[e];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((bx - ax) * (ay - xy[i][1]) - (ax - xy[i][0]) * (by - ay)) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > toleranceM && idx > 0) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// Rectangle centred on `center` ([lng, lat]), long side along `bearingDeg`.
function rectangle(center, bearingDeg, lengthM, widthM) {
  const [lng, lat] = center;
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  const b = (bearingDeg * Math.PI) / 180;
  const along = [Math.sin(b), Math.cos(b)]; // east, north
  const across = [Math.cos(b), -Math.sin(b)];
  const corner = (sa, sc) => {
    const e = along[0] * sa * (lengthM / 2) + across[0] * sc * (widthM / 2);
    const n = along[1] * sa * (lengthM / 2) + across[1] * sc * (widthM / 2);
    return [round6(lng + e / kx), round6(lat + n / ky)];
  };
  const ring = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  return [...ring, ring[0]];
}

function bearing(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x =
    Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ------------------------------------------------------------------ data

async function download() {
  const [s, w, n, e] = BBOX;
  const query = `[out:json][timeout:120];(way["highway"](${s},${w},${n},${e});way(${PORT_WAY_ID}););out geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": "gpha-cargo-tracker/1.0" },
    body: new URLSearchParams({ data: query }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = await res.json();
  // Keep only what the builder needs, so the cached extract stays small.
  const ways = json.elements
    .filter((el) => el.type === "way" && el.geometry)
    .filter((el) => el.id === PORT_WAY_ID || DRIVABLE.has(el.tags?.highway))
    .map((el) => ({
      id: el.id,
      hw: el.tags.highway ?? null,
      name: el.tags.name ?? null,
      nodes: el.nodes,
      coords: el.geometry.map((p) => [round6(p.lon), round6(p.lat)]),
    }));
  writeFileSync(
    EXTRACT,
    JSON.stringify({
      source: "© OpenStreetMap contributors, ODbL. Fetched via Overpass API.",
      fetchedAt: new Date().toISOString(),
      bbox: BBOX,
      ways,
    }),
  );
  return ways;
}

async function loadWays() {
  if (process.argv.includes("--refresh") || !existsSync(EXTRACT)) {
    return download();
  }
  return JSON.parse(readFileSync(EXTRACT, "utf8")).ways;
}

// ------------------------------------------------------------------ build

const ways = await loadWays();
const portWay = ways.find((w) => w.id === PORT_WAY_ID);
if (!portWay) throw new Error("Port outline missing from extract");

// Road graph keyed by OSM node id.
const coordOf = new Map();
const adj = new Map();
function link(a, b, cost) {
  if (!adj.has(a)) adj.set(a, []);
  adj.get(a).push({ to: b, cost });
}
for (const way of ways) {
  if (!way.hw) continue;
  const factor = COST[way.hw] ?? 1;
  way.nodes.forEach((id, i) => coordOf.set(id, way.coords[i]));
  for (let i = 1; i < way.nodes.length; i++) {
    const a = way.nodes[i - 1];
    const b = way.nodes[i];
    const d = haversine(way.coords[i - 1], way.coords[i]);
    link(a, b, d * factor);
    link(b, a, d * factor);
  }
}

// Largest connected component only, so every place can reach every other.
const component = (() => {
  const seen = new Set();
  let best = new Set();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const comp = new Set([start]);
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const cur = queue.pop();
      for (const { to } of adj.get(cur) ?? []) {
        if (!seen.has(to)) {
          seen.add(to);
          comp.add(to);
          queue.push(to);
        }
      }
    }
    if (comp.size > best.size) best = comp;
  }
  return best;
})();

function snap([lat, lng]) {
  let bestId = null;
  let bestD = Infinity;
  for (const id of component) {
    const d = haversine([lng, lat], coordOf.get(id));
    if (d < bestD) {
      bestD = d;
      bestId = id;
    }
  }
  return { id: bestId, offsetM: bestD };
}

function dijkstra(from) {
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const done = new Set();
  // Binary heap of [dist, id].
  const heap = [[0, from]];
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, cur] = pop();
    if (done.has(cur)) continue;
    done.add(cur);
    for (const { to, cost } of adj.get(cur) ?? []) {
      const nd = d + cost;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, cur);
        push([nd, to]);
      }
    }
  }
  return { prev, dist };
}

function pathTo(prev, from, to) {
  const path = [to];
  let cur = to;
  while (cur !== from) {
    cur = prev.get(cur);
    if (cur === undefined) return null;
    path.unshift(cur);
  }
  return path;
}

const places = PLACES.map((p) => {
  const { id: osmId, offsetM } = snap(p.at);
  if (offsetM > 60) {
    console.warn(`! ${p.id} snapped ${offsetM.toFixed(0)} m from its anchor`);
  }
  return { ...p, osmId, coord: coordOf.get(osmId) };
});

// Connect two places only when no third place lies (nearly) on the way
// between them: neither beside the road path nor as a cheap detour. This
// yields the road network's natural topology without hand-listing edges,
// and keeps separate edges from sharing the same stretch of road.
const NEAR_M = 30;
const DETOUR = 1.15;
const runs = places.map((p) => dijkstra(p.osmId));
const cost = (i, j) => runs[i].dist.get(places[j].osmId) ?? Infinity;
const edges = [];
for (let i = 0; i < places.length; i++) {
  const from = places[i];
  for (let j = i + 1; j < places.length; j++) {
    const to = places[j];
    const path = pathTo(runs[i].prev, from.osmId, to.osmId);
    if (!path) continue;
    const coords = path.map((id) => coordOf.get(id));
    const blocked = places.some(
      (other, k) =>
        other !== from &&
        other !== to &&
        (coords.some((c) => haversine(c, other.coord) < NEAR_M) ||
          cost(i, k) + cost(k, j) <= cost(i, j) * DETOUR),
    );
    if (blocked) continue;
    let length = 0;
    for (let k = 1; k < coords.length; k++) length += haversine(coords[k - 1], coords[k]);
    edges.push({
      fromNodeId: from.id,
      toNodeId: to.id,
      polyline: simplify(coords, 1.5).map(([lng, lat]) => [round6(lng), round6(lat)]),
      lengthMeters: Math.round(length),
      isExternal: from.kind === "external" || to.kind === "external",
    });
  }
}

const graph = {
  source: "Roads © OpenStreetMap contributors (ODbL). Generated by scripts/build-port-graph.mjs.",
  nodes: places.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    lat: p.coord[1],
    lng: p.coord[0],
    ...(p.dwellTimeRange ? { dwellTimeRange: p.dwellTimeRange } : {}),
  })),
  edges,
};

// Zone outlines follow the direction of the road at each berth / yard.
function roadBearingAt(osmId) {
  for (const way of ways) {
    if (!way.hw) continue;
    const i = way.nodes.indexOf(osmId);
    if (i === -1) continue;
    const a = way.coords[Math.max(0, i - 1)];
    const b = way.coords[Math.min(way.coords.length - 1, i + 1)];
    return bearing(a, b);
  }
  return 0;
}

// Closest point on the port outline to `pt`, in local metres around `pt`.
function nearestOnRing(pt, ring) {
  const kx = 111320 * Math.cos((pt[1] * Math.PI) / 180);
  const ky = 110540;
  const xy = ([lng, lat]) => [(lng - pt[0]) * kx, (lat - pt[1]) * ky];
  let best = { d: Infinity, x: 0, y: 0 };
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = xy(ring[i - 1]);
    const [bx, by] = xy(ring[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
    const x = ax + dx * t;
    const y = ay + dy * t;
    const d = Math.hypot(x, y);
    if (d < best.d) best = { d, x, y };
  }
  return { ...best, kx, ky };
}

// A berth is a stretch of quay edge: take the long side of its box that
// faces the water (nearest the port outline) and slide it onto the outline.
function quayLine(p, bearingDeg) {
  const [len, wid] = ZONE_SIZE.berth;
  const r = rectangle(p.coord, bearingDeg, len, wid);
  const sides = [
    [r[0], r[1]],
    [r[3], r[2]],
  ];
  const mid = ([a, b]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const [side] = sides
    .map((sd) => ({ sd, hit: nearestOnRing(mid(sd), portWay.coords) }))
    .sort((a, b) => a.hit.d - b.hit.d);
  const { x, y, kx, ky } = side.hit;
  return side.sd.map(([lng, lat]) => [round6(lng + x / kx), round6(lat + y / ky)]);
}

const zones = places
  .filter((p) => p.kind === "berth" || p.kind === "yard")
  .map((p) => {
    if (p.kind === "berth") {
      return {
        type: "Feature",
        properties: { kind: p.kind, name: p.name, id: p.id },
        geometry: {
          type: "LineString",
          coordinates: quayLine(p, p.bearing ?? roadBearingAt(p.osmId)),
        },
      };
    }
    const [len, wid] = p.id === "yard-a" ? YARD_A_SIZE : ZONE_SIZE[p.kind];
    return {
      type: "Feature",
      properties: { kind: p.kind, name: p.name, id: p.id },
      geometry: {
        type: "Polygon",
        coordinates: [
          rectangle(p.coord, p.bearing ?? roadBearingAt(p.osmId), len, wid),
        ],
      },
    };
  });

const overlay = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { kind: "boundary", name: "Tema Port" },
      geometry: { type: "Polygon", coordinates: [portWay.coords] },
    },
    ...zones,
  ],
};

writeFileSync(join(root, "data/port-graph.json"), JSON.stringify(graph, null, 1) + "\n");
writeFileSync(join(root, "data/port-overlay.json"), JSON.stringify(overlay, null, 1) + "\n");

console.log(`${graph.nodes.length} places, ${edges.length} road edges`);
for (const p of places) {
  const degree = edges.filter((e) => e.fromNodeId === p.id || e.toNodeId === p.id).length;
  console.log(`  ${p.id.padEnd(14)} degree ${degree}`);
}
