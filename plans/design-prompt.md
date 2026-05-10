# Design Prompt — GPHA Cargo Truck Tracker

> Feed this prompt to an AI design agent (e.g., a UI generation tool, design subagent, or design system). It describes the UI only — no backend, no data simulation, no architecture. The goal is to produce a polished, production-grade interface design for a live fleet operations dashboard.

---

## Product in one sentence

A live operations dashboard for the **Ghana Ports and Harbours Authority (GPHA)** that shows their cargo trucks moving in real time around **Tema port**, with a side panel for browsing the fleet and inspecting any individual truck.

## Who uses it

Port operations staff (supervisors, dispatchers, ops managers) viewing the dashboard on **large desktop monitors in a control room**, or on **laptops and tablets** in the field. They monitor the dashboard for a full shift — it needs to look professional at a glance and reward closer inspection.

## Visual identity & mood

- **Operations-center aesthetic**: dark-mode-first, high contrast, calm-but-alert. Think Bloomberg Terminal × Google Maps × Linear.
- **Authoritative, governmental, but modern** — this is a national port authority product, not a flashy consumer app. Avoid playful illustrations, gradient backgrounds, or marketing-y polish.
- **Map dominates**. The map is the product. Every other surface defers to it.
- **Color expressively used for status only.** Chrome and panels are neutral grays. Color spikes (green, amber, red, blue) appear only on truck status indicators, KPI tiles, and selection rings.
- **Ghana cues, subtle**: a small accent of Ghana flag colors (red `#CE1126`, gold `#FCD116`, green `#006B3F`, with black) — preferably one of these as the primary accent, not all four. The GPHA logo or wordmark is anchored top-left. No flag motifs in the UI itself.

## Layout (desktop, ≥1280px wide)

Three regions, fixed:

```
┌────────────────────────────────────────────────────────────────┐
│  TOP BAR  (~56px, dark, full width)                            │
├──────────────────────────────────────────┬─────────────────────┤
│                                          │                     │
│                                          │                     │
│            MAP                           │   SIDE PANEL        │
│            (fills viewport)              │   (~400px wide,     │
│                                          │   right-anchored,   │
│                                          │   full height       │
│                                          │   below top bar,    │
│                                          │   semi-transparent  │
│                                          │   over map)         │
│                                          │                     │
└──────────────────────────────────────────┴─────────────────────┘
```

The side panel **overlays** the map (semi-transparent dark fill with backdrop blur, `rgba(15, 23, 42, 0.85)` style), it does not push the map. The map extends *under* the panel.

## Region 1 — Top bar

Height ~56px. Background slightly darker than the panel, opaque, with a subtle 1px bottom border.

Left to right:

1. **GPHA logo + wordmark** (left edge, ~16px padding). Wordmark reads "Cargo Tracker — Tema Port" in a slightly smaller weight beneath/beside the logo.
2. **Status summary tiles** (center-left, grouped). 4 small inline KPI tiles, each ~120px wide:
   - "In Transit" — number + tiny moving-truck icon, **blue** indicator dot
   - "Loading" — number + crane icon, **amber** indicator dot
   - "Idle" — number + parked icon, **gray** indicator dot
   - "Offline" — number + warning icon, **red** indicator dot
   Tiles are flat, no card outlines, just label + big number + colored dot.
3. **Sim clock + speed control** (right side, before the panel collapse toggle):
   - Two-line clock display: "**14:23:08** sim time" on top, "`09:11:42 wall`" below in smaller dimmer text
   - Segmented control immediately right: `⏸  1×  20×  50×`. The currently active speed is highlighted with the accent color.
