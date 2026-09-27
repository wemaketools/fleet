# GPHA Cargo Tracker — Visual Redesign Plan

**Status**: Proposed
**Scope**: UI only. Simulator, SSE stream, store shape and data files stay as they are, with two small data fixes noted in §4.
**Before screenshots**: `plans/redesign/before/` (captured 2026-09-27 from the running app at 1440×900, 900×700 and 390×844).

---

## 1. Diagnosis — why it reads as unprofessional today

Ranked by how much each one hurts the first impression.

| # | Problem | Where | Effect |
|---|---|---|---|
| 1 | **Status colours are semantically wrong.** Idle = red, offline = light grey, in‑transit = green. With 15 idle trucks the port looks like it is on fire, and the two trucks that actually have a problem (offline) are the least visible. | `lib/types.ts` `STATUS_COLORS` | Everything downstream (map, tiles, chips, cards) inherits an alarming, illegible palette. |
| 2 | **Cartoon truck sprites.** Top‑down SVG cars with coloured bodies, wheels and windscreens. They are too detailed for their 20 px size, sit on top of zone labels ("Be▮h 1", "Y▮rd A") and make the map look like a game. | `PortMap.tsx` `truckSvg` | Map, which is the product, looks toy‑like. |
| 3 | **Harsh red port boundary + floating grey boxes.** A 1.5 px saturated red polygon dominates the viewport. Berths/yards are rounded rectangles with no relationship to the quay or the water. | `PortMap.tsx` overlay layers | Competes with status colour; the "port" looks drawn in a paint program. |
| 4 | **No UI typeface.** `--font-sans` is `Helvetica, Arial`. Only Geist Mono is loaded. | `globals.css`, `layout.tsx` | Text looks like an unstyled default; no tabular numerals, uneven weights. |
| 5 | **Shouty, wrapping filter chips.** ALL‑CAPS labels with counts in parentheses wrap to two rows even at 400 px. | `StatusFilterChips.tsx` | Noise at the very top of the panel. |
| 6 | **Cards have no hierarchy.** Truck ID coloured by status (green column down the whole list), every card shows "18 km/h · just now", bordered boxes stacked on a glass panel. | `TruckCard.tsx` | List is a wall of identical rectangles. |
| 7 | **Detail view wastes space and leaks internals.** Two stacked headers ("Truck Detail" + "Back / Follow"), route shows raw node ids ("yard b → yard e"), history shows "3365h 30m ago" because seed timestamps are from May. ETA uses "01:57 PM" while the clock is 24 h. | `SidePanel.tsx`, `TruckDetail.tsx`, `data/trucks-seed.json` | Undermines credibility during a pitch. |
| 8 | **Top bar is thin on identity and status.** Raw seal PNG at 36 px, no "live" indicator, unlabeled clock, KPI numbers not actionable. | `TopBar.tsx`, `StatusTiles.tsx` | Feels like a scaffold rather than a control room. |
| 9 | **Collapsed rail is unreadable.** 8 px dots with 11 px numbers, no labels. | `CollapsedRail.tsx` | Nobody will know what the numbers mean. |
| 10 | **Base‑map noise.** "COMMUNITY 1/2/5", street names and POI labels at full brightness compete with the fleet. Attribution renders under the panel. | `PortMap.tsx` | Fleet does not pop; corners look broken. |
| 11 | **Selected truck shows no route on the map.** The data (`currentRoute.waypointNodeIds` + `port-graph.json` polylines) exists but is only used for a % bar. | `PortMap.tsx` | The single most convincing "live ops" visual is missing. |
| 12 | **Phone splash is bare.** Logo, two lines, a button, and nothing about the fleet. | `PhoneSplash.tsx` | Fine as a gate, but a missed chance to show something. |

---

## 2. Design direction

**"Port operations console."** Calm, dark, high‑contrast, authoritative. Bloomberg‑terminal density with Linear‑level restraint. The map is the product; chrome is neutral and recedes; colour means status and nothing else.

