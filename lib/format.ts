function pad(n: number) {
  return n.toString().padStart(2, "0");
}

// 24 h "HH:MM" in port time (GMT), matching the top-bar clock.
export function formatHourMinute(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// Compact duration: "12 s", "8 min", "1 h 22 min".
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec} s`;
  const totalMin = Math.round(totalSec / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return min === 0 ? `${hr} h` : `${hr} h ${min} min`;
}

export function formatAgo(thenMs: number, nowMs: number): string {
  const diff = nowMs - thenMs;
  if (diff < 5000) return "just now";
  return `${formatDuration(diff)} ago`;
}

export function isoToMs(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function compassPoint(headingDeg: number): (typeof COMPASS_POINTS)[number] {
  const normalised = ((headingDeg % 360) + 360) % 360;
  return COMPASS_POINTS[Math.round(normalised / 45) % 8];
}

const COMPASS_WORDS: Record<(typeof COMPASS_POINTS)[number], string> = {
  N: "north",
  NE: "north-east",
  E: "east",
  SE: "south-east",
  S: "south",
  SW: "south-west",
  W: "west",
  NW: "north-west",
};

export function compassWord(headingDeg: number): string {
  return COMPASS_WORDS[compassPoint(headingDeg)];
}

export function formatLatLng(lat: number, lng: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
