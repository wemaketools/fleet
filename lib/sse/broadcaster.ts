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
    };
  }
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
    tickSim(dt);
    if (b.subscribers.size > 0) {
      broadcast("update", snapshot());
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
  controller.enqueue(sseFormat("snapshot", snapshot()));
  return sub;
}

export function unsubscribe(sub: Subscriber) {
  const b = ensureBroadcaster();
  b.subscribers.delete(sub);
}