### Principles
1. **Colour = status only.** Chrome is navy‑slate. The five status colours never appear on chrome, and the brand accent never appears on data.
2. **One brand accent, used sparingly.** GPHA gold `#FCD116` (from the seal) for focus rings, the active segment in controls and a 2 px brand rule under the top bar. That is the whole list.
3. **Legibility over decoration.** No halos on unselected trucks, no cartoon sprites, no glowing polygons. Labels are anchored where trucks cannot cover them.
4. **Sentence case everywhere.** Uppercase is reserved for 11 px section eyebrows in the detail panel.
5. **Numbers are tabular and monospace.** IDs, plates, coordinates, times, counts.

### Tokens (replace the shadcn neutral defaults in `globals.css`)

| Token | Value | Use |
|---|---|---|
| `--bg-base` | `#0A0F1C` | page / map fallback |
| `--bg-topbar` | `#0D1526` | top bar (opaque) |
| `--bg-panel` | `rgba(13, 21, 38, 0.88)` + `backdrop-blur(16px)` | side panel, tooltips |
| `--bg-elev-1` | `rgba(255,255,255,0.04)` | inputs, hover |
| `--bg-elev-2` | `rgba(255,255,255,0.07)` | selected card, active chip |
| `--border` | `rgba(255,255,255,0.08)` | hairlines |
| `--border-strong` | `rgba(255,255,255,0.16)` | focused input, selected card |
| `--text-1` | `#E6EBF2` | primary |
| `--text-2` | `#9AA6B8` | secondary |
| `--text-3` | `#66728A` | dim / eyebrows |
| `--accent` | `#FCD116` | brand gold (chrome only) |
| `--status-transit` | `#3B82F6` | blue — moving |
| `--status-loading` | `#F59E0B` | amber — at berth/yard taking cargo |
| `--status-unloading` | `#A78BFA` | violet — discharging |
| `--status-idle` | `#94A3B8` | slate — parked, healthy |
| `--status-offline` | `#F43F5E` | red — tracker lost, needs attention |

`STATUS_COLORS` in `lib/types.ts` becomes the single source and reads these tokens; every hard‑coded `#CE1126` / `#22C55E` in components is removed.

### Type
- **UI**: Inter via `next/font/google` with `font-feature-settings: "tnum", "cv11"`. (Alternative if a more institutional feel is wanted: IBM Plex Sans. Pick one; the plan assumes Inter.)
- **Mono**: keep Geist Mono.
- Scale: 11 eyebrow · 12 meta · 13 body · 14 emphasis · 18 panel title · 24 truck ID · 28 KPI number.

---

## 3. Region‑by‑region spec

### 3.1 Top bar (56 px, opaque, 2 px gold brand rule at its bottom edge)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [seal] GHANA PORTS & HARBOURS AUTHORITY   ▌12 In transit ▌6 Loading ▌2 Unl… ▌5 Idle ▌0 Offline   ● LIVE  14:23:08 GMT  [⟩] │
│        Tema Port · Live fleet operations  (each tile is a filter toggle)                          25 vehicles              │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Brand block**: seal at 32 px on a 40 px white‑10% disc so the coloured PNG doesn't float on navy; wordmark line 1 "Ghana Ports & Harbours Authority" (12 px, tracking +0.04 em, `--text-1`), line 2 "Tema Port · Live fleet operations" (11 px, `--text-2`).
- **Status strip** (replaces `StatusTiles`): five compact tiles, each `[3 px colour bar] 28 px number  label`. Tiles are **buttons** that toggle the same `statusFilter` the chips use; active tile gets `--bg-elev-2`. This makes the header useful, not decorative. A sixth muted tile shows fleet total.
- **Right cluster**: `● LIVE` pill (green dot pulsing while `connected`, amber "Reconnecting" when not) · clock `14:23:08` with `GMT` suffix (Ghana is UTC+0, label it) · panel collapse chevron.
- No speed / pause control (an existing test forbids it; the sim runs at a fixed pace by design).

### 3.2 Map

