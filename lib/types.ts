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

export const STATUS_COLORS: Record<TruckStatus, string> = {
  in_transit: "#22C55E",
  loading: "#F59E0B",
  unloading: "#3B82F6",
  idle: "#EF4444",
  offline: "#D1D5DB",
};

export const STATUS_LABELS: Record<TruckStatus, string> = {
  in_transit: "In Transit",
  loading: "Loading",
  unloading: "Unloading",
  idle: "Idle",
  offline: "Offline",
};

export const STATUS_PRIORITY: Record<TruckStatus, number> = {
  in_transit: 0,
  loading: 1,
  unloading: 2,
  idle: 3,
  offline: 4,
};
