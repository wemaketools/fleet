"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Map as MapGL,
  NavigationControl,
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
  Position,
} from "geojson";
import maplibregl from "maplibre-gl";
import {
  CLIENT_INTERPOLATION_MS,
  VEHICLE_DOT_RADIUS,
  VEHICLE_HALO_RADIUS,
  WAKE_LENGTH,
  WAKE_LINE_OPACITY,
  WAKE_LINE_WIDTH,
} from "@/lib/simulation-config";
import { useFleetStore } from "@/lib/store/useFleetStore";
import { STATUS_COLORS, STATUS_LABELS, type Truck } from "@/lib/types";
import portOverlay from "@/data/port-overlay.json";

const INITIAL_VIEW = {
  longitude: 0.006,
  latitude: 5.6315,
  zoom: 14.2,
};

const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

const TRUCK_ICON_TYPES = [
  "container_truck",
  "flatbed",
  "tanker",
  "terminal_tractor",
] satisfies Array<Truck["vehicleType"]>;

interface AnimState {
  from: Map<string, [number, number]>;
  to: Map<string, [number, number]>;
  startedAt: number;
  wake: Map<string, Array<[number, number]>>;
}

interface HoverInfo {
  truck: Truck;
  x: number;
  y: number;
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

function roundedCornerPath(ring: Position[]): Position[] {
  const corners = ring.slice(0, -1);
  if (corners.length < 3) return ring;

  const edgeLengths = corners.map((corner, index) =>
    distance(corner, corners[(index + 1) % corners.length]),
  );
  const radius = Math.min(...edgeLengths) * 0.18;
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

function buildRoundedRegionBorders(
  overlay: FeatureCollection,
  kind: string,
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: overlay.features
      .filter((feature) => feature.properties?.kind === kind)
      .map((feature) => {
        if (feature.geometry.type !== "Polygon") return null;
        const ring = feature.geometry.coordinates[0];
        const roundedFeature: Feature<LineString> = {
          type: "Feature",
          properties: feature.properties,
          geometry: {
            type: "LineString",
            coordinates: roundedCornerPath(ring),
          },
        };
        return roundedFeature;
      })
      .filter((feature): feature is Feature<LineString> => feature !== null),
  };
}

function buildRoundedYardBorders(
  overlay: FeatureCollection,
): FeatureCollection<LineString> {
  return buildRoundedRegionBorders(overlay, "yard");
}

function buildRoundedBerthBorders(
  overlay: FeatureCollection,
): FeatureCollection<LineString> {
  return buildRoundedRegionBorders(overlay, "berth");
}

const roundedYardBorders = buildRoundedYardBorders(
  portOverlay as FeatureCollection,
);
const roundedBerthBorders = buildRoundedBerthBorders(
  portOverlay as FeatureCollection,
);

function truckIconId(
  vehicleType: Truck["vehicleType"],
  status: Truck["status"],
) {
  return `truck-vector-${vehicleType}-${status}`;
}

function truckBodySvg(vehicleType: Truck["vehicleType"], color: string) {
  switch (vehicleType) {
    case "flatbed":
      return `
        <rect x="17" y="7" width="30" height="26" rx="7" fill="${color}" />
        <rect x="14" y="36" width="36" height="44" rx="5" fill="#1F2937" />
        <path d="M19 45h26M19 58h26M19 71h26" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.9" />
      `;
    case "tanker":
      return `
        <rect x="17" y="7" width="30" height="25" rx="7" fill="${color}" />
        <rect x="13" y="36" width="38" height="45" rx="19" fill="#1F2937" />
        <path d="M22 58h20" stroke="${color}" stroke-width="4" stroke-linecap="round" opacity="0.9" />
      `;
    case "terminal_tractor":
      return `
        <rect x="16" y="8" width="32" height="32" rx="8" fill="${color}" />
        <rect x="20" y="44" width="24" height="30" rx="5" fill="#1F2937" />
        <path d="M24 54h16" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.9" />
      `;
    case "container_truck":
      return `
        <rect x="17" y="7" width="30" height="25" rx="7" fill="${color}" />
        <rect x="13" y="36" width="38" height="47" rx="5" fill="${color}" opacity="0.9" />
        <path d="M20 47h24M20 59h24M20 71h24" stroke="${color}" stroke-width="2.5" stroke-linecap="round" opacity="0.75" />
      `;
  }
}

function truckSvg(vehicleType: Truck["vehicleType"], color: string) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96">
      <path d="M32 2l9 12H23z" fill="${color}" stroke="${color}" stroke-width="2" />
      <rect x="10" y="6" width="44" height="82" rx="10" fill="#0F172A" stroke="${color}" stroke-width="3" />
      ${truckBodySvg(vehicleType, color)}
      <rect x="23" y="14" width="18" height="12" rx="3" fill="#E2E8F0" opacity="0.9" />
      <circle cx="11" cy="27" r="4.5" fill="#020617" />
      <circle cx="53" cy="27" r="4.5" fill="#020617" />
      <circle cx="11" cy="71" r="4.5" fill="#020617" />
      <circle cx="53" cy="71" r="4.5" fill="#020617" />
    </svg>
  `;
}

function registerTruckImages(map: maplibregl.Map) {
  for (const vehicleType of TRUCK_ICON_TYPES) {
    for (const [status, color] of Object.entries(STATUS_COLORS) as Array<
      [Truck["status"], string]
    >) {
      const id = truckIconId(vehicleType, status);
      if (map.hasImage(id)) continue;

      const image = new Image(64, 96);
      image.onload = () => {
        if (!map.hasImage(id)) {
          map.addImage(id, image, { pixelRatio: 2 });
        }
      };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        truckSvg(vehicleType, color),
      )}`;
    }
  }
}