**Base style**: keep OpenFreeMap dark, then on `load` walk `map.getStyle().layers` and:
- set `text-opacity` 0.35 on all base symbol layers, hide `place_*` labels above z13 (removes "COMMUNITY 1");
- lower road line opacity ~30 %;
- set water to `#0B1424` and land to `#0F1727` so the port overlay has a quieter ground.

**Port overlay** (same GeoJSON, new paint):
- Boundary: 1 px dashed `rgba(255,255,255,0.22)`, fill `rgba(255,255,255,0.025)`. No red.
- Berths: fill `rgba(59,130,246,0.10)`, 1 px `rgba(96,165,250,0.35)` stroke, label "Berth 1" 10 px caps anchored **top‑left inside the polygon** with 6 px padding, so trucks parked in the middle never cover it.
- Yards: fill `rgba(255,255,255,0.03)`, 1 px `rgba(148,163,184,0.25)` stroke, same label rule.
- Labels get `symbol-sort-key` and sit **above** the vehicle layer.

**Vehicle markers** — keep the "varied top‑down truck vector" decision that the existing tests pin, but redraw them:
- One 28×44 viewBox silhouette per vehicle type, **single‑colour flat glyph** (status colour) with a 1.5 px `#0A0F1C` outline for separation and no wheels/windscreen/cab detail. Container truck = cab + long body, flatbed = cab + open bed, tanker = cab + rounded body, terminal tractor = short cab only.
- Selected: scale 1.25 + white 2 px outline + id label below; pulsing ring stays (radius `SELECTED_VEHICLE_DOT_RADIUS` → 2×, 1.6 s).
- Offline: 45 % opacity, small red "!" badge at 1 o'clock.
- Wake trail unchanged (config constants are tested).
- Clusters: 22 px slate disc, 1 px stroke coloured by dominant status, count in mono.

**Selected‑truck route on the map** (new, highest‑value addition):
- Build a `LineString` from `currentRoute.waypointNodeIds` using `port-graph.json` edge polylines (`lib/simulator/pathing.ts` already routes on this graph; expose a `routeToLineString()` helper).
- Draw remaining path as 3 px status‑colour line at 0.9 opacity, travelled portion 2 px at 0.3, destination node as a small ring + label.

**Controls & furniture**
- Zoom +/−, and a **"Recentre on port"** button, custom‑styled to match panel chrome, bottom‑left.
- Compact attribution pinned bottom‑left beside the controls, never under the panel.
- Hover tooltip: 220 px, panel glass, `[status dot] GPHA‑T‑0142  GR 1234‑22 / Kwame Asante / In transit → Berth 4 · 42 km/h`.

### 3.3 Side panel — list (400 px desktop / 320 px tablet)

```
┌────────────────────────────────────────┐
│ Fleet   25 vehicles              [⟩]   │
│ ┌ 🔍 Search ID, plate or driver ─────┐ │
│ [All] [● In transit 12] [● Loading 6] … │  ← one row, horizontal scroll, sentence case
│ Showing 12 · sorted by activity        │
│ ▌ GPHA‑T‑0142   ● In transit  GR 1234‑22
│ ▌ Kwame Asante                          │
│ ▌ → Berth 4 · 42 km/h · updated 4 s ago │
│ ────────────────────────────────────── │
│ ▌ GPHA‑T‑0091   ● Loading     GR 7842‑21│
│ …                                       │
└────────────────────────────────────────┘
```

- Cards become **rows with hairline dividers** and a 3 px status stripe on the left, 72 px tall, no boxes. Hover `--bg-elev-1`, selected `--bg-elev-2` + `--border-strong` on the left.
- Row 1: ID (mono, `--text-1`, **never coloured**) · small status pill (dot + label, 11 px) · plate right‑aligned mono `--text-3`.
- Row 2: driver name 13 px medium.
- Row 3 (12 px `--text-2`): destination or place with an arrow/pin glyph, speed only if > 0, "updated Xs ago" from `lastSnapshotAt`, not `lastStopped`.
- Chips: single horizontally scrollable row, sentence case, count as a mono suffix, active = `--bg-elev-2` + `--border-strong`. Remove the `(n)` parentheses.
- Loading skeleton, "No vehicles match" empty state and the amber "Reconnecting…" banner keep their behaviour with new styling.

