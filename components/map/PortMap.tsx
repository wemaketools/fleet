"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Map as MapGL,
  AttributionControl,
  Source,
  Layer,
  type MapRef,
  type MapMouseEvent,
} from "react-map-gl/maplibre";
import type {
  FeatureCollection,
  Feature,
  LineString,
  Point,
  Polygon,
  Position,
} from "geojson";
import maplibregl from "maplibre-gl";
import {
  CLIENT_INTERPOLATION_MS,
  SELECTED_VEHICLE_DOT_RADIUS,
  VEHICLE_HALO_RADIUS,
  WAKE_LENGTH,
  WAKE_LINE_OPACITY,
  WAKE_LINE_WIDTH,
} from "@/lib/simulation-config";
import { useFleetStore, type PanelState } from "@/lib/store/useFleetStore";
import { useNow } from "@/lib/hooks/useNow";
import { portNode, routeLine } from "@/lib/port-graph";
import { lastSeenPhrase, statusSentence } from "@/lib/status-copy";
import { splitLineAt } from "@/lib/simulator/pathing";
import { STATUS_COLORS, type Truck } from "@/lib/types";
import portOverlay from "@/data/port-overlay.json";
import MapControls from "./MapControls";
import TruckAvatar from "@/components/ui/TruckAvatar";
import DriverAvatar from "@/components/ui/DriverAvatar";
import {
  GLYPH_PIXEL_RATIO,
  GLYPH_VIEWBOX_HEIGHT,
  GLYPH_VIEWBOX_WIDTH,
  OFFLINE_BADGE_SIZE,
  offlineBadgeSvg,
  svgDataUrl,
  truckGlyphSvg,
  truckSelectionSvg,
} from "./vehicleGlyphs";

const INITIAL_VIEW = {
  longitude: 0.006,
  latitude: 5.6315,
  zoom: 14.2,
};

const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

const LABEL_FONT = ["Noto Sans Bold"];
const INK = "#16324F";
const INK_2 = "#4A6178";
const WHITE = "#FFFFFF";

const TRUCK_ICON_TYPES = [
  "container_truck",
  "flatbed",
  "tanker",
  "terminal_tractor",
] satisfies Array<Truck["vehicleType"]>;

const OFFLINE_BADGE_ICON = "truck-offline-badge";

// Sources this component owns; everything else in the style is base map.
const OVERLAY_SOURCES = new Set([
  "port-overlay",
  "zone-shapes",
  "zone-labels",
  "container-stacks",
  "berths",
  "trucks",
  "wake",
  "pulse",
  "route",
]);

// Bottom → top. Zone labels sit above vehicles so trucks never cover them.
const VEHICLE_LAYER_ORDER = [
  "route-casing",
  "route-travelled",
  "route-remaining",
  "route-destination",
  "wake-line",
  "pulse-ring",
  "clusters",
  "cluster-count",
  "trucks-halo",
  "trucks-selection",
  "trucks-vehicle",
  "trucks-offline-badge",
  "trucks-id-label",
  "route-destination-label",
  "port-zone-labels",
  "port-berth-labels",
];

interface AnimState {
  from: Map<string, [number, number]>;
  to: Map<string, [number, number]>;
  startedAt: number;
  wake: Map<string, Array<[number, number]>>;
}

