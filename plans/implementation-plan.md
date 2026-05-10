# GPHA Cargo Truck Tracker — Implementation Plan

**Status**: Draft v1
**Owner**: ospinto@gmail.com
**Target**: Pitch-ready POC for Ghana Ports and Harbours Authority
**Effort**: ~5–7 working days solo

---

## 1. Goal & Non-Goals

### Goal
A web-based live operations dashboard showing simulated cargo trucks moving around Tema port in real time. Users can browse the fleet via a side panel, select any truck to see details (driver, cargo, location, route, history), and watch the dashboard update continuously. Architected so swapping the simulator for real GPS feeds is a one-file change.

### Non-goals (explicitly Phase 2)
- Auth / user accounts / roles
- Real GPS integration (live feed)
- Historical playback / replay (no persistence)
- Reports / analytics
- Alerts / notifications (push, email, SMS)
- Multi-port (Takoradi, port selector)
- Geofencing rules
- Cargo manifest / customs system integration
- Driver mobile app / two-way comms
- Internationalization
- Admin CRUD UI
- Sentry / production observability

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 16 App Router + TypeScript | Vercel-native, RSC, file-based routing |
| Hosting | Vercel (Fluid Compute) | Greenfield default; SSE-capable on Node.js runtime |
| Config | `vercel.ts` via `@vercel/config` | Typed, dynamic config |
| Styling | Tailwind CSS + shadcn/ui | Fast polished UI, no design system from scratch |
| State | Zustand | Lighter than Context, simpler than Redux |
| Map | MapLibre GL JS + `react-map-gl` | Open-source, vector, smooth marker animation, no API key |
| Tiles | Protomaps (free hosted) — dark style | No key, modern vector look |
| Realtime | Server-Sent Events (SSE) | Native on Vercel Fluid; one-way is sufficient |
| Persistence | None — in-memory | Cheapest possible POC |
| Runtime | Node.js 24 LTS (Vercel default) | Required for SSE module-level state |

**Cost target**: $0. No Marketplace integrations, no DB, no paid tiles.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  ┌───────────┐  ┌──────────────────┐  ┌─────────────────┐    │
│  │ Map (RMG) │  │  Side panel      │  │  Top bar        │    │
│  │ MapLibre  │  │  list / detail   │  │  KPI + clock    │    │
│  └─────▲─────┘  └────────▲─────────┘  └─────────────────┘    │
│        │                 │                                   │
│        └────────► Zustand store ◄────────────┐               │
│                          ▲                   │               │
│                          │ EventSource       │               │
│                  + requestAnimationFrame interpolation        │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           │ SSE
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Vercel Function (Fluid Compute, Node 24)                    │
│  app/api/stream/route.ts                                     │
│                                                              │
│  Module-scope state:                                         │
│    - Map<truckId, TruckState>                                │
│    - tick() runs every 5s                                    │
│    - Subscribers: Set<WritableStreamDefaultWriter>           │
│                                                              │
│  TruckLocationProvider (abstraction)                         │
│    └── SimulatorProvider  ← v1                               │
│    └── WebhookProvider    ← v2 (stub)                        │
│                                                              │
│  Mission engine:                                             │
│    - Reads port-graph.json                                   │
│    - Each truck has current mission (waypoint queue)         │
│    - On waypoint reach → status transition + new mission     │
└──────────────────────────────────────────────────────────────┘

Static assets (committed):
  - data/port-graph.json     (nodes + edges + boundary polygon)
  - data/port-overlay.geojson (berths, yards, gates as features)
  - data/trucks-seed.json    (25 trucks: identity, driver, initial mission)
```

### Why SSE + interpolation
Real GPS trackers ping every 10–60 sec. The simulator broadcasts every 5 sec (`tick`), the client smoothly animates between known positions via `requestAnimationFrame`. This mirrors real-world behavior and keeps server traffic minimal. Swapping to real GPS later means replacing the simulator's `tick()` with a webhook ingest handler — the broadcast pipeline is unchanged.

### Why no database
Demo runs in a single warm Fluid instance during the pitch. Page refresh during a cold start resets sim, which is acceptable. "Last stopped" / "last unloaded" are fields *on the truck state object*, updated when missions complete — no history table needed.

---

## 4. Data Model

```ts
// lib/types.ts