### 3.4 Side panel — detail

```
┌────────────────────────────────────────┐
│ [← Fleet]                 [Follow ◉] [⟩]│  ← single header row
│ ● IN TRANSIT                            │
│ GPHA‑T‑0142                             │  ← 24 px mono
│ GR 1234‑22 · Container truck            │
│ ── Route ────────────────────────────── │
│ Gate 1 ●──●──●──○ Berth 4               │  ← stepper over waypoint *names*
│ 64% · ETA 14:31 (8 min)                 │
│ ── Driver ───────────────────────────── │
│ (KA) Kwame Asante   +233 24 555 0142    │
│ ── Cargo ────────────────────────────── │
│ 40ft container · MSC · ex‑Rotterdam     │
│ Weight 28.4 t     Container MSCU‑7384921│  ← 2‑col key/value grid
│ ── Location ─────────────────────────── │
│ 5.6234° N, 0.0012° W   42 km/h · SE     │
│ Last stop Gate 1 · 12 min ago           │
│ ── History ──────────────────────────── │
│ Unloaded at Yard B · 1 h 22 min ago     │
└────────────────────────────────────────┘
```

- Collapse the two headers into one. Panel title is replaced by the "← Fleet" back button.
- Route moves **above** driver: it is what an operator looks at first for a moving truck. Stepper renders `waypointNodeIds` mapped through `port-graph.json` node names.
- Idle: Route section becomes "Parked at Parking · 40 min". Offline: hero pill red, "Last seen 18 min ago at Gate 3", fields dimmed.
- Heading shown as compass point (SE) with degrees in a tooltip. ETA in 24 h to match the clock.
- Key/value grids use 12 px `--text-3` keys and 13 px `--text-1` values.

### 3.5 Collapsed rail (56 px)

Vertical stack of the same five status tiles in mini form: colour bar, 14 px mono count, 10 px vertical‑text label. Tooltip on hover. Click filters and expands, as today.

### 3.6 Phone (< 768 px)

Keep the gate, make it worth looking at:
- Seal + wordmark, "Live fleet operations · Tema Port".
- **Live status strip** (five counts, read‑only, from the same store — the stream already runs).
- "Open on a desktop or tablet for the map" + Copy link.
- Optional: QR of the current URL (needs a ~3 KB QR lib; defer unless wanted).

### 3.7 Metadata
- Favicon and Apple touch icon from the seal on a navy disc.
- Redraw `og-image.svg` in the new palette with a stylised map + status strip.

---

## 4. Information changes (adds / removes)

**Add**
- Selected‑truck route drawn on the map.
- Top‑bar status tiles act as filters.
- Live / reconnecting indicator.
- Fleet total in header.
- Compass‑point heading; ETA countdown in minutes.
- Phone: live counts.

**Remove**
- Per‑truck decorative halo on unselected trucks (keep for selected; a test pins this).
- Duplicate "Truck Detail" header.
- Raw node ids in UI.
- Parenthesised counts and ALL‑CAPS labels in chips/captions.