interface HoverInfo {
  id: string;
  x: number;
  y: number;
  // Map container size, for keeping the card on screen.
  width: number;
  height: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function distance(a: Position, b: Position) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function pointToward(from: Position, to: Position, amount: number): Position {
  const d = distance(from, to);
  if (d === 0) return [from[0], from[1]];
  const t = Math.min(1, amount / d);
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

// Softens polygon corners slightly so zones read as drawn areas, not boxes.
function roundedCornerPath(ring: Position[], radiusFactor = 0.08): Position[] {
  const corners = ring.slice(0, -1);
  if (corners.length < 3) return ring;

  const edgeLengths = corners.map((corner, index) =>
    distance(corner, corners[(index + 1) % corners.length]),
  );
  const radius = Math.min(...edgeLengths) * radiusFactor;
  const rounded: Position[] = [];

  corners.forEach((corner, index) => {
    const prev = corners[(index - 1 + corners.length) % corners.length];
    const next = corners[(index + 1) % corners.length];
    const start = pointToward(corner, prev, radius);
    const end = pointToward(corner, next, radius);

    for (let step = 0; step <= 6; step += 1) {
      const t = step / 6;
      const oneMinusT = 1 - t;
      rounded.push([
        oneMinusT * oneMinusT * start[0] +
          2 * oneMinusT * t * corner[0] +
          t * t * end[0],
        oneMinusT * oneMinusT * start[1] +
          2 * oneMinusT * t * corner[1] +
          t * t * end[1],
      ]);
    }
  });

  rounded.push(rounded[0]);
  return rounded;
}

const overlay = portOverlay as FeatureCollection;

function zonePolygons(): Feature<Polygon>[] {
  return overlay.features.filter(
    (f): f is Feature<Polygon> =>
      f.geometry.type === "Polygon" && f.properties?.kind === "yard",
  );
}

// Berths are stretches of quay edge where ships moor, drawn like a chart.
const berthLines: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: overlay.features.filter(
    (f): f is Feature<LineString> =>
      f.geometry.type === "LineString" && f.properties?.kind === "berth",
  ),
};

// Container stacks inside each yard, laid out along the yard's own axis the
// way a yard looks from above: rows of boxes with driving lanes between.
// Neutral ink tints on purpose, since colour on the map means truck status.
const STACK_LENGTH_M = 24;
const STACK_GAP_M = 5;
const STACK_DEPTH_M = 8;
const LANE_M = 6;
const EDGE_M = 7;

const containerStacks: FeatureCollection<Polygon> = (() => {
  const features: Feature<Polygon>[] = [];
  zonePolygons().forEach((yard, yardIndex) => {
    // Generator rectangles: r0→r1 runs along the yard, r0→r3 across it.
    const [r0, r1, , r3] = yard.geometry.coordinates[0];
    const kx = 111320 * Math.cos((r0[1] * Math.PI) / 180);
    const ky = 110540;
    const metres = (a: Position, b: Position) =>
      Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky);
    const lengthM = metres(r0, r1);
    const widthM = metres(r0, r3);
    const at = (alongM: number, acrossM: number): Position => {
      const u = alongM / lengthM;
      const v = acrossM / widthM;
      return [
        r0[0] + (r1[0] - r0[0]) * u + (r3[0] - r0[0]) * v,
        r0[1] + (r1[1] - r0[1]) * u + (r3[1] - r0[1]) * v,
      ];
    };
    const cols = Math.max(
      1,
      Math.floor((lengthM - 2 * EDGE_M + STACK_GAP_M) / (STACK_LENGTH_M + STACK_GAP_M)),
    );
    const rows = Math.max(
      1,
      Math.floor((widthM - 2 * EDGE_M + LANE_M) / (STACK_DEPTH_M + LANE_M)),
    );
    const usedL = cols * STACK_LENGTH_M + (cols - 1) * STACK_GAP_M;
    const usedW = rows * STACK_DEPTH_M + (rows - 1) * LANE_M;
    const startL = (lengthM - usedL) / 2;
    const startW = (widthM - usedW) / 2;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const a = startL + col * (STACK_LENGTH_M + STACK_GAP_M);
        const c = startW + row * (STACK_DEPTH_M + LANE_M);
        const corners = [
          at(a, c),
          at(a + STACK_LENGTH_M, c),
          at(a + STACK_LENGTH_M, c + STACK_DEPTH_M),
          at(a, c + STACK_DEPTH_M),
        ];
        features.push({
          type: "Feature",
          // Stable pseudo-random stack height, shown as a darker tint.
          properties: { tint: (yardIndex * 7 + row * 5 + col * 3) % 3 },
          geometry: { type: "Polygon", coordinates: [[...corners, corners[0]]] },
        });
      }
    }
  });
  return { type: "FeatureCollection", features };
})();

// Yards as softly rounded polygons (fill + outline share them).
const zoneShapes: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: zonePolygons().map((f) => ({
    type: "Feature",
    properties: f.properties,
    geometry: {
      type: "Polygon",
      coordinates: [roundedCornerPath(f.geometry.coordinates[0])],
    },
  })),
};

// One label point per zone at its most north-westerly corner (zones follow
// the quay, so they are rotated), keeping the sign clear of parked trucks.
const zoneLabels: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: zonePolygons().map((f) => {
    const ring = f.geometry.coordinates[0];
    const corner = ring.reduce((best, p) =>
      p[1] - p[0] > best[1] - best[0] ? p : best,
    );
    return {
      type: "Feature",
      properties: f.properties,
      geometry: { type: "Point", coordinates: [corner[0], corner[1]] },
    };
  }),
};

const PORT_BOUNDS: [[number, number], [number, number]] = (() => {
  const boundary = overlay.features.find(
    (f) => f.properties?.kind === "boundary",
  );
  const ring =
    boundary?.geometry.type === "Polygon"
      ? boundary.geometry.coordinates[0]
      : [[INITIAL_VIEW.longitude, INITIAL_VIEW.latitude]];
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
})();

// Extra room on the left keeps the zoom controls off the berths.
const PORT_FIT_PADDING = { top: 40, bottom: 40, left: 80, right: 40 };

