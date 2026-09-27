import type { VehicleType } from "@/lib/types";

// Two drawings per vehicle type, both painted in the truck's status colour:
//  - a top-down glyph for the map, nose up (north) so MapLibre's
//    icon-rotate can point it along the heading;
//  - a side-view illustration for the panel, where the type reads best.

export const GLYPH_WIDTH = 30;
export const GLYPH_HEIGHT = 56;
const PAD = 5;
export const GLYPH_VIEWBOX_WIDTH = GLYPH_WIDTH + PAD * 2;
export const GLYPH_VIEWBOX_HEIGHT = GLYPH_HEIGHT + PAD * 2;
// Rasterise at 3× so the detail stays crisp on retina screens.
export const GLYPH_PIXEL_RATIO = 3;

const INK = "#16324F";
const TYRE = "#1E2B38";
const GLASS = "#DDEEFA";
const WHITE = "#FFFFFF";

function mix(hex: string, target: number, amount: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const channel = (shift: number) => {
    const c = (n >> shift) & 0xff;
    return Math.round(c + (target - c) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

interface Palette {
  body: string;
  dark: string;
  light: string;
}

function palette(color: string): Palette {
  return {
    body: color,
    dark: mix(color, 0, 0.38),
    light: mix(color, 255, 0.45),
  };
}

// ---------------------------------------------------------------- top-down

const CAB_OUTLINE = `<rect x="6" y="1" width="18" height="13" rx="4"/><rect x="3.4" y="4" width="3" height="2.4" rx="0.9"/><rect x="23.6" y="4" width="3" height="2.4" rx="0.9"/><rect x="12.5" y="13" width="5" height="4"/>`;

function cabDetail(p: Palette) {
  return `<rect x="8" y="2.4" width="14" height="3.8" rx="1.6" fill="${GLASS}"/>
<rect x="9.5" y="8" width="11" height="1.4" rx="0.7" fill="${p.light}"/>
<rect x="9.5" y="10.6" width="11" height="2" rx="1" fill="${p.dark}" opacity="0.35"/>
<rect x="3.4" y="4" width="3" height="2.4" rx="0.9" fill="${INK}"/>
<rect x="23.6" y="4" width="3" height="2.4" rx="0.9" fill="${INK}"/>
<rect x="12.5" y="13.6" width="5" height="3" fill="${INK}"/>`;
}

interface TopDown {
  outline: string;
  detail: (p: Palette) => string;
}

function ribs(from: number, to: number, step: number, draw: (y: number) => string) {
  let out = "";
  for (let y = from; y <= to; y += step) out += draw(y);
  return out;
}

const TOP_DOWN: Record<VehicleType, TopDown> = {
  // Cab pulling a boxed container: roof corrugations and a door end.
  container_truck: {
    outline: `${CAB_OUTLINE}<rect x="3.5" y="16" width="23" height="39" rx="1.5"/>`,
    detail: (p) =>
      cabDetail(p) +
      ribs(18.5, 50, 2.6, (y) => `<rect x="5" y="${y}" width="20" height="0.9" fill="${p.dark}" opacity="0.4"/>`) +
      `<rect x="3.5" y="51.6" width="23" height="3.4" fill="${p.dark}"/>
<rect x="14.6" y="51.8" width="0.8" height="3" fill="${p.light}"/>
<rect x="3.5" y="16" width="2.4" height="2.4" fill="${INK}" opacity="0.55"/>
<rect x="24.1" y="16" width="2.4" height="2.4" fill="${INK}" opacity="0.55"/>`,
  },
  // Open deck carrying strapped crates, stake posts along the edges.
  flatbed: {
    outline: `${CAB_OUTLINE}<rect x="4" y="16" width="22" height="39" rx="1.2"/>`,
    detail: (p) =>
      cabDetail(p) +
      `<rect x="4" y="16" width="22" height="39" rx="1.2" fill="${p.dark}"/>
<rect x="6.2" y="18.4" width="17.6" height="15.4" rx="1.2" fill="${p.body}"/>
<rect x="6.2" y="36.6" width="17.6" height="15.4" rx="1.2" fill="${p.body}"/>
<rect x="6.2" y="23.4" width="17.6" height="0.7" fill="${p.dark}" opacity="0.35"/>
<rect x="6.2" y="28.4" width="17.6" height="0.7" fill="${p.dark}" opacity="0.35"/>
<rect x="6.2" y="41.6" width="17.6" height="0.7" fill="${p.dark}" opacity="0.35"/>
<rect x="6.2" y="46.6" width="17.6" height="0.7" fill="${p.dark}" opacity="0.35"/>
<rect x="4" y="25.2" width="22" height="1.5" fill="${WHITE}" opacity="0.9"/>
<rect x="4" y="43.4" width="22" height="1.5" fill="${WHITE}" opacity="0.9"/>` +
      ribs(18, 52, 8.5, (y) => `<rect x="4" y="${y}" width="1.4" height="1.4" fill="${INK}"/><rect x="24.6" y="${y}" width="1.4" height="1.4" fill="${INK}"/>`),
  },
  // Rounded tank with a highlight, a top walkway and three hatches.
  tanker: {
    outline: `${CAB_OUTLINE}<rect x="4" y="16" width="22" height="39" rx="10.5"/>`,
    detail: (p) =>
      cabDetail(p) +
      `<rect x="7.2" y="20" width="3.6" height="31" rx="1.8" fill="${WHITE}" opacity="0.35"/>
<rect x="14.1" y="19" width="1.8" height="33" fill="${p.dark}" opacity="0.55"/>
<rect x="4" y="29.4" width="22" height="1" fill="${p.dark}" opacity="0.45"/>
<rect x="4" y="41.4" width="22" height="1" fill="${p.dark}" opacity="0.45"/>
<circle cx="15" cy="24" r="2.6" fill="${p.light}" stroke="${p.dark}" stroke-width="0.8"/>
<circle cx="15" cy="35.5" r="2.6" fill="${p.light}" stroke="${p.dark}" stroke-width="0.8"/>
<circle cx="15" cy="47" r="2.6" fill="${p.light}" stroke="${p.dark}" stroke-width="0.8"/>`,
  },
  // Port yard tractor: offset one-seat cab, exhaust stack and fifth wheel.
  terminal_tractor: {
    outline: `<rect x="5" y="7" width="20" height="40" rx="4.5"/><rect x="2.6" y="10" width="3" height="2.4" rx="0.9"/>`,
    detail: (p) =>
      `<rect x="2.6" y="10" width="3" height="2.4" rx="0.9" fill="${INK}"/>
<rect x="5.8" y="7.8" width="11.4" height="15" rx="3" fill="${p.dark}"/>
<rect x="7" y="9" width="9" height="4.4" rx="1.4" fill="${GLASS}"/>
<rect x="7" y="15" width="9" height="1.2" rx="0.6" fill="${p.light}"/>
<circle cx="21" cy="11" r="1.7" fill="${INK}"/>
<rect x="19" y="15" width="4" height="0.8" fill="${p.dark}" opacity="0.5"/>
<rect x="19" y="17" width="4" height="0.8" fill="${p.dark}" opacity="0.5"/>
<rect x="19" y="19" width="4" height="0.8" fill="${p.dark}" opacity="0.5"/>
<circle cx="15" cy="36" r="6.4" fill="${INK}" opacity="0.85"/>
<circle cx="15" cy="36" r="3.4" fill="${p.dark}"/>
<path d="M13.9 36h2.2v8h-2.2z" fill="${p.body}"/>`,
  },
};

function topDownSvg(body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${GLYPH_VIEWBOX_WIDTH} ${GLYPH_VIEWBOX_HEIGHT}">${body}</svg>`;
}

// Map marker: white keyline and soft shadow (sticker look), status-coloured
// body, then the type's detail on top.
export function truckGlyphSvg(vehicleType: VehicleType, color: string) {
  const shape = TOP_DOWN[vehicleType];
  const p = palette(color);
  return topDownSvg(
    `<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="1.1" flood-color="${INK}" flood-opacity="0.35"/></filter>` +
      `<g filter="url(#s)" fill="${WHITE}" stroke="${WHITE}" stroke-width="3" stroke-linejoin="round">${shape.outline}</g>` +
      `<g fill="${p.body}">${shape.outline}</g>` +
      shape.detail(p),
  );
}

// Ink silhouette drawn under the selected vehicle, fattened by the stroke so
// an ink ring shows outside the white keyline.
export function truckSelectionSvg(vehicleType: VehicleType) {
  return topDownSvg(
    `<g fill="${INK}" stroke="${INK}" stroke-width="8" stroke-linejoin="round">${TOP_DOWN[vehicleType].outline}</g>`,
  );
}

// ---------------------------------------------------------------- side view

export const SIDE_VIEW_WIDTH = 64;
export const SIDE_VIEW_HEIGHT = 34;

function wheel(cx: number, r = 4) {
  return `<circle cx="${cx}" cy="${30 - r + 4}" r="${r}" fill="${TYRE}"/><circle cx="${cx}" cy="${30 - r + 4}" r="${r * 0.42}" fill="#C9D3DC"/>`;
}

// Forward-facing (right) cab shared by the three road trucks.
function sideCab(p: Palette) {
  return `<path d="M45 25V11.5a3.5 3.5 0 0 1 3.5-3.5h6.2l5.3 6.4V25z" fill="${p.body}"/>
<path d="M49 10.4h5l3.8 4.6H49z" fill="${GLASS}"/>
<rect x="48.2" y="17" width="0.8" height="7" fill="${p.dark}" opacity="0.5"/>
<rect x="51" y="18.2" width="3" height="0.9" rx="0.45" fill="${p.dark}" opacity="0.6"/>
<rect x="58.4" y="17" width="1.8" height="2" rx="0.6" fill="#FFE8A3"/>
<rect x="57.6" y="22.4" width="3.6" height="3" rx="0.8" fill="${INK}"/>
<rect x="44" y="12" width="1.2" height="4" rx="0.6" fill="${INK}"/>`;
}

const SIDE_VIEW: Record<VehicleType, (p: Palette) => string> = {
  container_truck: (p) =>
    `<rect x="2" y="24" width="57" height="3" rx="1" fill="${INK}"/>
<rect x="2" y="5" width="40" height="19" rx="1" fill="${p.body}"/>` +
    Array.from({ length: 12 }, (_, i) => `<rect x="${5 + i * 3}" y="7" width="1" height="15" fill="${p.dark}" opacity="0.3"/>`).join("") +
    `<rect x="2" y="5" width="40" height="1.6" fill="${p.dark}" opacity="0.5"/>
<rect x="2" y="22.4" width="40" height="1.6" fill="${p.dark}" opacity="0.5"/>
<rect x="37.5" y="7" width="3" height="15" fill="${p.dark}" opacity="0.35"/>` +
    sideCab(p) +
    wheel(8) + wheel(17) + wheel(38) + wheel(54),
  flatbed: (p) =>
    `<rect x="2" y="24" width="57" height="3" rx="1" fill="${INK}"/>
<rect x="2" y="20" width="41" height="4" rx="0.8" fill="${p.dark}"/>
<rect x="4" y="11" width="16" height="9" rx="1" fill="${p.body}"/>
<rect x="21.5" y="13" width="19.5" height="7" rx="1" fill="${p.body}"/>
<rect x="21.5" y="8" width="11" height="5" rx="1" fill="${p.light}"/>
<rect x="11.4" y="11" width="1.2" height="9" fill="${WHITE}" opacity="0.85"/>
<rect x="30.4" y="8" width="1.2" height="12" fill="${WHITE}" opacity="0.85"/>
<rect x="2" y="15" width="1.4" height="5" fill="${INK}"/>
<rect x="41.6" y="15" width="1.4" height="5" fill="${INK}"/>` +
    sideCab(p) +
    wheel(8) + wheel(17) + wheel(38) + wheel(54),
  tanker: (p) =>
    `<rect x="2" y="24" width="57" height="3" rx="1" fill="${INK}"/>
<rect x="2" y="6" width="41" height="17" rx="8.5" fill="${p.body}"/>
<rect x="7" y="8.6" width="31" height="2.6" rx="1.3" fill="${WHITE}" opacity="0.4"/>
<rect x="15" y="6" width="1.4" height="17" fill="${p.dark}" opacity="0.4"/>
<rect x="29" y="6" width="1.4" height="17" fill="${p.dark}" opacity="0.4"/>
<rect x="9" y="3.6" width="5" height="2.6" rx="0.8" fill="${p.dark}"/>
<rect x="20" y="3.6" width="5" height="2.6" rx="0.8" fill="${p.dark}"/>
<rect x="31" y="3.6" width="5" height="2.6" rx="0.8" fill="${p.dark}"/>
<rect x="6" y="23" width="33" height="1.2" fill="${INK}"/>` +
    sideCab(p) +
    wheel(8) + wheel(17) + wheel(38) + wheel(54),
  terminal_tractor: (p) =>
    `<path d="M10 25v-4.5l4-2h18V25z" fill="${p.dark}"/>
<rect x="12" y="16.6" width="15" height="2.4" rx="1" fill="${INK}"/>
<rect x="8" y="24" width="48" height="3.4" rx="1.2" fill="${INK}"/>
<path d="M33 25V5.5A2.5 2.5 0 0 1 35.5 3H49a3 3 0 0 1 3 3v19z" fill="${p.body}"/>
<rect x="36" y="6" width="13" height="9" rx="1.6" fill="${GLASS}"/>
<rect x="36" y="17.5" width="13" height="1" rx="0.5" fill="${p.dark}" opacity="0.5"/>
<rect x="52" y="14" width="4.5" height="10" rx="1.2" fill="${p.body}"/>
<rect x="53" y="16" width="2.6" height="0.9" fill="${p.dark}" opacity="0.6"/>
<rect x="53" y="18.4" width="2.6" height="0.9" fill="${p.dark}" opacity="0.6"/>
<rect x="30.6" y="2" width="1.6" height="14" rx="0.8" fill="${INK}"/>
<circle cx="42.5" cy="2.2" r="1.4" fill="#FFB020"/>` +
    wheel(19, 5) + wheel(47, 5),
};

// Side-view illustration for list rows, cards and the detail header.
export function truckSideSvgMarkup(vehicleType: VehicleType, color: string) {
  return SIDE_VIEW[vehicleType](palette(color));
}

export const OFFLINE_BADGE_SIZE = 14;

// Small "!" disc pinned to vehicles that have lost signal.
export function offlineBadgeSvg(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="${color}" stroke="${WHITE}" stroke-width="1.5"/><rect x="6.1" y="3.2" width="1.8" height="4.8" rx="0.9" fill="#FFFFFF"/><circle cx="7" cy="10.1" r="1" fill="#FFFFFF"/></svg>`;
}

export function svgDataUrl(markup: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}