**Data fixes (small, required for the UI to look right)**
- `lib/simulator/state.ts`: on boot, shift every seed `timestamp` so they are relative to `Date.now()` (e.g. keep the offsets from the seed's own "now" of 2026‑05‑10T14:23Z). Fixes "3365h 30m ago".
- Add `nodeName(id)` helper backed by `port-graph.json` for route labels.

---

## 5. Implementation phases

Each phase ends with a screenshot pass (`plans/redesign/after/…`) at 1440×900, 1280×800, 1024×768, 900×700 and 390×844, plus `npm run lint` and `npm test`.

### Phase 0 — Foundation (½ day)
- `app/layout.tsx`: load Inter + Geist Mono via `next/font/google`.
- `app/globals.css`: replace shadcn neutral tokens with §2 tokens; `panel-glass`, focus ring, scrollbar styling; keep `pulse-ring`.
- `lib/types.ts`: new `STATUS_COLORS`; add `STATUS_COLOR_VARS` for CSS use.
- Remove every hard‑coded hex from components.
- **Files**: `app/layout.tsx`, `app/globals.css`, `lib/types.ts`.

### Phase 1 — Top bar (½ day)
- Rebuild `TopBar.tsx`, `StatusTiles.tsx` → `StatusStrip.tsx` (filter‑aware), new `LiveIndicator.tsx`, restyle `SimClock.tsx` with GMT label.
- **Files**: `components/dashboard/*`.

### Phase 2 — Map (1½ days)
- Base‑style muting on load; overlay repaint; label anchoring.
- New vehicle glyphs in `truckSvg` (keep function names and layer ids the tests look for: `registerTruckImages`, `trucks-vehicle`, `trucks-halo`, `bringVehicleLayersToFront`, `vehicleIcon`, `vehicleBearing`).
- New `route` source + two line layers + destination symbol; `lib/simulator/pathing.ts` gains `routeToLineString(route)`.
- Custom `MapControls.tsx` (zoom, recentre), attribution placement, tooltip restyle.
- **Files**: `components/map/PortMap.tsx`, new `components/map/MapControls.tsx`, `components/map/vehicleGlyphs.ts`, `lib/simulator/pathing.ts`.

### Phase 3 — Side panel (1½ days)
- `SidePanel.tsx` single header; `TruckList.tsx` rows + caption; `TruckCard.tsx` → `TruckRow.tsx`; `StatusFilterChips.tsx` single‑row; `SearchBar.tsx`; `TruckDetail.tsx` sections + stepper + key/value grid; `CollapsedRail.tsx`.
- Shared `StatusPill.tsx`, `SectionHeader.tsx`, `KeyValue.tsx` in `components/ui/`.
- Seed timestamp normalisation + `nodeName()`.
- **Files**: `components/panel/*`, `components/ui/*`, `lib/simulator/state.ts`, `lib/port-graph.ts` (new).

### Phase 4 — Splash, metadata, QA (½ day)
- `PhoneSplash.tsx` with live counts; favicon/touch icon; `og-image.svg`; README screenshots refreshed.
- Cross‑browser check (Chrome, Safari — `backdrop-filter` prefix), keyboard focus pass, reduced‑motion media query for pulses.

**Total: ~4½ working days solo.**

---

## 6. Tests that must change

`tests/simulation-polish.test.mjs` asserts against **source text**, not behaviour, and pins several visual decisions from the previous pass. Expected edits:

| Test | Action |
|---|---|
| `map emphasizes vehicle icons over wake trails` | Keep. All referenced identifiers survive the redesign. |
| `map halo pulse is limited to selected vehicles` | Keep. |
| `vehicles render as varied top-down truck vectors` | Keep; new glyphs still go through `registerTruckImages` / `truckIconId` / `icon-rotate`. |
| `vehicle svg strokes use the status color` | Update the regexes to the new glyph markup (see rest of file). |
| `animation speed and playback are not user-controllable` | Keep; the new `TopBar.tsx` must not contain the word "speed" (mind copy like "42 km/h" lives in the panel, not the top bar). |
| `simulation uses slower, frequent updates by default` | Keep. |

`tests/collision-avoidance.test.mjs` is untouched.

---

## 7. Decisions to confirm before Phase 0

1. **Typeface**: Inter (modern, neutral) vs IBM Plex Sans (more institutional). Plan assumes Inter.
2. **Vehicle markers**: redrawn flat silhouettes per vehicle type (plan) vs plain heading‑chevron dots (simpler, more "ops‑console", but would need the truck‑vector test rewritten).
3. **Phone QR code**: include (adds a tiny dependency) or leave out.
4. **Status label wording**: "In transit / Loading / Unloading / Idle / Offline" kept as is, or "Moving / At berth / Discharging / Parked / No signal" for a plainer operator vocabulary. Plan keeps the current five.

Everything else in this document is a recommendation I would proceed with as written.