// Width the floating panel covers, including its 12 px margins.
function panelOffset(panelState: PanelState) {
  if (panelState === "collapsed") return 88;
  return window.innerWidth >= 1024 ? 408 : 344;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Daylight harbour: harbour-blue water, pale concrete land, white roads and
// quiet labels so the trucks carry the colour.
function tintBaseStyle(map: maplibregl.Map) {
  for (const layer of map.getStyle().layers ?? []) {
    if ("source" in layer && OVERLAY_SOURCES.has(String(layer.source))) continue;
    const id = layer.id;

    if (layer.type === "background") {
      map.setPaintProperty(id, "background-color", "#EEF2F5");
    } else if (id === "water") {
      map.setPaintProperty(id, "fill-color", "#A9D8EA");
    } else if (id === "waterway") {
      map.setPaintProperty(id, "line-color", "#A9D8EA");
    } else if (id === "park" || id === "landcover_wood") {
      map.setPaintProperty(id, "fill-color", "#DCEBDF");
    } else if (id === "landuse_residential") {
      map.setPaintProperty(id, "fill-color", "#E6ECF0");
    } else if (id === "road_area_pier" || id === "road_pier") {
      map.setPaintProperty(id, layer.type === "fill" ? "fill-color" : "line-color", "#E1E8EE");
    } else if (id === "building") {
      map.setPaintProperty(id, "fill-color", "#E0E7EC");
      map.setPaintProperty(id, "fill-outline-color", "#D2DBE3");
    } else if (layer.type === "symbol") {
      map.setPaintProperty(id, "text-opacity", 0.55);
      map.setPaintProperty(id, "icon-opacity", 0.55);
      if (id.startsWith("label_")) {
        map.setLayerZoomRange(id, layer.minzoom ?? 0, 13);
      }
    }
  }
}

function truckIconId(
  vehicleType: Truck["vehicleType"],
  status: Truck["status"],
) {
  return `truck-vector-${vehicleType}-${status}`;
}

function truckSelectionIconId(vehicleType: Truck["vehicleType"]) {
  return `truck-selection-${vehicleType}`;
}

function addSvgImage(
  map: maplibregl.Map,
  id: string,
  markup: string,
  width: number,
  height: number,
) {
  if (map.hasImage(id)) return;
  const image = new Image(width * GLYPH_PIXEL_RATIO, height * GLYPH_PIXEL_RATIO);
  image.onload = () => {
    if (!map.hasImage(id)) {
      map.addImage(id, image, { pixelRatio: GLYPH_PIXEL_RATIO });
    }
  };
  image.src = svgDataUrl(markup);
}

function registerTruckImages(map: maplibregl.Map) {
  for (const vehicleType of TRUCK_ICON_TYPES) {
    for (const [status, color] of Object.entries(STATUS_COLORS) as Array<
      [Truck["status"], string]
    >) {
      addSvgImage(
        map,
        truckIconId(vehicleType, status),
        truckGlyphSvg(vehicleType, color),
        GLYPH_VIEWBOX_WIDTH,
        GLYPH_VIEWBOX_HEIGHT,
      );
    }
    addSvgImage(
      map,
      truckSelectionIconId(vehicleType),
      truckSelectionSvg(vehicleType),
      GLYPH_VIEWBOX_WIDTH,
      GLYPH_VIEWBOX_HEIGHT,
    );
  }
  addSvgImage(
    map,
    OFFLINE_BADGE_ICON,
    offlineBadgeSvg(STATUS_COLORS.offline),
    OFFLINE_BADGE_SIZE,
    OFFLINE_BADGE_SIZE,
  );
}

function buildTrucksGeoJson(
  trucks: Truck[],
  positions: Map<string, [number, number]>,
  selectedId: string | null,
  statusFilter: ReadonlySet<Truck["status"]>,
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: trucks.map((t) => {
      const pos = positions.get(t.id) ?? [
        t.currentLocation.lng,
        t.currentLocation.lat,
      ];
      const feature: Feature<Point> = {
        type: "Feature",
        id: t.id,
        properties: {
          id: t.id,
          status: t.status,
          color: STATUS_COLORS[t.status],
          heading: t.currentLocation.heading,
          vehicleType: t.vehicleType,
          vehicleIcon: truckIconId(t.vehicleType, t.status),
          selectionIcon: truckSelectionIconId(t.vehicleType),
          vehicleBearing: t.status === "in_transit" ? t.currentLocation.heading : 0,
          plate: t.plateNumber,
          driver: t.driver.name,
          selected: t.id === selectedId,
          // Faded when a status filter is on and this truck is not in it
          // (the selected truck always stays at full strength).
          muted:
            statusFilter.size > 0 &&
            !statusFilter.has(t.status) &&
            t.id !== selectedId,
        },
        geometry: { type: "Point", coordinates: pos },
      };
      return feature;
    }),
  };
}

function buildWakeGeoJson(
  trucks: Truck[],
  wake: Map<string, Array<[number, number]>>,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: trucks
      .filter((t) => t.status !== "offline")
      .map((t) => {
        const coords = wake.get(t.id) ?? [];
        return {
          type: "Feature",
          properties: {
            id: t.id,
            color: STATUS_COLORS[t.status],
          },
          geometry: {
            type: "LineString",
            coordinates: coords,
          },
        } as Feature;
      })
      .filter(
        (f) =>
          (f.geometry as { coordinates: Array<unknown> }).coordinates.length >=
          2,
      ),
  };
}

function buildPulseGeoJson(
  selected: Truck | null,
  positions: Map<string, [number, number]>,
): FeatureCollection<Point> {
  if (!selected) return { type: "FeatureCollection", features: [] };
  const pos = positions.get(selected.id) ?? [
    selected.currentLocation.lng,
    selected.currentLocation.lat,
  ];
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { color: STATUS_COLORS[selected.status] },
        geometry: { type: "Point", coordinates: pos },
      },
    ],
  };
}

const EMPTY_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