function buildTrucksGeoJson(
  trucks: Truck[],
  positions: Map<string, [number, number]>,
  selectedId: string | null,
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
          vehicleBearing: t.status === "in_transit" ? t.currentLocation.heading : 0,
          plate: t.plateNumber,
          driver: t.driver.name,
          selected: t.id === selectedId,
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

function bringVehicleLayersToFront(map: maplibregl.Map) {
  [
    "wake-line",
    "pulse-ring",
    "clusters",
    "cluster-count",
    "trucks-halo",
    "trucks-vehicle",
    "trucks-id-label",
  ].forEach((layerId) => {
    if (map.getLayer(layerId)) map.moveLayer(layerId);
  });
}

export default function PortMap() {
  const mapRef = useRef<MapRef | null>(null);
  const trucks = useFleetStore((s) => s.trucks);
  const prevTrucks = useFleetStore((s) => s.prevTrucks);
  const lastSnapshotAt = useFleetStore((s) => s.lastSnapshotAt);
  const selectedId = useFleetStore((s) => s.selectedId);
  const selectTruck = useFleetStore((s) => s.selectTruck);
  const followSelected = useFleetStore((s) => s.followSelected);

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
  const lastFollowAtRef = useRef<number>(0);
  const [mapReady, setMapReady] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    trucksRef.current = trucks;
    selectedIdRef.current = selectedId;
    followRef.current = followSelected;
  }, [trucks, selectedId, followSelected]);

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

      if (selectedTruck && map.getLayer("pulse-ring")) {
        const pulsePhase = (now / 1600) % 1;
        const radius = VEHICLE_DOT_RADIUS + pulsePhase * 34;
        const opacity = 0.72 * (1 - pulsePhase);
        map.setPaintProperty("pulse-ring", "circle-radius", radius);
        map.setPaintProperty("pulse-ring", "circle-opacity", opacity);
      }

      if (map.getLayer("trucks-halo")) {
        const markerPhase = (now / 1800) % 1;
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

  // Pan to selected truck once when selection changes (initial focus)
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !selectedId) return;
    const truck = trucks.find((t) => t.id === selectedId);
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
  }, [selectedId, trucks]);

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
    const id = String(f.properties?.id);
    const truck = trucksRef.current.find((t) => t.id === id);
    if (!truck) return;
    setHover({ truck, x: e.point.x, y: e.point.y });
  }, [hover]);

  const onMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = "default";
    setHover(null);
  }, []);

  const onLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    registerTruckImages(map);

    if (!map.getSource("trucks")) {
      map.addSource("trucks", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 40,
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
          "circle-radius": 14,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.3,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.6,
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
          "circle-color": "rgba(30, 41, 59, 0.92)",
          "circle-radius": [
            "step",
            ["get", "point_count"],
            14,
            5,
            18,
            10,
            22,
          ],
          "circle-stroke-color": "#94A3B8",
          "circle-stroke-width": 1.2,
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
          "text-font": ["Noto Sans Bold"],
        },
        paint: {
          "text-color": "#E2E8F0",
          "text-halo-color": "#0B0F19",
          "text-halo-width": 1,
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
    if (!map.getLayer("trucks-vehicle")) {
      map.addLayer({
        id: "trucks-vehicle",
        type: "symbol",
        source: "trucks",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": ["get", "vehicleIcon"],
          "icon-size": [
            "case",
            ["boolean", ["get", "selected"], false],
            0.78,
            0.64,
          ],
          "icon-rotate": ["get", "vehicleBearing"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": [
            "case",
            ["==", ["get", "status"], "offline"],
            0.62,
            1,
          ],
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
          "text-size": 10,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-font": ["Noto Sans Bold"],
        },
        paint: {
          "text-color": "#E2E8F0",
          "text-halo-color": "#0B0F19",
          "text-halo-width": 1.5,
        },
      });
    }
    bringVehicleLayersToFront(map);
  }, []);

  return (
    <div className="absolute inset-0">
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
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="bottom-left" showCompass={false} />

        <Source
          id="port-overlay"
          type="geojson"
          data={portOverlay as FeatureCollection}
        >
          <Layer
            id="port-boundary-fill"
            type="fill"
            filter={["==", ["get", "kind"], "boundary"]}
            paint={{
              "fill-color": "#1E293B",
              "fill-opacity": 0.35,
            }}
          />
          <Layer
            id="port-boundary-line"
            type="line"
            filter={["==", ["get", "kind"], "boundary"]}
            paint={{
              "line-color": "#CE1126",
              "line-width": 1.5,
              "line-opacity": 0.7,
            }}
          />
          <Layer
            id="port-zone-labels"
            type="symbol"
            filter={[
              "any",
              ["==", ["get", "kind"], "berth"],
              ["==", ["get", "kind"], "yard"],
            ]}
            layout={{
              "text-field": ["get", "name"],
              "text-size": 11,
              "text-letter-spacing": 0.05,
              "text-font": ["Noto Sans Bold"],
            }}
            paint={{
              "text-color": "#E2E8F0",
              "text-halo-color": "#0B0F19",
              "text-halo-width": 1.2,
            }}
          />
        </Source>
        <Source
          id="berth-borders"
          type="geojson"
          data={roundedBerthBorders}
        >
          <Layer
            id="port-berths"
            type="line"
            layout={{
              "line-cap": "round",
              "line-join": "round",
            }}
            paint={{
              "line-color": "#60A5FA",
              "line-width": 1.4,
              "line-opacity": 0.375,
            }}
          />
        </Source>
        <Source
          id="yard-borders"
          type="geojson"
          data={roundedYardBorders}
        >
          <Layer
            id="port-yards"
            type="line"
            layout={{
              "line-cap": "round",
              "line-join": "round",
            }}
            paint={{
              "line-color": "#64748B",
              "line-width": 1.4,
              "line-opacity": 0.375,
            }}
          />
        </Source>
      </MapGL>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 panel-glass rounded-md border border-white/10 px-2.5 py-1.5 shadow-lg"
          style={{
            left: hover.x + 14,
            top: hover.y + 14,
            width: 200,
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: STATUS_COLORS[hover.truck.status] }}
            />
            <span className="font-mono text-[11px] font-semibold text-slate-100">
              {hover.truck.id}
            </span>
            <span className="font-mono text-[10px] text-slate-400 ml-auto">
              {hover.truck.plateNumber}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-300 truncate">
            {hover.truck.driver.name}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            {STATUS_LABELS[hover.truck.status]}
          </div>
        </div>
      )}
    </div>
  );
}
