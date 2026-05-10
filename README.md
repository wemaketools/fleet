# GPHA Cargo Tracker

A pitch-ready proof of concept for Ghana Ports and Harbours Authority: a live Tema Port operations dashboard with simulated cargo trucks, status changes, route progress, and a searchable fleet panel.

## Getting Started

Install dependencies and run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

For the intended demo experience, open the app on desktop or tablet.

## Demo Flow

- The first load connects to the SSE simulator and fills the fleet list from the live snapshot.
- Trucks move around the Tema port map with wake trails, clustering, and a selected-truck pulse.
- Use search to find a truck by ID, plate, or driver, then click a card or marker for live details.
- Toggle status chips to isolate in-transit, loading, unloading, idle, or offline vehicles.
- Select a moving truck and enable Follow to keep it in view while the route progress updates.
- Use the speed control to accelerate the pitch narrative and trigger dwell/status changes quickly.

## Pitch Talking Points

- Real GPS feeds can replace the simulator behind the same stream contract.
- The dashboard is intentionally database-free for the POC, keeping the live demo cheap and simple.
- The UI already demonstrates operational patterns GPHA will care about: live location, cargo context, last stop, route progress, offline vehicles, and recent unload history.
- SSE is a good fit for one-way tracker updates and works well with Vercel-hosted Node.js functions.

## Phase 2 Backlog

- Real GPS ingestion via authenticated webhook.
- Persistence with Postgres for truck history and replay.
- Historical playback with a time scrubber.
- Dwell-time reports and berth throughput analytics.
- Alert rules for long stops, route deviation, and offline trackers.
- Auth and operator/supervisor roles.
- Multi-port support for Takoradi and future terminals.
- Geofencing and manifest/customs integrations.

## Deploy

Deploy on Vercel as a Next.js project. The planned memorable alias is `gpha-tracker.vercel.app`.
