# rocketdash

Rocket League stats dashboard for jay29ID and Kobra Kelvin. The recorder on each PC uploads every finished match here, and the page shows totals, streaks, the last session, trends, MMR and goal maps.

No dependencies: `npm start` runs `server.js` on Node 18+.

## Settings (environment variables)

| Name | What it does |
|---|---|
| `VIEW_KEY` | Secret for the share link. Open `https://<site>/s/<VIEW_KEY>` once and the browser stays signed in. |
| `UPLOAD_KEY` | Secret the recorder sends in the `X-Upload-Key` header. |
| `DATA_DIR` | Folder for `store.json`. On Railway this is the volume, `/data`. |
| `PLAYERS` | Players the dashboard shows, comma separated, up to four. Default `jay29ID,Kobra Kelvin`. |

## Running your own copy

The site runs anywhere Node 18+ does. On your own PC, in PowerShell:

```powershell
$env:VIEW_KEY = 'pick-a-view-secret'
$env:UPLOAD_KEY = 'pick-an-upload-secret'
$env:PLAYERS = 'YourName'
npm start
```

Then point the recorder at it with `Documents\RLStats\upload.json`:

```json
{ "url": "http://localhost:3000/api/ingest", "key": "pick-an-upload-secret" }
```

Open `http://localhost:3000/s/pick-a-view-secret` once to sign in. Data is kept in `data\store.json`. The sign-in cookie is `Secure`, so other devices need the site behind HTTPS.

The widget records the names set under **Players...** (in the tray menu and the theme menu) as your team, and asks for them the first time it starts. Every player's stats are saved for every match, so adding a regular teammate to `PLAYERS` later also fills in their past games.

## Endpoints

- `POST /api/ingest` with `X-Upload-Key`: body `{ "kind": "match" | "mmr", "data": {...} }`, as sent by the recorder.
- `GET /api/data`, `POST /api/mmr`, `POST /api/import`: used by the page; need the share-link cookie.
- `GET /healthz`

Both PCs upload shared matches, so matches are merged by `match_guid`. The copy with a real result, boost stats and goal positions wins, and missing fields are filled from the other copy. MMR rows are kept per player, playlist and time.

## Recorder updates

`recorder/` holds the recorder and widget files both PCs run. Push a change there and Railway redeploys the site. The widget calls `GET /api/recorder/manifest` (with `X-Upload-Key`) when it starts, compares each file's `sha256` with its own copy, and downloads changed files from `GET /api/recorder/file/<name>`.