export type TruckStatus = 'idle' | 'loading' | 'in_transit' | 'unloading' | 'offline';

export type VehicleType = 'terminal_tractor' | 'flatbed' | 'tanker' | 'container_truck';

export interface Truck {
  id: string;                    // "GPHA-T-0142"
  plateNumber: string;           // "GR 1234-22"
  vehicleType: VehicleType;
  driver: {
    name: string;
    phone: string;
    photoUrl?: string;
  };
  status: TruckStatus;
  currentLocation: {
    lat: number;
    lng: number;
    heading: number;             // degrees, 0=N
    speedKmh: number;
  };
  currentCargo: {
    type: 'container' | 'bulk' | 'liquid' | 'empty';
    description: string;         // "40ft container, MSC, ex-Rotterdam"
    weightTonnes: number;
    containerNumber?: string;
  };
  lastStopped: {
    locationName: string;        // "Berth 4"
    lat: number;
    lng: number;
    timestamp: string;           // ISO
  };
  lastUnloaded: {
    locationName: string;
    cargoDescription: string;
    timestamp: string;
  };
  currentRoute?: {
    originNodeId: string;
    destinationNodeId: string;
    waypointNodeIds: string[];
    etaTimestamp: string;
    progressPercent: number;
  };
}

export interface PortNode {
  id: string;                    // "berth-4"
  name: string;                  // "Berth 4"
  kind: 'gate' | 'berth' | 'yard' | 'weighbridge' | 'customs' | 'fuel' | 'parking' | 'external';
  lat: number;
  lng: number;
  dwellTimeRange?: [number, number]; // seconds (sim-time), e.g. loading: [30, 80]
}

export interface PortEdge {
  fromNodeId: string;
  toNodeId: string;
  polyline: [number, number][];  // [lng, lat] pairs
  lengthMeters: number;
  isExternal: boolean;           // true → 60 km/h; false → 15 km/h
}
```

---

## 5. Project Structure

```
gpha/
├── plans/
│   ├── implementation-plan.md          (this file)
│   └── design-prompt.md
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        (mounts Dashboard)
│   ├── api/
│   │   └── stream/
│   │       └── route.ts                (SSE handler)
│   └── globals.css
├── components/
│   ├── dashboard/
│   │   ├── Dashboard.tsx               (top-level layout)
│   │   ├── TopBar.tsx
│   │   ├── StatusTiles.tsx
│   │   ├── SimClock.tsx
│   │   └── SpeedControl.tsx
│   ├── map/
│   │   ├── PortMap.tsx                 (MapLibre wrapper)
│   │   ├── TruckLayer.tsx              (markers + clusters)
│   │   ├── WakeLayer.tsx               (trailing polylines)
│   │   ├── PortOverlayLayer.tsx        (berths/yards/gates)
│   │   └── useInterpolatedTrucks.ts    (RAF position interpolation)
│   ├── panel/
│   │   ├── SidePanel.tsx               (3-state container)
│   │   ├── TruckList.tsx
│   │   ├── TruckCard.tsx
│   │   ├── TruckDetail.tsx
│   │   ├── SearchBar.tsx
│   │   ├── StatusFilterChips.tsx
│   │   └── CollapsedRail.tsx
│   ├── ui/                             (shadcn/ui components)
│   └── splash/
│       └── PhoneSplash.tsx
├── lib/
│   ├── providers/
│   │   ├── TruckLocationProvider.ts    (interface)
│   │   ├── SimulatorProvider.ts        (v1)
│   │   └── WebhookProvider.ts          (v2 stub)
│   ├── simulator/
│   │   ├── missionEngine.ts            (assigns + advances missions)
│   │   ├── pathing.ts                  (node→node routing on graph)
│   │   └── tick.ts                     (one simulation step)
│   ├── sse/
│   │   ├── broadcaster.ts              (subscriber set, fanout)
│   │   └── encoding.ts                 (SSE wire format)
│   ├── store/
│   │   └── useFleetStore.ts            (Zustand)
│   ├── types.ts
│   └── time.ts                         (sim-time helpers)
├── data/
│   ├── port-graph.json
│   ├── port-overlay.geojson
│   └── trucks-seed.json
├── public/
│   ├── gpha-logo.svg
│   ├── favicon.ico
│   └── og-image.png
├── vercel.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 6. Build Order (Milestones)

