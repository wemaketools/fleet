import { subscribe, unsubscribe } from "@/lib/sse/broadcaster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let sub: ReturnType<typeof subscribe> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      sub = subscribe(controller);
    },
    cancel() {
      if (sub) unsubscribe(sub);
    },
  });

  req.signal?.addEventListener("abort", () => {
    if (sub) unsubscribe(sub);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
