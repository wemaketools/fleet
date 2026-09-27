export type TruckStatus =
  | "idle"
  | "loading"
  | "in_transit"
  | "unloading"
  | "offline";

export type VehicleType =
  | "terminal_tractor"
  | "flatbed"
  | "tanker"
  | "container_truck";

export interface Driver {
  name: string;
  phone: string;
  photoUrl?: string;
  // Photographer credit for stock portraits (Unsplash requires attribution).
  photoCredit?: { name: string; url: string };
}

export interface TruckLocation {
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
}

export interface Cargo {
  type: "container" | "bulk" | "liquid" | "empty";
  description: string;
  weightTonnes: number;
  containerNumber?: string;
}

export interface StopRecord {
  locationName: string;
  lat: number;
  lng: number;
  timestamp: string;
}

export interface UnloadRecord {
  locationName: string;
  cargoDescription: string;
  timestamp: string;
}

export interface TruckRoute {
  originNodeId: string;
  destinationNodeId: string;
  waypointNodeIds: string[];
  etaTimestamp: string;
  progressPercent: number;
}

export interface Truck {
  id: string;
  plateNumber: string;
  vehicleType: VehicleType;
  driver: Driver;
  status: TruckStatus;
  currentLocation: TruckLocation;
  currentCargo: Cargo;
  lastStopped: StopRecord;
  lastUnloaded: UnloadRecord;
  currentRoute?: TruckRoute;
  // When the tracker last reported, set when a truck drops offline.
  lastSeenAt?: string;
}

export type PortNodeKind =
  | "gate"
  | "berth"
  | "yard"
  | "weighbridge"
  | "customs"
  | "fuel"
  | "parking"
  | "external";

export interface PortNode {
  id: string;
  name: string;
  kind: PortNodeKind;
  lat: number;
  lng: number;
  dwellTimeRange?: [number, number];
}

export interface PortEdge {
  fromNodeId: string;
  toNodeId: string;
  polyline: [number, number][];
  lengthMeters: number;
  isExternal: boolean;
}

export interface PortGraph {
  nodes: PortNode[];
  edges: PortEdge[];
}

// Hex values mirror the --status-* tokens in app/globals.css. MapLibre paint
// and the vehicle SVG sprites cannot read CSS variables, so these are the
// source for the map; DOM code should prefer STATUS_COLOR_VARS.
export const STATUS_COLORS: Record<TruckStatus, string> = {
  in_transit: "#2B6FE0",
  loading: "#FFA62B",
  unloading: "#0C8F87",
  idle: "#8C9CAD",
  offline: "#E5484D",
};

// Readable text colour on top of each status fill (container tiles, chips).
export const STATUS_ON_COLOR: Record<TruckStatus, string> = {
  in_transit: "#FFFFFF",
  loading: "#16324F",
  unloading: "#FFFFFF",
  idle: "#16324F",
  offline: "#FFFFFF",
};

export const STATUS_COLOR_VARS: Record<TruckStatus, string> = {
  in_transit: "var(--status-transit)",
  loading: "var(--status-loading)",
  unloading: "var(--status-unloading)",
  idle: "var(--status-idle)",
  offline: "var(--status-offline)",
};

// Plain words an operator would say out loud.
export const STATUS_LABELS: Record<TruckStatus, string> = {
  in_transit: "Moving",
  loading: "Loading",
  unloading: "Unloading",
  idle: "Parked",
  offline: "No signal",
};

export const STATUS_ORDER: TruckStatus[] = [
  "in_transit",
  "loading",
  "unloading",
  "idle",
  "offline",
];

export const STATUS_PRIORITY: Record<TruckStatus, number> = {
  in_transit: 0,
  loading: 1,
  unloading: 2,
  idle: 3,
  offline: 4,
};

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  container_truck: "Container truck",
  flatbed: "Flatbed",
  tanker: "Tanker",
  terminal_tractor: "Terminal tractor",
};
