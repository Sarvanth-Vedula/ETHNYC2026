# PulseVault — Canton consent dApp (web UI)

A web dApp that talks directly to the **Canton / Daml ledger** over the JSON
Ledger API. It shows **which party you are acting as** (Patient / Insurer / Doctor)
and the **live data-visibility difference** between them — the core of the Canton
privacy story. Every button is a real ledger `create` / `query` / `exercise`, not
local state (see `src/ledger.ts`).

## What you can do in it

- **Patient** — create your health summary (it references your Walrus blob ID),
  grant/revoke Insurer or Doctor, and approve incoming access requests.
- **Insurer** — request access; once the patient approves, the record appears and
  you can `FetchSummary` (risk band + Walrus blob ID). Before consent you see nothing.
- **Doctor** — sees nothing unless explicitly granted.

Switch the party tab and watch the same ledger show different data to different
parties — that's Canton's sub-transaction privacy on screen.

## Run locally

```bash
# 1. From ../ (the canton project), start the ledger + JSON API:
cd .. && daml start          # sandbox :6865, JSON API :7575

# 2. In another terminal, run the dApp:
cd ui && npm install && npm run dev      # http://localhost:5173
```

The dev server proxies `/v1` to the JSON API on `:7575` (see `vite.config.ts`).
On first load it allocates the three demo parties on the ledger and caches them
in `localStorage`.

## Public URL (for the bounty's "preferred" requirement)

```bash
npm run build        # -> dist/
```

Deploy `dist/` to Vercel / Netlify / GitHub Pages. Point it at a reachable JSON
API: for a DevNet demo, host the JSON API for your Seaport-deployed package and
set the proxy/base URL to it, and swap the dev token minting in `src/ledger.ts`
for the JWT your Canton wallet issues (the dev HS256 token is local-sandbox only).

## How it's wired (dev)

```
browser (React)  →  /v1/* (Vite proxy)  →  Daml JSON API :7575  →  Canton sandbox :6865
                     create / query / exercise on HealthData:HealthSummary & AccessRequest
```

Verified: the app builds, the dev server serves it, and `/v1` calls reach the
ledger through the proxy; the full consent flow (create → query as insurer = 0 →
approve → query as insurer = 1 → FetchSummary → doctor = 0) runs over this API.
