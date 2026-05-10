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
  assert.match(config, /CLIENT_INTERPOLATION_MS\s*=\s*140\b/);
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
  assert.match(map, /vehicleBearing:\s*t\.status === "in_transit" \? t\.currentLocation\.heading : 0/);
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

test("vehicle svg strokes use the status color", () => {
  const map = read("components/map/PortMap.tsx");
  const svgStart = map.indexOf("function truckBodySvg");
  const svgEnd = map.indexOf("function registerTruckImages");
  const truckSvgCode = map.slice(svgStart, svgEnd);

  assert.match(truckSvgCode, /stroke="\$\{color\}"/);
  assert.doesNotMatch(truckSvgCode, /stroke="#(?:F8FAFC|CBD5E1|DBEAFE)"/);
});

test("vehicle status palette matches operations colors", () => {
  const types = read("lib/types.ts");

  assert.match(types, /in_transit:\s*"#22C55E"/);
  assert.match(types, /loading:\s*"#F59E0B"/);
  assert.match(types, /unloading:\s*"#EC4899"/);
  assert.match(types, /idle:\s*"#EF4444"/);
  assert.match(types, /offline:\s*"#D1D5DB"/);
});

test("sans typography uses Helvetica while mono keeps Geist Mono", () => {
  const layout = read("app/layout.tsx");
  const globals = read("app/globals.css");

  assert.match(layout, /Geist_Mono/);
  assert.match(layout, /--font-geist-mono/);
  assert.doesNotMatch(layout, /\bGeist\b/);
  assert.doesNotMatch(layout, /--font-geist-sans/);
  assert.match(globals, /--font-sans:\s*Helvetica,\s*Arial,\s*sans-serif;/);
  assert.match(globals, /--font-mono:\s*var\(--font-geist-mono\);/);
});

test("status tile values are horizontally centered", () => {
  const statusTiles = read("components/dashboard/StatusTiles.tsx");

  assert.match(statusTiles, /className="[^"]*items-center[^"]*min-w-22\.5[^"]*"/);
  assert.match(
    statusTiles,
    /className="[^"]*text-center[^"]*text-xl[^"]*tabular-nums[^"]*"/,
  );
});

test("right panel uses colored titles instead of left status borders", () => {
  const truckCard = read("components/panel/TruckCard.tsx");
  const truckDetail = read("components/panel/TruckDetail.tsx");

  assert.doesNotMatch(truckCard, /absolute left-0 top-0 bottom-0 w-1/);
  assert.doesNotMatch(truckCard, /overflow-hidden/);
  assert.match(truckCard, /style=\{\{ color \}\}/);
  assert.match(
    truckCard,
    /className="font-mono text-\[12px\] font-semibold truncate"/,
  );
  assert.match(truckDetail, /style=\{\{ color \}\}/);
  assert.match(
    truckDetail,
    /className="mt-3 font-mono text-\[22px\] font-semibold leading-tight"/,
  );
});

test("yard regions render as rounded borders without fill backgrounds", () => {
  const map = read("components/map/PortMap.tsx");
  const yardStart = map.indexOf('id="yard-borders"');
  const yardEnd = map.indexOf("</Source>", yardStart);
  const yardLayer = map.slice(yardStart, yardEnd);

  assert.match(map, /const roundedYardBorders = buildRoundedYardBorders/);
  assert.match(map, /function roundedCornerPath/);
  assert.match(yardLayer, /id="yard-borders"/);
  assert.match(yardLayer, /type="line"/);
  assert.match(yardLayer, /"line-color": "#64748B"/);
  assert.match(yardLayer, /"line-width": 1\.4/);
  assert.match(yardLayer, /"line-opacity": 0\.375/);
  assert.match(yardLayer, /"line-join": "round"/);
  assert.match(yardLayer, /"line-cap": "round"/);
  assert.doesNotMatch(yardLayer, /fill-color/);
  assert.doesNotMatch(yardLayer, /fill-opacity/);
  assert.doesNotMatch(yardLayer, /fill-outline-color/);
});

test("berth regions render as rounded borders without fill backgrounds", () => {
  const map = read("components/map/PortMap.tsx");
  const berthStart = map.indexOf('id="berth-borders"');
  const berthEnd = map.indexOf("</Source>", berthStart);
  const berthLayer = map.slice(berthStart, berthEnd);

  assert.match(map, /const roundedBerthBorders = buildRoundedBerthBorders/);
  assert.match(map, /function roundedCornerPath/);
  assert.match(berthLayer, /id="berth-borders"/);
  assert.match(berthLayer, /id="port-berths"/);
  assert.match(berthLayer, /type="line"/);
  assert.match(berthLayer, /"line-color": "#60A5FA"/);
  assert.match(berthLayer, /"line-width": 1\.4/);
  assert.match(berthLayer, /"line-opacity": 0\.375/);
  assert.match(berthLayer, /"line-join": "round"/);
  assert.match(berthLayer, /"line-cap": "round"/);
  assert.doesNotMatch(berthLayer, /fill-color/);
  assert.doesNotMatch(berthLayer, /fill-opacity/);
  assert.doesNotMatch(berthLayer, /fill-outline-color/);
});

test("top bar clock shows current time only", () => {
  const clock = read("components/dashboard/SimClock.tsx");
  const store = read("lib/store/useFleetStore.ts");
  const stream = read("lib/hooks/useFleetStream.ts");

  assert.match(clock, /useSyncExternalStore/);
  assert.match(clock, /let clockNow = 0/);
  assert.match(clock, /getServerNowSnapshot/);
  assert.match(clock, /return 0;/);
  assert.match(clock, /if \(now === 0\)/);
  assert.match(clock, /suppressHydrationWarning/);
  assert.match(clock, /formatTime\(new Date\(now\)\)/);
  assert.doesNotMatch(clock, /return Date\.now\(\);/);
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

test("Next.js development route indicator is hidden", () => {
  const nextConfig = read("next.config.ts");

  assert.match(nextConfig, /devIndicators:\s*false/);
});
