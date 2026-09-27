import { STREAM_TICK_INTERVAL_MS } from "@/lib/simulation-config";
import { snapshot, tickSim } from "@/lib/simulator/tick";

type Subscriber = {
  controller: ReadableStreamDefaultController<Uint8Array>;
};

declare global {
  var __gphaBroadcaster:
    | {
        subscribers: Set<Subscriber>;
        tickHandle?: NodeJS.Timeout;
        lastTickMs: number;
        // Latest simulator entry points; refreshed on every module load so a
        // long-lived interval never keeps running hot-reloaded-away code.
        tick: typeof tickSim;
        snapshot: typeof snapshot;
      }
    | undefined;
}

const TICK_INTERVAL_MS = STREAM_TICK_INTERVAL_MS; // wall clock; sim advances by tick*speedMultiplier
const HEARTBEAT_INTERVAL_MS = 15000;

function ensureBroadcaster() {
  if (!globalThis.__gphaBroadcaster) {
    globalThis.__gphaBroadcaster = {
      subscribers: new Set(),
      lastTickMs: Date.now(),
      tick: tickSim,
      snapshot,
    };
  }
  globalThis.__gphaBroadcaster.tick = tickSim;
  globalThis.__gphaBroadcaster.snapshot = snapshot;
  return globalThis.__gphaBroadcaster;
}

const encoder = new TextEncoder();

function sseFormat(event: string, data: unknown): Uint8Array {
  const body = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return encoder.encode(body);
}

function sseComment(text: string): Uint8Array {
  return encoder.encode(`: ${text}\n\n`);
}

function broadcast(event: string, data: unknown) {
  const b = ensureBroadcaster();
  const payload = sseFormat(event, data);
  for (const sub of b.subscribers) {
    try {
      sub.controller.enqueue(payload);
    } catch {
      // ignored — closed subscribers cleaned in cancel()
    }
  }
}

function startTickLoopIfNeeded() {
  const b = ensureBroadcaster();
  if (b.tickHandle) return;
  b.tickHandle = setInterval(() => {
    const now = Date.now();
    const dt = now - b.lastTickMs;
    b.lastTickMs = now;
    b.tick(dt);
    if (b.subscribers.size > 0) {
      broadcast("update", b.snapshot());
    }
    // Periodic heartbeat to keep connection alive
    if (now % HEARTBEAT_INTERVAL_MS < TICK_INTERVAL_MS) {
      const heartbeat = sseComment("heartbeat");
      for (const sub of b.subscribers) {
        try {
          sub.controller.enqueue(heartbeat);
        } catch {
          // ignore
        }
      }
    }
  }, TICK_INTERVAL_MS);
}

export function subscribe(
  controller: ReadableStreamDefaultController<Uint8Array>,
): Subscriber {
  const b = ensureBroadcaster();
  const sub: Subscriber = { controller };
  b.subscribers.add(sub);
  startTickLoopIfNeeded();
  // Send initial snapshot
  controller.enqueue(sseFormat("snapshot", b.snapshot()));
  return sub;
}

export function unsubscribe(sub: Subscriber) {
  const b = ensureBroadcaster();
  b.subscribers.delete(sub);
}