4. **Panel collapse toggle** (far right, integrated into the panel's top edge but visually part of the top bar) — a chevron that toggles the side panel between expanded and collapsed-icon-strip states.

## Region 2 — Map

Full viewport behind the panel.

- **Base layer**: dark vector tiles (Protomaps "dark" style). Streets in dim gray, water in deep navy, land in near-black.
- **Port overlay**: Tema port boundary drawn as a softly glowing outline (1.5px, slightly translucent accent color). Berths drawn as filled rectangles in a muted blue-gray with labels (`Berth 1`, `Berth 2`...). Container yards as larger polygons in a slightly different muted color. Gates as labeled diamond/pin markers around the port perimeter. Customs, weighbridge, fuel, parking as smaller labeled icons.
- **Truck markers**: each truck is a **colored dot** (~10px diameter) with a 1px white inner stroke for legibility, colored by status:
  - In transit: **blue** `#3B82F6`
  - Loading: **amber** `#F59E0B`
  - Unloading: **violet** `#8B5CF6`
  - Idle: **gray** `#6B7280`
  - Offline: **red** `#EF4444` (with reduced opacity, ~50%)
- **Wake trail**: each moving truck has a fading polyline trailing behind it showing its last ~10 known positions. The trail starts at full marker color, fades to transparent over ~80px of map distance.
- **Clustering at low zoom**: when 3+ trucks overlap, render a cluster badge — a circle slightly larger than a marker showing the count, in neutral gray with a thin status-aware border (the border color reflects the dominant status in the cluster). On zoom-in, the cluster splits into individual markers.
- **Hover state**: hovering a truck dot shows a small tooltip card (~200px wide) with truck ID, plate, driver name, and current status. Tooltip has the same panel styling (semi-transparent dark, backdrop blur).
- **Selected state**: the selected truck dot gets a **pulsing concentric ring** (radius animates from marker size to 2x size every ~1.5s, fading out). The truck ID label is always visible beneath it. The map smoothly pans to keep the selected truck on screen ("Follow" mode, toggleable via a small pin icon in the detail panel header).
- **Map controls** (bottom-left, stacked): zoom in, zoom out, recenter to port. Small icon buttons matching the panel's visual language. No compass, no scale bar, no fullscreen.

## Region 3 — Side panel

Width 400px desktop, 320px tablet. Three mutually-exclusive states:

### State A — List view (default, nothing selected)

```
┌──────────────────────────────────────┐
│  Fleet                          [⛶]  │  ← header, panel title + collapse
├──────────────────────────────────────┤
│  🔍 Search trucks…                   │  ← search input
├──────────────────────────────────────┤
│  [All] [In Transit] [Loading] ...    │  ← filter chips (multi-select)
├──────────────────────────────────────┤
│  ▼ 25 trucks · sorted by activity    │  ← small caption + sort dropdown
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ ● GPHA-T-0142    GR 1234-22    │  │  ← truck card
│  │   Kwame Asante                 │  │
│  │   In transit → Berth 4         │  │
│  │   42 km/h · 2 min ago          │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ ● GPHA-T-0091    GR 7842-21    │  │
│  │   ...                          │  │
│  └────────────────────────────────┘  │
│  ...                                 │
└──────────────────────────────────────┘
```

**Truck card** (~88px tall):
- Left edge: 4px-wide vertical stripe in the truck's status color
- Top row: status dot · truck ID (mono, bold) · plate number (right-aligned, dimmer)
- Second row: driver name (medium weight)
- Third row: status verb + target ("In transit → Berth 4", "Loading at Yard B", "Idle at Parking", "Offline")
- Fourth row, dimmer: speed (if moving) · "last update X ago"
- Hover: subtle background lighten + cursor pointer
- Click: panel transitions to State B

Cards are sorted by status priority (in_transit → loading → unloading → idle → offline) then by ID. Smooth reorder animation when statuses change live.

Filter chips: pill-style toggles. `All` is default-selected; toggling individual statuses turns off `All`. Selected chip has accent border + filled background. Counts shown in parens on each chip (e.g., "In Transit (12)").

### State B — Detail view (one truck selected)

```
┌──────────────────────────────────────┐
│  ← Back              [📍 Follow] [⛶] │
├──────────────────────────────────────┤
│                                      │
│   ● IN TRANSIT                       │  ← big status badge
│                                      │
│   GPHA-T-0142                        │  ← truck ID, large mono
│   GR 1234-22 · Container truck       │
│                                      │
├──────────────────────────────────────┤
│  DRIVER                              │
│  ┌──┐                                │
│  │👤│  Kwame Asante                  │
│  └──┘  +233 24 555 0142              │
├──────────────────────────────────────┤
│  CURRENT CARGO                       │
│  40ft container · MSC                │
│  ex-Rotterdam · 28.4 t               │
│  Container #: MSCU-7384921           │
├──────────────────────────────────────┤
│  LOCATION                            │
│  5.6234° N, 0.0012° W                │
│  42 km/h · heading SE                │
│  Last stopped: Gate 1 · 12 min ago   │
├──────────────────────────────────────┤
│  ROUTE                               │
│  Gate 1  →  Berth 4                  │
│  [█████████░░░░░░░] 64%              │
│  ETA: 14:31 (8 min)                  │
├──────────────────────────────────────┤
│  HISTORY                             │
│  Last unloaded: Yard B · 1h 22m ago  │
│  Empty container, returned to depot  │
└──────────────────────────────────────┘
```

- Status badge at top: large pill with status color background (full saturation), white text, all caps, ~32px tall
- Sections separated by horizontal rules + small section headers (uppercase, tracking-wide, dim)
- Driver photo: 40px circular avatar, fallback to initials on accent-tinted background
- Coordinates in monospace
- Route progress bar: filled portion in status color (blue for in_transit), unfilled in dim neutral
- For idle/offline trucks, sections gracefully adapt: offline shows greyed-out fields + "Last seen" prominently; idle shows "Parked at: ..." instead of Route

Smooth slide-in transition from list view (panel content cross-fades; back button replaces the search bar).

### State C — Collapsed icon strip

When user clicks the collapse chevron, the panel collapses to a **48px-wide vertical rail** anchored to the right edge:

```
┌────┐
│ ⛶  │  ← expand chevron
├────┤
│ ● 12 │  ← in-transit count, blue dot
│ ● 6  │  ← loading, amber
│ ● 2  │  ← unloading, violet
│ ● 5  │  ← idle, gray
│ ● 0  │  ← offline, red (hidden if 0)
└────┘
```

- Each status row: colored dot + number, vertically stacked
- Click any row → expands panel to list view filtered to that status
- Click the expand chevron at top → expands panel to last state (list or detail)

## Region 4 — Phone splash screen (<768px)

Full-screen, dark, centered:

```
┌──────────────────────┐
│                      │
│      [GPHA logo]     │
│                      │
│    Cargo Tracker     │
│    Tema Port         │
│                      │
│   Best viewed on a   │
│   desktop or tablet  │
│                      │
│   ┌──────────────┐   │
│   │  📋 Copy link │   │
│   └──────────────┘   │
│                      │
│   Or scan to email   │
│   yourself the link: │
│                      │
│       [QR code]      │
│                      │
└──────────────────────┘
```

## Type, spacing, and chrome details

- **Typeface**: a clean modern geometric sans for UI (Inter, Geist, or similar). **Monospace** for truck IDs, coordinates, container numbers, timestamps (JetBrains Mono, Geist Mono).
- **Type scale**: 11px caption, 13px body, 15px emphasis, 20px section header, 28px truck ID, 36px status badge.
- **Spacing**: base unit 4px. Card padding 16px. Panel padding 20px horizontal, 16px vertical between sections.
- **Border radius**: 8px on cards, 6px on chips/buttons, 4px on small badges.
- **Shadows**: minimal — at most a subtle inner glow on the selected truck card and panel edge. No drop shadows on cards.
- **Borders**: 1px, opacity ~10–15% white on dark backgrounds.
- **Motion**: 150–200ms cubic-bezier easings on hover/select; 300ms on panel state transitions; truck markers interpolate via RAF (smooth, no easing); pulse ring on selection loops every ~1.5s.

## Color tokens

| Token | Light value (for reference) | Dark value (primary) |
|---|---|---|
| `bg-base` | `#FFFFFF` | `#0B0F19` |
| `bg-panel` | `rgba(255,255,255,0.9)` | `rgba(15,23,42,0.85)` w/ backdrop-blur |
| `bg-topbar` | `#F8FAFC` | `#0F172A` |
| `border-subtle` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.10)` |
| `text-primary` | `#0F172A` | `#E2E8F0` |
| `text-secondary` | `#475569` | `#94A3B8` |
| `text-dim` | `#94A3B8` | `#64748B` |
| `accent` | Ghana red `#CE1126` | Ghana red `#CE1126` |
| `status-in-transit` | — | `#3B82F6` |
| `status-loading` | — | `#F59E0B` |
| `status-unloading` | — | `#8B5CF6` |
| `status-idle` | — | `#6B7280` |
| `status-offline` | — | `#EF4444` |

