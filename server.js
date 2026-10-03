// Rocket League duo dashboard: serves the page, stores matches the recorder uploads,
// and keeps the whole thing behind a private link.
//
// Environment:
//   VIEW_KEY    secret for the share link (/s/<VIEW_KEY>)
//   UPLOAD_KEY  secret the recorder sends in the X-Upload-Key header
//   DATA_DIR    where store.json lives (a Railway volume, e.g. /data)
//   PLAYERS     tracked players, comma separated (default "jay29ID,Kobra Kelvin")
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = +process.env.PORT || 3000;
const VIEW_KEY = process.env.VIEW_KEY || '';
const UPLOAD_KEY = process.env.UPLOAD_KEY || '';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PLAYERS = (process.env.PLAYERS || 'jay29ID,Kobra Kelvin').split(',').map(s => s.trim()).filter(Boolean);
const STORE = path.join(DATA_DIR, 'store.json');
const RECORDER = path.join(__dirname, 'recorder');
const PUBLIC = path.join(__dirname, 'public');
const COOKIE = 'rlv';
const MAX_BODY = 20 * 1024 * 1024;

if (!VIEW_KEY || !UPLOAD_KEY) console.warn('VIEW_KEY and UPLOAD_KEY should both be set.');

// ---------- storage ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
let store = { matches: {}, mmr: {} };
try { store = Object.assign(store, JSON.parse(fs.readFileSync(STORE, 'utf8'))); } catch (e) { if (e.code !== 'ENOENT') throw e; }

function save() {
  const tmp = STORE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, STORE);
}

// How complete a copy of a match is. Jason's and Damien's PCs both upload shared games,
// so the copy with a real result, boost stats and goal positions wins; gaps are filled from the other.
function quality(r) {
  let q = 0;
  if (r.result === 'Win' || r.result === 'Loss') q += 1000;
  for (const p of r.players || []) if (p && p.tracked && p.avg_boost != null) q += 10;
  for (const g of r.goals || []) if (g && g.shot_from) q += 1;
  return q;
}
function fillNulls(into, from) {
  for (const k of Object.keys(from || {})) if (into[k] == null && from[k] != null) into[k] = from[k];
  return into;
}
function mergeMatch(a, b) {
  const [hi, lo] = quality(b) > quality(a) ? [b, a] : [a, b];
  const out = fillNulls({ ...hi }, lo);
  const byName = new Map((lo.players || []).map(p => [p && p.name, p]));
  out.players = (hi.players || []).map(p => fillNulls({ ...p }, byName.get(p && p.name)));
  for (const p of lo.players || []) if (p && !out.players.some(q => q.name === p.name)) out.players.push(p);
  if (!(hi.goals || []).length && (lo.goals || []).length) out.goals = lo.goals;
  // Watchers and drinks are set on each widget separately, so keep what either copy says.
  const sp = [...new Set([...(a.spectators || []), ...(b.spectators || [])])];
  if (sp.length || a.spectators || b.spectators) out.spectators = sp;
  if (a.drinks || b.drinks) out.drinks = { ...(a.drinks || {}), ...(b.drinks || {}) };
  out.copies = (a.copies || 1) + (b.copies || 1);
  return out;
}
function matchKey(r) {
  return String(r.match_guid || ('t:' + r.started_at + ':' + r.arena));
}
function addMatch(r) {
  if (!r || typeof r !== 'object' || !r.started_at) return false;
  const k = matchKey(r);
  r.received_at = r.received_at || new Date().toISOString();
  store.matches[k] = store.matches[k] ? mergeMatch(store.matches[k], r) : r;
  return true;
}
function addMmr(s) {
  if (!s || !s.player || !s.playlist || !(+s.mmr > 0)) return false;
  const row = {
    logged_at: s.logged_at || new Date().toISOString(), player: String(s.player), playlist: String(s.playlist),
    mmr: Math.round(+s.mmr), party_size: s.party_size != null && s.party_size !== '' ? +s.party_size : null,
    source: s.source || 'game log'
  };
  store.mmr[[row.player, row.playlist, row.logged_at, row.mmr].join('|')] = row;
  return true;
}