### Milestone 1 — Static visual demo (1–2 days)

**Goal**: Project scaffolded, map renders Tema port with 25 static truck dots, side panel shows seed data.

Tasks:
1. `npx create-next-app@latest gpha --typescript --tailwind --app --no-src-dir`
2. Install: `maplibre-gl`, `react-map-gl`, `zustand`, `lucide-react`, `@vercel/config`
3. Initialize shadcn/ui: `npx shadcn@latest init` (dark mode, neutral base)
4. Add components: `button card input badge scroll-area separator tooltip avatar`
5. Trace Tema port on geojson.io → `data/port-overlay.geojson` (boundary + 4 berths + 6 yards + 5 gates + customs + fuel + parking polygons)
6. Hand-author `data/port-graph.json`: 20 nodes (with kinds + dwell ranges) + 30 edges (with polylines following internal roads roughly)
7. Hand-author `data/trucks-seed.json`: 25 trucks (varied statuses, varied cargo, plausible Ghanaian driver names, plate format "GR XXXX-YY")
8. `vercel.ts` with `framework: 'nextjs'`
9. Build `<PortMap>`: MapLibre wrapper, Protomaps dark style URL, fly-to bounds covering Tema port, draw port boundary + berth/yard polygons from GeoJSON
10. Build `<TruckLayer>`: render seed trucks as colored dots from `data/trucks-seed.json`, status → color
11. Build `<SidePanel>`: 3 states (list / detail / collapsed). List view reads seed data, renders `<TruckCard>` per truck. Click → detail view. Back button → list.
12. Build `<TopBar>`: logo + title + `<StatusTiles>` (computed from seed data) + static "00:00:00" clock + disabled speed control
13. Deploy to Vercel, verify URL works on desktop

**Acceptance**: Open URL → see Tema port map with 25 dots → click a dot or card → see detail → close → back to list. No movement yet.

---

### Milestone 2 — Live simulation (2–3 days)

**Goal**: Trucks move smoothly. Status changes propagate. Sim clock and speed control work.

Tasks:
1. Implement `lib/simulator/pathing.ts`: BFS/Dijkstra over `port-graph.json` for "node A → node B" routes
2. Implement `lib/simulator/missionEngine.ts`:
   - On init: load seed trucks, assign each a starting mission consistent with its seed status
   - `assignNewMission(truck)`: pick plausible next mission (terminal tractors → in-port nodes; container trucks → gate-to-yard-to-berth-to-gate loops; some go offline randomly)
   - `advance(truck, deltaSeconds)`: move truck along current edge at status-appropriate speed; on waypoint reached, update status + dwell; on dwell complete, assign new mission
3. Implement `lib/simulator/tick.ts`: one tick = `simSeconds = 5 * speedMultiplier`; advance all trucks; return diff
4. Implement `lib/sse/broadcaster.ts`: subscriber registry, JSON-encoded snapshots, heartbeat every 15s
5. Implement `app/api/stream/route.ts`: long-lived `ReadableStream` response, register subscriber on connect, send full snapshot on connect + diffs on tick, cleanup on close. Module-scope `setInterval` starts the simulator on first request.
6. Client: `useFleetStore` (Zustand) holds `trucks: Map<id, Truck>`, `simTime: Date`, `selectedId: string | null`, `speedMultiplier: number`, panel state
7. Client: connect `EventSource` in a top-level effect, dispatch updates into Zustand
8. Client: `useInterpolatedTrucks.ts` — `requestAnimationFrame` loop that interpolates each truck's lat/lng between its last-known position and target position based on speed + heading; reads from store
9. Update `<TruckLayer>` to use interpolated positions; rotate heading-aware (if you go with chevron) or keep dot
10. Add `<WakeLayer>`: ring buffer of last ~10 positions per truck, drawn as fading polyline
11. Add clustering: MapLibre `cluster: true` source — render clusters at zoom < 14
12. Add pulsing-ring selection: separate layer for selected truck only, animated radius
13. Add hover tooltips via `react-map-gl` `onMouseMove`
14. Wire `<SimClock>` to `store.simTime`
15. Wire `<SpeedControl>`: client sends `?speed=N` to a `POST /api/stream/speed` route that updates server multiplier
16. Status tiles + filter chips + list update live via store