Default theme is **dark**. A light theme is desirable but not required for v1.

## Microcopy & tone

- Concise, declarative, no marketing fluff.
- Status verbs in present continuous: "In transit", "Loading", "Unloading", "Idle", "Offline".
- Times are relative ("2 min ago", "12 min ago", "1h 22m ago") with absolute timestamps in tooltips on hover.
- Empty states are dry and useful: "No trucks match your filter." not "Oops! Nothing here."
- Error states surface a small banner above the list: "Connection lost — reconnecting…" in amber.

## Out of scope for the design

- No login screen, no settings page, no admin UI
- No historical playback / timeline scrubber
- No alerts feed or notifications UI
- No reports / charts / analytics dashboards
- No multi-port selector
- No two-way comms (no "message driver" buttons)
- No multi-select truck UI

## Deliverables expected from the design agent

1. **High-fidelity mockup of the desktop dashboard** in its default state (list view, ~10 trucks visible on map, midday lighting)
2. **Variant: detail view** with one truck selected, pulsing ring visible, route progress shown
3. **Variant: collapsed rail** state
4. **Variant: tablet (768–1024px) layout** showing narrower panel
5. **Phone splash screen**
6. **Component sheet**: truck card variants per status, status badges, KPI tiles, filter chips, search input, segmented speed control, sim clock, map controls
7. **Truck marker spec sheet**: dot + wake + cluster + selected + hover tooltip at multiple zoom levels
8. **Color and type token reference**
