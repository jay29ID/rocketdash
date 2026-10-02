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

To run the site on your own Windows PC, run `npm start` with no `VIEW_KEY` or `UPLOAD_KEY` set, or double-click `dashboard.bat`. PowerShell's default execution policy blocks `npm` itself, so in PowerShell use `npm.cmd start` or `.\dashboard.bat`.

It sets up everything recording needs:

- Asks for the players and the Rocket League folder (the one with `TAGame` in it). Enter keeps the saved answer.
- Makes a random view key and upload key the first time. Keys, players and the folder are kept in `data\local.json`.
- Points the recorder at this copy through `Documents\RLStats\upload.json`, asking first if matches currently go to another site.
- Switches on the game's Stats API if it is off, asking for admin rights only if the folder needs them. Restart the game if it was open.
- Starts the site on port 3000 and the RL Stats widget with the same players, then opens the dashboard, signed in.

Matches are kept in `data\store.json`. The sign-in cookie is `Secure`, so other devices need the site behind HTTPS. Every player's stats are saved for every match, so adding a regular teammate later also fills in their past games.

## Endpoints

- `POST /api/ingest` with `X-Upload-Key`: body `{ "kind": "match" | "mmr", "data": {...} }`, as sent by the recorder.
- `GET /api/data`, `POST /api/mmr`, `POST /api/import`: used by the page; need the share-link cookie.
- `GET /healthz`

Both PCs upload shared matches, so matches are merged by `match_guid`. The copy with a real result, boost stats and goal positions wins, and missing fields are filled from the other copy. MMR rows are kept per player, playlist and time.

## Recorder updates

`recorder/` holds the recorder and widget files both PCs run. Push a change there and Railway redeploys the site. The widget calls `GET /api/recorder/manifest` (with `X-Upload-Key`) when it starts, compares each file's `sha256` with its own copy, and downloads changed files from `GET /api/recorder/file/<name>`.
