# rocketdash

Rocket League stats dashboard for jay29ID and Kobra Kelvin. The recorder on each PC uploads every finished match here, and the page shows totals, streaks, the last session, trends, MMR and goal maps.

No dependencies: `npm start` runs `server.js` on Node 18+.

## Settings (environment variables)

| Name | What it does |
|---|---|
| `VIEW_KEY` | Secret for the share link. Open `https://<site>/s/<VIEW_KEY>` once and the browser stays signed in. |
| `UPLOAD_KEY` | Secret the recorder sends in the `X-Upload-Key` header. |
| `DATA_DIR` | Folder for `store.json`. On Railway this is the volume, `/data`. |
| `PLAYERS` | Tracked players, comma separated. Default `jay29ID,Kobra Kelvin`. |

## Endpoints

- `POST /api/ingest` with `X-Upload-Key`: body `{ "kind": "match" | "mmr", "data": {...} }`, as sent by the recorder.
- `GET /api/data`, `POST /api/mmr`, `POST /api/import`: used by the page; need the share-link cookie.
- `GET /healthz`

Both PCs upload shared matches, so matches are merged by `match_guid`. The copy with a real result, boost stats and goal positions wins, and missing fields are filled from the other copy. MMR rows are kept per player, playlist and time.

## Recorder updates

`recorder/` holds the recorder and widget files both PCs run. Push a change there and Railway redeploys the site. The widget calls `GET /api/recorder/manifest` (with `X-Upload-Key`) when it starts, compares each file's `sha256` with its own copy, and downloads changed files from `GET /api/recorder/file/<name>`.
