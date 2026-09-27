import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

test("simulation uses slower, frequent updates by default", () => {
  const config = read("lib/simulation-config.ts");
  const store = read("lib/store/useFleetStore.ts");
  const simState = read("lib/simulator/state.ts");
  const broadcaster = read("lib/sse/broadcaster.ts");

  assert.match(config, /DEFAULT_SPEED_MULTIPLIER\s*=\s*2\.5\b/);
  assert.match(config, /STREAM_TICK_INTERVAL_MS\s*=\s*100\b/);
  assert.match(config, /CLIENT_INTERPOLATION_MS\s*=\s*200\b/);
  assert.doesNotMatch(store, /DEFAULT_SPEED_MULTIPLIER/);
  assert.match(simState, /DEFAULT_SPEED_MULTIPLIER/);
  assert.match(broadcaster, /STREAM_TICK_INTERVAL_MS/);
});

test("animation speed and playback are not user-controllable", () => {
  const topBar = read("components/dashboard/TopBar.tsx");
  const store = read("lib/store/useFleetStore.ts");
  const tick = read("lib/simulator/tick.ts");

  assert.doesNotMatch(topBar, /SpeedControl/);
  assert.doesNotMatch(topBar, /Pause|Play|Speed|speed/i);
  assert.doesNotMatch(store, /setSpeedMultiplier/);
  assert.doesNotMatch(tick, /setSpeedMultiplier/);
  assert.equal(
    existsSync(join(root, "components/dashboard/SpeedControl.tsx")),
    false,
  );
  assert.equal(existsSync(join(root, "app/api/stream/speed/route.ts")), false);
});