// ---- goal GIFs ----
const GIF_QUERY = process.env.GIF_QUERY || 'tim robinson';
// Goals against sometimes get a Mortal Kombat "Whoopsie" instead (AGAINST_GIF_QUERY, 1 in 3).
const AGAINST_GIF_QUERY = process.env.AGAINST_GIF_QUERY || 'mortal kombat whoopsie';
const WHOOPS = /wh?oops|oopsie/i;   // GIPHY mixes in other Mortal Kombat GIFs; keep the whoopsie ones
const gifPools = {}; const gifRecent = [];
async function gifList(query, pages, keep, match) {
  const key = process.env.GIPHY_KEY;
  if (!key) return [];
  const c = gifPools[query];
  if (c && c.list.length && Date.now() - c.at < 6 * 3600e3) return c.list;
  const list = [];
  for (let i = 0; i < pages; i++) {
    try {
      const u = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&limit=50&offset=${i * 50}&rating=r`;
      const r = await fetch(u); if (!r.ok) break;
      const j = await r.json();
      for (const g of j.data || []) {
        const im = (g.images && (g.images.fixed_height || g.images.downsized)) || null;
        if (im && im.url) list.push({ id: g.id, url: im.url, width: +im.width || null, height: +im.height || null, title: g.title || '' });
      }
      if ((j.data || []).length < 50) break;
    } catch (e) { break; }
  }
  let kept = match ? list.filter(g => match.test(g.title)) : list;
  if (keep) kept = kept.slice(0, keep);   // only the best matches for a specific GIF
  if (kept.length) gifPools[query] = { at: Date.now(), list: kept };
  return kept.length ? kept : (c ? c.list : []);
}
async function randomGif(against) {
  let all = await gifList(GIF_QUERY, 3, 0);
  if (against && Math.random() < 1 / 3) { const w = await gifList(AGAINST_GIF_QUERY, 1, 6, WHOOPS); if (w.length) all = w; }
  if (!all.length) return null;
  const pool = all.filter(g => !gifRecent.includes(g.id));
  const from = pool.length ? pool : all;
  const g = from[Math.floor(Math.random() * from.length)];
  gifRecent.push(g.id); if (gifRecent.length > 30) gifRecent.shift();
  return { ...g, source: 'GIPHY' };
}

// Files in recorder/ are what both PCs run. Pushing a change there to GitHub redeploys the site,
// and each widget picks it up the next time it starts.
function recorderManifest() {
  let names = [];
  try { names = fs.readdirSync(RECORDER).filter(n => !n.startsWith('.') && fs.statSync(path.join(RECORDER, n)).isFile()).sort(); } catch (e) { }
  const files = names.map(name => {
    const buf = fs.readFileSync(path.join(RECORDER, name));
    return { name, size: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
  });
  const version = crypto.createHash('sha256').update(files.map(f => f.name + ':' + f.sha256).join('\n')).digest('hex').slice(0, 12);
  return { version, files };
}

// ---------- http helpers ----------
function send(res, code, body, type = 'application/json; charset=utf-8', extra = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(code, { 'Content-Type': type, 'Content-Length': buf.length, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...extra });
  res.end(buf);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^﻿/, ''))); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
const canView = req => VIEW_KEY && same(cookies(req)[COOKIE] || '', VIEW_KEY);

const LOCKED = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Private dashboard</title>
<body style="font:15px system-ui,sans-serif;background:#0b1017;color:#eef2f7;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
<p style="max-width:40ch;text-align:center">This dashboard is private. Open it with the share link you were sent.</p></body>`;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
function serveFile(res, name) {
  const file = path.join(PUBLIC, name);
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 404, { error: 'not found' });
  fs.readFile(file, (err, buf) => err ? send(res, 404, { error: 'not found' }) : send(res, 200, buf, TYPES[path.extname(file)] || 'application/octet-stream'));
}

// ---------- routes ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (p === '/healthz') return send(res, 200, { ok: true });

    // Recorder uploads: { kind: "match" | "mmr", data }
    if (p === '/api/ingest' && req.method === 'POST') {
      if (!UPLOAD_KEY || !same(req.headers['x-upload-key'] || '', UPLOAD_KEY)) return send(res, 401, { error: 'bad upload key' });
      const body = await readJson(req);
      const ok = body.kind === 'match' ? addMatch(body.data) : body.kind === 'mmr' ? addMmr(body.data) : false;
      if (!ok) return send(res, 400, { error: 'expected {kind:"match"|"mmr", data}' });
      save();
      return send(res, 200, { ok: true });
    }

    // Recorder self-update: the widget compares these hashes with its own files on start.
    if (p === '/api/recorder/manifest' || p.startsWith('/api/recorder/file/')) {
      if (!UPLOAD_KEY || !same(req.headers['x-upload-key'] || '', UPLOAD_KEY)) return send(res, 401, { error: 'bad upload key' });
      const m = recorderManifest();
      if (p === '/api/recorder/manifest') return send(res, 200, m);
      const name = decodeURIComponent(p.slice('/api/recorder/file/'.length));
      if (!m.files.some(f => f.name === name)) return send(res, 404, { error: 'not found' });
      return send(res, 200, fs.readFileSync(path.join(RECORDER, name)), 'application/octet-stream');
    }

    // The widget's "Open dashboard" link: trades the upload key for the private share link.
    if (p === '/api/view-link') {
      if (!UPLOAD_KEY || !same(req.headers['x-upload-key'] || '', UPLOAD_KEY)) return send(res, 401, { error: 'bad upload key' });
      const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
      return send(res, 200, { url: `${proto}://${req.headers.host}/s/${encodeURIComponent(VIEW_KEY)}` });
    }

    // A random GIF for the widget's goal pop-up. Needs GIPHY_KEY (free at developers.giphy.com).
    // Shared "who's watching" and drinks, so a change on one widget shows on the others.
    // Resets once nobody has touched it for 8 hours (the next night).
    if (p === '/api/crew') {
      if (!UPLOAD_KEY || !same(req.headers['x-upload-key'] || '', UPLOAD_KEY)) return send(res, 401, { error: 'bad upload key' });
      let c = store.crew || { rev: 0 };
      if (c.updated_at && Date.now() - Date.parse(c.updated_at) > 8 * 3600e3) c = { rev: c.rev || 0 };
      if (req.method === 'POST') {
        const b = await readJson(req);
        const watching = Array.isArray(b.watching) ? [...new Set(b.watching.map(String))].slice(0, 20) : c.watching || [];
        const drinks = {};
        for (const [k, v] of Object.entries(b.drinks && typeof b.drinks === 'object' ? b.drinks : c.drinks || {})) {
          const n = Math.round(+v);
          if (Number.isFinite(n) && n >= 0 && n <= 99) drinks[String(k)] = n;
        }
        c = { rev: (c.rev || 0) + 1, watching, drinks, updated_at: new Date().toISOString() };
        store.crew = c; save();
      }
      return send(res, 200, { rev: c.rev || 0, watching: c.watching || [], drinks: c.drinks || {}, updated_at: c.updated_at || null });
    }

    if (p === '/api/gif') {
      if (!UPLOAD_KEY || !same(req.headers['x-upload-key'] || '', UPLOAD_KEY)) return send(res, 401, { error: 'bad upload key' });
      const pick = await randomGif(url.searchParams.get('against') === '1');
      return pick ? send(res, 200, pick) : send(res, 404, { error: 'no GIFs available (is GIPHY_KEY set?)' });
    }

    if (p.startsWith('/s/')) {
      if (!VIEW_KEY || !same(decodeURIComponent(p.slice(3)), VIEW_KEY)) return send(res, 403, LOCKED, 'text/html; charset=utf-8');
      return send(res, 302, '', 'text/plain', {
        Location: '/',
        'Set-Cookie': `${COOKIE}=${encodeURIComponent(VIEW_KEY)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`
      });
    }

    if (!canView(req)) return p.startsWith('/api/') ? send(res, 401, { error: 'private' }) : send(res, 403, LOCKED, 'text/html; charset=utf-8');

    if (p === '/api/data' && req.method === 'GET') {
      return send(res, 200, { players: PLAYERS, matches: Object.values(store.matches), mmr: Object.values(store.mmr) });
    }
    // Typed MMR from the page
    if (p === '/api/mmr' && req.method === 'POST') {
      const b = await readJson(req);
      if (!addMmr({ ...b, source: 'typed', logged_at: new Date().toISOString() })) return send(res, 400, { error: 'player, playlist and mmr are required' });
      save();
      return send(res, 200, { ok: true });
    }
    // Backfill from matches.jsonl / mmr.csv, parsed in the browser
    if (p === '/api/import' && req.method === 'POST') {
      const b = await readJson(req);
      let m = 0, r = 0;
      for (const x of b.matches || []) if (addMatch(x)) m++;
      for (const x of b.mmr || []) if (addMmr(x)) r++;
      save();
      return send(res, 200, { ok: true, matches: m, mmr: r });
    }

    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return serveFile(res, 'index.html');
    if (req.method === 'GET' && p === '/app.js') return serveFile(res, 'app.js');
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 400, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => {
  console.log(`rocketdash listening on ${PORT}, data in ${DATA_DIR}`);
  if (process.env.GIPHY_KEY) {
    gifList(GIF_QUERY, 3, 0).then(l => console.log(l.length ? `goal GIFs ready: ${l.length} for "${GIF_QUERY}"` : 'goal GIFs: GIPHY returned nothing (check GIPHY_KEY)'));
    gifList(AGAINST_GIF_QUERY, 1, 6, WHOOPS).then(l => console.log(`goals-against GIFs: ${l.map(g => g.title).join(' | ') || 'none'}`));
  }
});
module.exports = { mergeMatch, quality };