**Acceptance**: Open URL → trucks visibly move along port roads → click one in transit → detail panel updates as it moves → it reaches a berth → status flips to "Loading" → after dwell, status flips and a new mission starts → cluster expands on zoom-in → speed slider noticeably changes pace.

---

### Milestone 3 — Polish & pitch prep (1–2 days)

Tasks:
1. Panel `<SearchBar>`: filter list by id, plate, or driver name (substring)
2. `<StatusFilterChips>`: multi-select status filter
3. List sort: in_transit → loading → unloading → idle → offline; secondary sort by id
4. Auto-pan map to selected truck on selection (smooth `flyTo`)
5. "Follow" pin: when on detail view, map gently re-centers on truck every few seconds
6. Offline state: if truck.status === 'offline', grey marker, "Last seen X min ago" in detail
7. Collapsed rail: column of 4 status icons w/ counts; click → expand to list
8. Tablet breakpoint: at < 1024px, panel narrows to 320px; top tiles condense
9. Phone splash: at < 768px, show full-screen splash w/ GPHA logo, "Best viewed on desktop or tablet", and a copyable link
10. Empty / loading states: SSE not yet connected → skeleton list; SSE error → reconnect banner
11. Tune `trucks-seed.json` for pitch narrative:
    - 1 truck just entering Gate 1 (visible motion immediately)
    - 1 truck halfway between Yard B and Berth 3 (good "click me" candidate)
    - 1 truck about to complete unloading at Berth 4 (status flip on camera)
    - 1 offline truck (demonstrates failure mode)
    - Even spread across vehicle types
12. Custom favicon (GPHA-styled), OG image, page title "GPHA Cargo Tracker — Tema Port"
13. Vercel project alias: pick a memorable URL (e.g., `gpha-tracker.vercel.app`)
14. README with screenshots + pitch talking points + Phase 2 list

**Acceptance**: Demo-ready URL playable from a cold open without explanation; the first 30 seconds show motion, a status change, and a click-to-detail interaction.

---

## 7. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Fluid Compute spawns multiple instances → state divergence | Low at demo scale | Pin via `vercel.ts` `functions: { maxDuration }`; if it bites, fall back to Upstash Redis (free tier) |
| Protomaps free tier rate limits during pitch | Low | Pre-cache tiles via service worker, or switch to MapTiler free (key required) |
| SSE drops on flaky wifi during pitch | Medium | Auto-reconnect in `EventSource` (browser default), full-snapshot on reconnect |
| Tracing Tema port takes longer than 2 hours | Medium | Time-box to 2 hours; if over, ship rougher polygons and refine post-pitch |
| Animation jank at 25 trucks on low-end laptop | Low | MapLibre GL is GPU-accelerated; ring-buffer wakes are short |
| GPHA asks "where's the history?" in pitch | High | Have Phase 2 slide ready: "Postgres + scrubber UI, 1–2 weeks to add" |

---

## 8. Phase 2 Backlog (post-pitch)

1. **Real GPS ingestion**: `POST /api/ingest` webhook implementing `WebhookProvider`; swap simulator out
2. **Persistence**: Neon Postgres via Vercel Marketplace; truck/location/mission tables
3. **Historical playback**: time scrubber on the map, replay any window
4. **Reports**: dwell-time analytics, throughput per berth, driver hours
5. **Alerts**: rules engine ("alert if stationary > 20 min outside a yard")
6. **Auth**: Clerk via Vercel Marketplace; roles (Operator, Supervisor, Admin)
7. **Multi-port**: Takoradi added; port selector
8. **Geofencing**: zone authorization, leave-alerts
9. **Manifest integration**: pull cargo data from GPHA's customs system
10. **Mobile responsive + driver app**
11. **Sentry + Vercel Agent** for observability

---

## 9. Open Questions for GPHA (post-POC)

- Existing fleet management / GPS system in use?
- Actual berth/gate/yard names and IDs at Tema?
- Truck fleet size (GPHA-owned vs licensed external hauliers)?
- Driver privacy requirements (can we show name + phone, or anonymized only)?
- Required uptime / SLA?
- On-prem vs cloud hosting constraints?
- Integration targets (Customs, Manifest, Weighbridge systems)?