test("map emphasizes vehicle icons over wake trails", () => {
  const config = read("lib/simulation-config.ts");
  const map = read("components/map/PortMap.tsx");

  assert.match(config, /WAKE_LENGTH\s*=\s*3\b/);
  assert.match(config, /WAKE_LINE_OPACITY\s*=\s*0\.08\b/);
  assert.match(config, /VEHICLE_DOT_RADIUS\s*=\s*12\b/);
  assert.match(config, /SELECTED_VEHICLE_DOT_RADIUS\s*=\s*16\b/);
  assert.match(map, /WAKE_LINE_OPACITY/);
  assert.match(map, /VEHICLE_DOT_RADIUS/);
  assert.match(map, /map\.setPaintProperty\(\s*"trucks-halo"/);
  assert.match(map, /bringVehicleLayersToFront/);
  assert.match(map, /const \[mapReady, setMapReady\] = useState\(false\)/);
  assert.match(map, /setMapReady\(true\)/);
  assert.match(map, /if \(!mapReady\) return/);
  assert.match(map, /trucksSrc\.setData/);
});

test("map halo pulse is limited to selected vehicles", () => {
  const map = read("components/map/PortMap.tsx");
  const haloStart = map.indexOf('id: "trucks-halo"');
  const haloEnd = map.indexOf('if (!map.getLayer("trucks-vehicle"))');
  const haloLayer = map.slice(haloStart, haloEnd);

  assert.match(haloLayer, /filter:\s*\[\s*"all"/);
  assert.match(haloLayer, /\["boolean",\s*\["get",\s*"selected"\],\s*false\]/);
});

test("vehicles render as varied top-down truck vectors", () => {
  const map = read("components/map/PortMap.tsx");

  assert.match(map, /heading: t\.currentLocation\.heading/);
  assert.match(map, /vehicleType: t\.vehicleType/);
  assert.match(map, /vehicleIcon: truckIconId\(t\.vehicleType, t\.status\)/);
  assert.match(map, /vehicleBearing:\s*bearings\.get\(t\.id\) \?\?\s*\(t\.status === "in_transit" \? t\.currentLocation\.heading : 0\)/);
  assert.match(map, /function registerTruckImages\(map: maplibregl\.Map\)/);
  assert.match(map, /"container_truck"/);
  assert.match(map, /"flatbed"/);
  assert.match(map, /"tanker"/);
  assert.match(map, /"terminal_tractor"/);
  assert.match(map, /id: "trucks-vehicle"/);
  assert.match(map, /"icon-image": \["get", "vehicleIcon"\]/);
  assert.match(map, /"icon-rotate": \["get", "vehicleBearing"\]/);
  assert.match(map, /interactiveLayerIds=\{\["trucks-vehicle", "clusters"\]\}/);
  assert.doesNotMatch(map, /id: "trucks-dot"/);
  assert.doesNotMatch(map, /id: "trucks-arrow"/);
  assert.doesNotMatch(map, /"text-field": "▲"/);
});

test("each vehicle type has a detailed top-down glyph and a side view", () => {
  const glyphs = read("components/map/vehicleGlyphs.ts");
  const topStart = glyphs.indexOf("const TOP_DOWN");
  const topEnd = glyphs.indexOf("function topDownSvg");
  const sideStart = glyphs.indexOf("const SIDE_VIEW");
  const sideEnd = glyphs.indexOf("export function truckSideSvgMarkup");

  assert.match(glyphs, /export function truckGlyphSvg/);
  assert.match(glyphs, /export function truckSideSvgMarkup/);
  // Sticker look on the light map: white keyline plus a soft shadow.
  assert.match(glyphs, /feDropShadow/);
  assert.match(glyphs, /fill="\$\{WHITE\}" stroke="\$\{WHITE\}"/);
  for (const type of ["container_truck", "flatbed", "tanker", "terminal_tractor"]) {
    assert.match(glyphs.slice(topStart, topEnd), new RegExp(`${type}:`));
    assert.match(glyphs.slice(sideStart, sideEnd), new RegExp(`${type}:`));
  }
  const avatar = read("components/ui/TruckAvatar.tsx");
  assert.match(avatar, /truckSideSvgMarkup\(vehicleType, STATUS_COLORS\[status\]\)/);
});

test("status palette uses shipping-container colours with an icon each", () => {
  const types = read("lib/types.ts");
  const globals = read("app/globals.css");
  const strip = read("components/dashboard/StatusStrip.tsx");
  const icons = read("components/ui/StatusIcon.tsx");

  assert.match(types, /in_transit:\s*"#2B6FE0"/);
  assert.match(types, /loading:\s*"#FFA62B"/);
  assert.match(types, /unloading:\s*"#0C8F87"/);
  assert.match(types, /idle:\s*"#8C9CAD"/);
  assert.match(types, /offline:\s*"#E5484D"/);
  assert.match(types, /STATUS_COLOR_VARS/);
  assert.match(types, /STATUS_ON_COLOR/);

  assert.match(globals, /--status-transit:\s*#2b6fe0/i);
  assert.match(globals, /--status-loading:\s*#ffa62b/i);
  assert.match(globals, /--status-unloading:\s*#0c8f87/i);
  assert.match(globals, /--status-idle:\s*#8c9cad/i);
  assert.match(globals, /--status-offline:\s*#e5484d/i);

  // Header tiles are flat: a tint, a solid icon disc, no bevel or ribs.
  assert.doesNotMatch(globals, /container-side|repeating-linear-gradient/);
  assert.match(strip, /<StatusIcon status=\{status\}/);
  assert.match(icons, /STATUS_ICONS: Record<TruckStatus, LucideIcon>/);

  // Plain operator words instead of system states.
  assert.match(types, /in_transit: "Moving"/);
  assert.match(types, /idle: "Parked"/);
  assert.match(types, /offline: "No signal"/);
});

test("number plates are plain, bold and free of flag bands", () => {
  const plate = read("components/ui/PlateBadge.tsx");

  assert.doesNotMatch(plate, /#CE1126|#FCD116|#006B3F/i);
  assert.match(plate, /font-bold/);
  assert.match(plate, /aria-label=\{`Plate \$\{plate\}`\}/);
});

test("typography is Rubik throughout with no monospace labels", () => {
  const layout = read("app/layout.tsx");
  const globals = read("app/globals.css");

  assert.match(layout, /\bRubik\b/);
  assert.match(layout, /--font-rubik/);
  assert.doesNotMatch(layout, /Geist_Mono|Inter\b/);
  assert.match(globals, /--font-sans:\s*var\(--font-rubik\)/);
  assert.match(globals, /font-variant-numeric:\s*tabular-nums/);
  for (const file of [
    "components/panel/TruckRow.tsx",
    "components/panel/TruckDetail.tsx",
    "components/dashboard/StatusStrip.tsx",
    "components/map/PortMap.tsx",
  ]) {
    assert.doesNotMatch(read(file), /font-mono|uppercase/, file);
  }
});

test("header status tiles act as status filters", () => {
  const strip = read("components/dashboard/StatusStrip.tsx");
  const topBar = read("components/dashboard/TopBar.tsx");

  assert.equal(existsSync(join(root, "components/dashboard/StatusTiles.tsx")), false);
  assert.match(topBar, /<StatusStrip \/>/);
  assert.match(topBar, /<LiveIndicator \/>/);
  assert.match(strip, /toggleStatusFilter/);
  assert.match(strip, /aria-pressed=\{active\}/);
  assert.match(strip, /<button/);
});

test("fleet rows pair a truck avatar with a plain-language status line", () => {
  const row = read("components/panel/TruckRow.tsx");
  const detail = read("components/panel/TruckDetail.tsx");

  assert.equal(existsSync(join(root, "components/panel/TruckCard.tsx")), false);
  assert.match(row, /<TruckAvatar vehicleType=\{truck\.vehicleType\} status=\{truck\.status\} \/>/);
  assert.match(row, /<PlateBadge plate=\{truck\.plateNumber\}/);
  assert.match(row, /statusSentence\(truck\)/);
  assert.match(row, /className="text-\[15px\] font-semibold text-ink truncate"/);
  assert.doesNotMatch(row, /style=\{\{ color \}\}/);
  assert.match(detail, /<Journey route=\{truck\.currentRoute\}/);
  assert.match(detail, /href=\{`tel:/);
});

test("berths are quay-edge lines and yards show container rows", () => {
  const map = read("components/map/PortMap.tsx");
  const overlay = JSON.parse(read("data/port-overlay.json"));

  // Berths: a stretch of quay edge with a label that follows it.
  const berths = overlay.features.filter((f) => f.properties.kind === "berth");
  assert.equal(berths.length, 4);
  for (const berth of berths) assert.equal(berth.geometry.type, "LineString");
  assert.match(map, /id="port-berths"/);
  assert.match(map, /id="port-berth-labels"/);
  assert.match(map, /"symbol-placement": "line-center"/);
  assert.doesNotMatch(map, /port-berths-fill|SIGN_BERTH/);

  // Yards: container-row pattern with a plain text label in the corner.
  assert.match(map, /function roundedCornerPath/);
  assert.match(map, /const zoneShapes: FeatureCollection<Polygon>/);
  assert.match(map, /id="port-yards-fill"/);
  assert.match(map, /"line-dasharray"/);
  assert.match(map, /const zoneLabels: FeatureCollection<Point>/);
  assert.match(map, /"text-anchor": "top-left"/);
  assert.match(map, /const containerStacks: FeatureCollection<Polygon>/);
  assert.match(map, /id="port-yard-stacks"/);
  assert.doesNotMatch(map, /addSignImage|icon-text-fit/);
  const order = map.slice(map.indexOf("const VEHICLE_LAYER_ORDER"));
  assert.ok(order.indexOf('"port-zone-labels"') > order.indexOf('"trucks-vehicle"'));
});

test("selected truck route is drawn on the map", () => {
  const map = read("components/map/PortMap.tsx");
  const pathing = read("lib/simulator/pathing.ts");

  assert.match(pathing, /export function routeToLineString/);
  assert.match(pathing, /export function splitLineAt/);
  assert.match(map, /map\.addSource\("route"/);
  assert.match(map, /id: "route-remaining"/);
  assert.match(map, /id: "route-travelled"/);
  assert.match(map, /id: "route-destination"/);
  assert.match(map, /routeSrc\.setData/);
});

test("top bar clock shows current time only", () => {
  const clock = read("components/dashboard/SimClock.tsx");
  const now = read("lib/hooks/useNow.ts");
  const store = read("lib/store/useFleetStore.ts");
  const stream = read("lib/hooks/useFleetStream.ts");

  assert.match(now, /useSyncExternalStore/);
  assert.match(now, /let clockNow = 0/);
  assert.match(now, /getServerNowSnapshot/);
  assert.match(now, /return 0;/);
  assert.doesNotMatch(now, /return Date\.now\(\);/);
  assert.match(clock, /useNow\(\)/);
  assert.match(clock, /now === 0/);
  assert.match(clock, /suppressHydrationWarning/);
  assert.match(clock, /formatTime\(new Date\(now\)\)/);
  assert.match(clock, /GMT/);
  assert.doesNotMatch(clock, /sim/);
  assert.doesNotMatch(clock, /wall/);
  assert.doesNotMatch(clock, /liveSim/);
  assert.doesNotMatch(clock, /simTime/);
  assert.doesNotMatch(clock, /speedMultiplier/);
  assert.doesNotMatch(store, /simTime/);
  assert.doesNotMatch(store, /speedMultiplier/);
  assert.doesNotMatch(stream, /simTime/);
  assert.doesNotMatch(stream, /speedMultiplier/);
});

test("panel never shows raw node ids", () => {
  for (const file of [
    "components/panel/TruckRow.tsx",
    "components/panel/TruckDetail.tsx",
    "components/map/PortMap.tsx",
    "lib/status-copy.ts",
  ]) {
    assert.doesNotMatch(read(file), /NodeId\.replace\(/, file);
  }
  assert.match(read("lib/status-copy.ts"), /nodeName\(truck\.currentRoute\.destinationNodeId\)/);
  assert.match(read("components/panel/TruckDetail.tsx"), /nodeName\(id\)/);
});

test("status filters also fade other trucks on the map", () => {
  const map = read("components/map/PortMap.tsx");

  assert.match(map, /statusFilter\.size > 0 &&\s*!statusFilter\.has\(t\.status\) &&\s*t\.id !== selectedId/);
  assert.match(map, /\["boolean", \["get", "muted"\], false\]/);
});

test("seed timestamps are rebased onto boot time", () => {
  const state = read("lib/simulator/state.ts");
  const tick = read("lib/simulator/tick.ts");

  assert.match(state, /SEED_CAPTURED_AT_MS = Date\.parse\("2026-05-10T14:23:00Z"\)/);
  assert.match(state, /rebaseSeedTimestamps\(truck, seedOffsetMs\)/);
  // User-facing timestamps are wall-clock so they agree with the header clock.
  assert.doesNotMatch(tick, /timestamp: new Date\(sim\.simTimeMs\)/);
  assert.match(tick, /timestamp: nowIso/);
});

test("Next.js development route indicator is hidden", () => {
  const nextConfig = read("next.config.ts");

  assert.match(nextConfig, /devIndicators:\s*false/);
});