// Selected truck's route: faint travelled part, bold remaining part and a
// labelled destination ring.
function buildRouteGeoJson(
  selected: Truck | null,
  position: [number, number] | undefined,
  lineCache: { key: string; line: [number, number][] },
): FeatureCollection {
  const route = selected?.currentRoute;
  if (!selected || !route || selected.status !== "in_transit") {
    return EMPTY_COLLECTION;
  }

  const key = [route.originNodeId, ...route.waypointNodeIds].join(">");
  if (lineCache.key !== key) {
    lineCache.key = key;
    lineCache.line = routeLine(route);
  }
  if (lineCache.line.length < 2) return EMPTY_COLLECTION;

  const { travelled, remaining } = position
    ? splitLineAt(lineCache.line, position)
    : { travelled: [], remaining: lineCache.line };
  const color = STATUS_COLORS[selected.status];
  const destination = portNode(route.destinationNodeId);
  const features: Feature[] = [];

  if (travelled.length >= 2) {
    features.push({
      type: "Feature",
      properties: { kind: "travelled", color },
      geometry: { type: "LineString", coordinates: travelled },
    });
  }
  if (remaining.length >= 2) {
    features.push({
      type: "Feature",
      properties: { kind: "remaining", color },
      geometry: { type: "LineString", coordinates: remaining },
    });
  }
  if (destination) {
    features.push({
      type: "Feature",
      properties: { kind: "destination", color, name: destination.name },
      geometry: {
        type: "Point",
        coordinates: [destination.lng, destination.lat],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

// Keeps overlay layers stacked in VEHICLE_LAYER_ORDER above the base map.
// Cheap when already ordered, so it is safe to call every frame.
function bringVehicleLayersToFront(map: maplibregl.Map) {
  const present = VEHICLE_LAYER_ORDER.filter((id) => map.getLayer(id));
  const order = map.getLayersOrder();
  const tail = order.slice(order.length - present.length);
  if (tail.every((id, index) => id === present[index])) return;
  present.forEach((layerId) => map.moveLayer(layerId));
}

// Pick the status with the most members as a cluster's outline colour.
const STATUS_KEYS = Object.keys(STATUS_COLORS) as Truck["status"][];
const clusterDominantColor = (() => {
  const branches: unknown[] = [];
  STATUS_KEYS.forEach((status, index) => {
    const rest = STATUS_KEYS.slice(index + 1);
    if (rest.length === 0) return;
    branches.push(
      [
        "all",
        ...rest.map((other) => [">=", ["get", status], ["get", other]]),
      ],
      STATUS_COLORS[status],
    );
  });
  return [
    "case",
    ...branches,
    STATUS_COLORS[STATUS_KEYS[STATUS_KEYS.length - 1]],
  ] as unknown as maplibregl.ExpressionSpecification;
})();

// Icon scale grows with zoom; the selected vehicle is drawn 1.25× larger.
const vehicleIconSize = [
  "interpolate",
  ["linear"],
  ["zoom"],
  13,
  ["case", ["boolean", ["get", "selected"], false], 0.55, 0.44],
  16,
  ["case", ["boolean", ["get", "selected"], false], 0.92, 0.74],
] as unknown as maplibregl.ExpressionSpecification;

function HoverCard({
  truck,
  x,
  y,
  bounds,
}: {
  truck: Truck;
  x: number;
  y: number;
  bounds: { width: number; height: number };
}) {
  const now = useNow();
  const width = 240;
  const left = x + 16 + width > bounds.width ? x - 16 - width : x + 16;
  const top = y + 16 + 96 > bounds.height ? y - 16 - 96 : y + 16;
  const speed = Math.round(truck.currentLocation.speedKmh);

  let detail = statusSentence(truck);
  if (truck.status === "offline") {
    const seen = lastSeenPhrase(truck, now);
    if (seen) detail = `No signal ${seen}`;
  } else if (speed > 0) {
    detail += `, ${speed} km/h`;
  }

  return (
    <div
      className="pointer-events-none absolute z-10 flex gap-3 rounded-2xl bg-sheet p-3 shadow-float"
      style={{ left, top, width }}
    >
      <TruckAvatar vehicleType={truck.vehicleType} status={truck.status} size={40} />
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-ink">{truck.id}</div>
        <div className="flex items-center gap-1.5 text-[12px] text-ink-2 min-w-0">
          {truck.driver.photoUrl && (
            <DriverAvatar driver={truck.driver} size={16} className="ring-1" />
          )}
          <span className="truncate">{truck.driver.name}</span>
        </div>
        <div className="mt-0.5 text-[12px] text-ink truncate">{detail}</div>
      </div>
    </div>
  );
}

export default function PortMap() {
  const mapRef = useRef<MapRef | null>(null);
  const trucks = useFleetStore((s) => s.trucks);
  const prevTrucks = useFleetStore((s) => s.prevTrucks);
  const lastSnapshotAt = useFleetStore((s) => s.lastSnapshotAt);
  const selectedId = useFleetStore((s) => s.selectedId);
  const selectTruck = useFleetStore((s) => s.selectTruck);
  const followSelected = useFleetStore((s) => s.followSelected);
  const toggleFollow = useFleetStore((s) => s.toggleFollow);
  const panelState = useFleetStore((s) => s.panelState);
  const statusFilter = useFleetStore((s) => s.statusFilter);
  const selectedDestination = useFleetStore(
    (s) =>
      s.trucks.find((t) => t.id === s.selectedId)?.currentRoute
        ?.destinationNodeId ?? null,
  );

  const animRef = useRef<AnimState>({
    from: new Map(),
    to: new Map(),
    startedAt: 0,
    wake: new Map(),
  });
  const visibleRef = useRef<Map<string, [number, number]>>(new Map());
  const trucksRef = useRef<Truck[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const followRef = useRef<boolean>(false);
  const statusFilterRef = useRef<ReadonlySet<Truck["status"]>>(new Set());
  const lastFollowAtRef = useRef<number>(0);
  const routeCacheRef = useRef({ key: "", line: [] as [number, number][] });
  const [mapReady, setMapReady] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    trucksRef.current = trucks;
    selectedIdRef.current = selectedId;
    followRef.current = followSelected;
    statusFilterRef.current = statusFilter;
  }, [trucks, selectedId, followSelected, statusFilter]);

  // On new snapshot: snapshot current visible -> from, set new targets -> to,
  // push to wake history, reset animation start.
  useEffect(() => {
    if (trucks.length === 0) return;
    const anim = animRef.current;

    const newFrom = new Map<string, [number, number]>();
    const newTo = new Map<string, [number, number]>();
    for (const t of trucks) {
      const current = visibleRef.current.get(t.id);
      const prev = prevTrucks.find((p) => p.id === t.id);
      const fromPos: [number, number] = current
        ? current
        : prev
          ? [prev.currentLocation.lng, prev.currentLocation.lat]
          : [t.currentLocation.lng, t.currentLocation.lat];
      newFrom.set(t.id, fromPos);
      newTo.set(t.id, [t.currentLocation.lng, t.currentLocation.lat]);

      // Append to wake (only if moved meaningfully and not offline)
      const history = anim.wake.get(t.id) ?? [];
      const last = history[history.length - 1];
      const target: [number, number] = [
        t.currentLocation.lng,
        t.currentLocation.lat,
      ];
      const moved =
        !last ||
        Math.hypot(last[0] - target[0], last[1] - target[1]) > 1e-6;
      if (t.status !== "offline" && moved) {
        history.push(target);
        while (history.length > WAKE_LENGTH) history.shift();
        anim.wake.set(t.id, history);
      } else if (t.status === "offline") {
        anim.wake.set(t.id, []);
      }
    }
    anim.from = newFrom;
    anim.to = newTo;
    anim.startedAt = performance.now();

    // Update map sources immediately so markers are visible even before
    // the animation loop's next frame.
    const map = mapRef.current?.getMap();
    const trucksSrc = map?.getSource("trucks") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (trucksSrc) {
      trucksSrc.setData(
        buildTrucksGeoJson(
          trucks,
          newTo,
          selectedId,
          statusFilterRef.current,
        ) as unknown as GeoJSON.GeoJSON,
      );
    }

    const wakeSrc = map?.getSource("wake") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (wakeSrc)
      wakeSrc.setData(
        buildWakeGeoJson(trucks, anim.wake) as unknown as GeoJSON.GeoJSON,
      );
    if (map) bringVehicleLayersToFront(map);
  }, [trucks, prevTrucks, lastSnapshotAt, selectedId]);

  // RAF loop: interpolate, update truck + pulse sources, animate pulse radius.
  useEffect(() => {
    let raf = 0;
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const reducedMotion = prefersReducedMotion();

    const step = () => {
      const anim = animRef.current;
      const now = performance.now();
      const t = Math.max(
        0,
        Math.min(1, (now - anim.startedAt) / CLIENT_INTERPOLATION_MS),
      );

      const positions = new Map<string, [number, number]>();
      for (const truck of trucksRef.current) {
        const from = anim.from.get(truck.id);
        const to = anim.to.get(truck.id);
        if (!from || !to) {
          positions.set(truck.id, [
            truck.currentLocation.lng,
            truck.currentLocation.lat,
          ]);
        } else {
          positions.set(truck.id, [
            lerp(from[0], to[0], t),
            lerp(from[1], to[1], t),
          ]);
        }
      }
      visibleRef.current = positions;

      const trucksSrc = map.getSource("trucks") as
        | maplibregl.GeoJSONSource
        | undefined;
      if (trucksSrc) {
        trucksSrc.setData(
          buildTrucksGeoJson(
            trucksRef.current,
            positions,
            selectedIdRef.current,
            statusFilterRef.current,
          ) as unknown as GeoJSON.GeoJSON,
        );
      }
      bringVehicleLayersToFront(map);

      const selectedTruck =
        trucksRef.current.find((tr) => tr.id === selectedIdRef.current) ??
        null;

      const pulseSrc = map.getSource("pulse") as
        | maplibregl.GeoJSONSource
        | undefined;
      if (pulseSrc) {
        pulseSrc.setData(
          buildPulseGeoJson(
            selectedTruck,
            positions,
          ) as unknown as GeoJSON.GeoJSON,
        );
      }

      const routeSrc = map.getSource("route") as
        | maplibregl.GeoJSONSource
        | undefined;
      if (routeSrc) {
        routeSrc.setData(
          buildRouteGeoJson(
            selectedTruck,
            selectedTruck ? positions.get(selectedTruck.id) : undefined,
            routeCacheRef.current,
          ) as unknown as GeoJSON.GeoJSON,
        );
      }

      // Selected ring grows from SELECTED_VEHICLE_DOT_RADIUS to 2× every 1.6 s.
      if (selectedTruck && map.getLayer("pulse-ring")) {
        const pulsePhase = reducedMotion ? 0.35 : (now / 1600) % 1;
        const radius = SELECTED_VEHICLE_DOT_RADIUS * (1 + pulsePhase);
        map.setPaintProperty("pulse-ring", "circle-radius", radius);
        map.setPaintProperty(
          "pulse-ring",
          "circle-opacity",
          0.14 * (1 - pulsePhase),
        );
        map.setPaintProperty(
          "pulse-ring",
          "circle-stroke-opacity",
          0.85 * (1 - pulsePhase),
        );
      }

      if (map.getLayer("trucks-halo")) {
        const markerPhase = reducedMotion ? 0.5 : (now / 1800) % 1;
        map.setPaintProperty(
          "trucks-halo",
          "circle-radius",
          VEHICLE_HALO_RADIUS + markerPhase * 8,
        );
        map.setPaintProperty(
          "trucks-halo",
          "circle-opacity",
          0.2 * (1 - markerPhase),
        );
      }

      // Follow selected truck gently so the operator can keep spatial context.
      if (
        followRef.current &&
        selectedTruck &&
        now - lastFollowAtRef.current > 3000
      ) {
        const pos = positions.get(selectedTruck.id);
        if (pos) {
          map.easeTo({
            center: pos,
            duration: 1200,
            essential: true,
          });
          lastFollowAtRef.current = now;
        }
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [mapReady]);

  // The route's destination label already names its berth; hide the quay
  // label underneath so the two don't overprint.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapReady || !map.getLayer("port-berth-labels")) return;
    map.setFilter(
      "port-berth-labels",
      selectedDestination ? ["!=", ["get", "id"], selectedDestination] : null,
    );
  }, [selectedDestination, mapReady]);

  // Keep the map's visual centre clear of the side panel.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapReady) return;
    map.easeTo({
      padding: { top: 0, bottom: 0, left: 0, right: panelOffset(panelState) },
      duration: 300,
    });
  }, [panelState, mapReady]);

  // Pan to selected truck once when selection changes (initial focus)
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !selectedId) return;
    const truck = trucksRef.current.find((t) => t.id === selectedId);
    if (!truck) return;
    const pos = visibleRef.current.get(selectedId) ?? [
      truck.currentLocation.lng,
      truck.currentLocation.lat,
    ];
    map.easeTo({
      center: pos,
      zoom: Math.max(map.getZoom(), 15.2),
      duration: 800,
    });
  }, [selectedId]);

  const recentre = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (followRef.current) toggleFollow();
    map.fitBounds(PORT_BOUNDS, { padding: PORT_FIT_PADDING, duration: 700 });
  }, [toggleFollow]);

  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (delta > 0) map.zoomIn({ duration: 250 });
    else map.zoomOut({ duration: 250 });
  }, []);

  const onClick = useCallback(
    (e: MapMouseEvent) => {
      const f = e.features?.[0];
      const map = mapRef.current?.getMap();
      if (!f) {
        selectTruck(null);
        return;
      }
      if (f.layer.id === "clusters" && map) {
        const clusterId = f.properties?.cluster_id as number | undefined;
        const src = map.getSource("trucks") as
          | maplibregl.GeoJSONSource
          | undefined;
        if (clusterId != null && src) {
          src.getClusterExpansionZoom(clusterId).then((zoom: number) => {
            map.easeTo({
              center: (f.geometry as Point).coordinates as [number, number],
              zoom: zoom + 0.2,
              duration: 600,
            });
          }).catch(() => {});
        }
        return;
      }
      if (f.properties?.id) {
        selectTruck(String(f.properties.id));
      }
    },
    [selectTruck],
  );

  const onMouseMove = useCallback((e: MapMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    setMapReady(true);
    const f = e.features?.[0];
    if (!f || !["trucks-vehicle", "clusters"].includes(f.layer.id)) {
      if (hover) setHover(null);
      map.getCanvas().style.cursor = "default";
      return;
    }
    map.getCanvas().style.cursor = "pointer";
    if (f.layer.id === "clusters") {
      if (hover) setHover(null);
      return;
    }
    const canvas = map.getCanvas();
    setHover({
      id: String(f.properties?.id),
      x: e.point.x,
      y: e.point.y,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    });
  }, [hover]);

  const onMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = "default";
    setHover(null);
  }, []);

  const onLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    tintBaseStyle(map);
    registerTruckImages(map);

    if (!map.getSource("trucks")) {
      map.addSource("trucks", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 40,
        clusterProperties: Object.fromEntries(
          STATUS_KEYS.map((status) => [
            status,
            ["+", ["case", ["==", ["get", "status"], status], 1, 0]],
          ]),
        ),
      });
    }
    if (!map.getSource("wake")) {
      map.addSource("wake", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!map.getSource("pulse")) {
      map.addSource("pulse", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!map.getSource("route")) {
      map.addSource("route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getLayer("route-casing")) {
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        filter: ["==", ["get", "kind"], "remaining"],
        paint: {
          "line-color": WHITE,
          "line-width": 9,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (!map.getLayer("route-travelled")) {
      map.addLayer({
        id: "route-travelled",
        type: "line",
        source: "route",
        filter: ["==", ["get", "kind"], "travelled"],
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-opacity": 0.45,
          "line-dasharray": [1, 2],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (!map.getLayer("route-remaining")) {
      map.addLayer({
        id: "route-remaining",
        type: "line",
        source: "route",
        filter: ["==", ["get", "kind"], "remaining"],
        paint: {
          "line-color": ["get", "color"],
          "line-width": 5,
          "line-opacity": 1,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (!map.getLayer("route-destination")) {
      map.addLayer({
        id: "route-destination",
        type: "circle",
        source: "route",
        filter: ["==", ["get", "kind"], "destination"],
        paint: {
          "circle-radius": 7,
          "circle-color": WHITE,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 4,
        },
      });
    }
    if (!map.getLayer("route-destination-label")) {
      map.addLayer({
        id: "route-destination-label",
        type: "symbol",
        source: "route",
        filter: ["==", ["get", "kind"], "destination"],
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-anchor": "left",
          "text-offset": [1.1, 0],
          "text-font": LABEL_FONT,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": INK,
          "text-halo-color": WHITE,
          "text-halo-width": 2,
        },
      });
    }

    if (!map.getLayer("wake-line")) {
      map.addLayer({
        id: "wake-line",
        type: "line",
        source: "wake",
        paint: {
          "line-color": ["get", "color"],
          "line-width": WAKE_LINE_WIDTH,
          "line-opacity": WAKE_LINE_OPACITY,
          "line-blur": 0,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (!map.getLayer("pulse-ring")) {
      map.addLayer({
        id: "pulse-ring",
        type: "circle",
        source: "pulse",
        paint: {
          "circle-radius": SELECTED_VEHICLE_DOT_RADIUS,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.14,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.85,
          "circle-pitch-alignment": "map",
        },
      });
    }
    if (!map.getLayer("clusters")) {
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "trucks",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": WHITE,
          "circle-radius": 14,
          "circle-stroke-color": clusterDominantColor,
          "circle-stroke-width": 4,
        },
      });
    }
    if (!map.getLayer("cluster-count")) {
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "trucks",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": LABEL_FONT,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": INK,
        },
      });
    }
    if (!map.getLayer("trucks-halo")) {
      map.addLayer({
        id: "trucks-halo",
        type: "circle",
        source: "trucks",
        filter: [
          "all",
          ["!", ["has", "point_count"]],
          ["boolean", ["get", "selected"], false],
          ["!=", ["get", "status"], "in_transit"],
        ],
        paint: {
          "circle-radius": VEHICLE_HALO_RADIUS,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.18,
          "circle-blur": 0.45,
        },
      });
    }
    if (!map.getLayer("trucks-selection")) {
      map.addLayer({
        id: "trucks-selection",
        type: "symbol",
        source: "trucks",
        filter: [
          "all",
          ["!", ["has", "point_count"]],
          ["boolean", ["get", "selected"], false],
        ],
        layout: {
          "icon-image": ["get", "selectionIcon"],
          "icon-size": vehicleIconSize,
          "icon-rotate": ["get", "vehicleBearing"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
    }
    if (!map.getLayer("trucks-vehicle")) {
      map.addLayer({
        id: "trucks-vehicle",
        type: "symbol",
        source: "trucks",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": ["get", "vehicleIcon"],
          "icon-size": vehicleIconSize,
          "icon-rotate": ["get", "vehicleBearing"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "symbol-sort-key": [
            "case",
            ["boolean", ["get", "selected"], false],
            1,
            0,
          ],
        },
        paint: {
          "icon-opacity": [
            "case",
            ["boolean", ["get", "muted"], false],
            0.2,
            ["==", ["get", "status"], "offline"],
            0.6,
            1,
          ],
        },
      });
    }
    if (!map.getLayer("trucks-offline-badge")) {
      map.addLayer({
        id: "trucks-offline-badge",
        type: "symbol",
        source: "trucks",
        filter: [
          "all",
          ["!", ["has", "point_count"]],
          ["==", ["get", "status"], "offline"],
        ],
        layout: {
          "icon-image": OFFLINE_BADGE_ICON,
          "icon-size": 0.85,
          // 1 o'clock, clear of the glyph's cab.
          "icon-offset": [11, -17],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": ["case", ["boolean", ["get", "muted"], false], 0.2, 1],
        },
      });
    }
    if (!map.getLayer("trucks-id-label")) {
      map.addLayer({
        id: "trucks-id-label",
        type: "symbol",
        source: "trucks",
        filter: ["all", ["!", ["has", "point_count"]], ["boolean", ["get", "selected"], false]],
        layout: {
          "text-field": ["get", "id"],
          "text-size": 12,
          "text-offset": [0, 2],
          "text-anchor": "top",
          "text-font": LABEL_FONT,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": INK,
          "text-halo-color": WHITE,
          "text-halo-width": 2,
        },
      });
    }
    bringVehicleLayersToFront(map);

    map.setPadding({ top: 0, bottom: 0, left: 0, right: panelOffset(useFleetStore.getState().panelState) });
    map.fitBounds(PORT_BOUNDS, { padding: PORT_FIT_PADDING, duration: 0 });
    setMapReady(true);
  }, []);

  const hoverTruck = hover ? trucks.find((t) => t.id === hover.id) : undefined;

  return (
    <div className="absolute inset-0 bg-quay">
      <MapGL
        ref={mapRef}
        initialViewState={INITIAL_VIEW}
        mapStyle={MAP_STYLE}
        interactiveLayerIds={["trucks-vehicle", "clusters"]}
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onLoad={onLoad}
        cursor="default"
        attributionControl={false}
      >
        <AttributionControl
          position="bottom-left"
          compact
          customAttribution="Driver photos from Unsplash"
        />

        <Source id="port-overlay" type="geojson" data={overlay}>
          <Layer
            id="port-boundary-fill"
            type="fill"
            filter={["==", ["get", "kind"], "boundary"]}
            paint={{
              "fill-color": "rgba(255, 255, 255, 0.35)",
            }}
          />
          <Layer
            id="port-boundary-line"
            type="line"
            filter={["==", ["get", "kind"], "boundary"]}
            paint={{
              "line-color": "rgba(22, 50, 79, 0.4)",
              "line-width": 1.5,
              "line-dasharray": [3, 2],
            }}
          />
        </Source>
        <Source id="berths" type="geojson" data={berthLines}>
          {/* Quay edge: a slim ink bar with white bollard dots, then the
              berth name running along the quay like a street label. */}
          <Layer
            id="port-berths"
            type="line"
            layout={{ "line-cap": "round" }}
            paint={{
              "line-color": INK,
              "line-opacity": 0.7,
              "line-width": ["interpolate", ["linear"], ["zoom"], 13, 2, 16, 5],
            }}
          />
          <Layer
            id="port-berth-bollards"
            type="line"
            minzoom={14.5}
            layout={{ "line-cap": "round" }}
            paint={{
              "line-color": WHITE,
              "line-width": ["interpolate", ["linear"], ["zoom"], 14.5, 1.2, 16, 2],
              "line-dasharray": [0, 4],
            }}
          />
          <Layer
            id="port-berth-labels"
            type="symbol"
            minzoom={13.8}
            layout={{
              "symbol-placement": "line-center",
              "text-field": ["get", "name"],
              "text-size": ["interpolate", ["linear"], ["zoom"], 14, 9, 16, 11],
              "text-font": LABEL_FONT,
              "text-letter-spacing": 0.04,
              "text-offset": [0, 1.1],
              "text-keep-upright": true,
              "text-allow-overlap": true,
            }}
            paint={{
              "text-color": INK_2,
              "text-halo-color": WHITE,
              "text-halo-width": 1.5,
            }}
          />
        </Source>
        <Source id="zone-shapes" type="geojson" data={zoneShapes}>
          <Layer
            id="port-yards-fill"
            type="fill"
            filter={["==", ["get", "kind"], "yard"]}
            paint={{ "fill-color": "rgba(255, 255, 255, 0.6)" }}
          />
          <Layer
            id="port-yards"
            type="line"
            filter={["==", ["get", "kind"], "yard"]}
            layout={{ "line-join": "round" }}
            paint={{
              "line-color": "rgba(22, 50, 79, 0.22)",
              "line-width": 1,
            }}
          />
        </Source>
        <Source id="container-stacks" type="geojson" data={containerStacks}>
          <Layer
            id="port-yard-stacks"
            type="fill"
            paint={{
              "fill-color": INK,
              "fill-opacity": ["match", ["get", "tint"], 0, 0.1, 1, 0.16, 0.22],
            }}
          />
        </Source>
        <Source id="zone-labels" type="geojson" data={zoneLabels}>
          {/* Yard names as plain map text tucked into the top-left corner,
              matching the quay labels on the berths. */}
          <Layer
            id="port-zone-labels"
            type="symbol"
            minzoom={13.8}
            layout={{
              "text-field": ["get", "name"],
              "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 16, 12],
              "text-font": LABEL_FONT,
              "text-letter-spacing": 0.04,
              "text-anchor": "top-left",
              "text-offset": [0.6, 0.5],
              "text-allow-overlap": true,
              "symbol-sort-key": 0,
            }}
            paint={{
              "text-color": INK_2,
              "text-halo-color": WHITE,
              "text-halo-width": 2,
            }}
          />
        </Source>
      </MapGL>

      <MapControls
        className="absolute left-3 bottom-12 z-10"
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onRecentre={recentre}
      />

      {hover && hoverTruck && (
        <HoverCard
          truck={hoverTruck}
          x={hover.x}
          y={hover.y}
          bounds={{ width: hover.width, height: hover.height }}
        />
      )}
    </div>
  );
}
