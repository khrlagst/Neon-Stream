const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

function generateId() { return 'pl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,9); }
const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files when used in single-host deployments
app.use(express.static(path.join(__dirname, '..')));

// Placeholder APIs
app.get('/api/library', (req, res) => {
  res.json({ ok: true, items: [] });
});
// Simple JSON file storage for persistence
const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const init = { playlists: [], ratings: {} };
      fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
      return init;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Failed to load data file', err);
    return { playlists: [], ratings: {} };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Failed to save data file', err);
    return false;
  }
}

// Playlists endpoints
app.get('/api/playlists', (req, res) => {
  const data = loadData();
  res.json({ ok: true, playlists: data.playlists || [] });
});

app.post('/api/playlists', (req, res) => {
  const { name, trackPaths } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, error: 'Missing name' });
  const data = loadData();
  const pl = { id: generateId(), name, trackPaths: Array.isArray(trackPaths) ? trackPaths : [] };
  data.playlists = data.playlists || [];
  data.playlists.push(pl);
  saveData(data);
  res.json({ ok: true, playlist: pl });
});

app.get('/api/playlists/:id', (req, res) => {
  const data = loadData();
  const pl = (data.playlists || []).find(p => p.id === req.params.id);
  if (!pl) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, playlist: pl });
});

app.put('/api/playlists/:id', (req, res) => {
  const data = loadData();
  const idx = (data.playlists || []).findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Not found' });
  const { name, trackPaths } = req.body || {};
  if (name) data.playlists[idx].name = name;
  if (Array.isArray(trackPaths)) data.playlists[idx].trackPaths = trackPaths;
  saveData(data);
  res.json({ ok: true, playlist: data.playlists[idx] });
});

app.delete('/api/playlists/:id', (req, res) => {
  const data = loadData();
  data.playlists = (data.playlists || []).filter(p => p.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// Ratings endpoints (keyed by encoded path)
function encodeKey(p) { return Buffer.from(p || '').toString('base64'); }

app.get('/api/ratings', (req, res) => {
  const data = loadData();
  res.json({ ok: true, ratings: data.ratings || {} });
});

app.get('/api/ratings/:path', (req, res) => {
  const data = loadData();
  const key = decodeURIComponent(req.params.path);
  const val = data.ratings ? data.ratings[key] : undefined;
  res.json({ ok: true, rating: val ?? null });
});

app.put('/api/ratings/:path', (req, res) => {
  const data = loadData();
  const key = decodeURIComponent(req.params.path);
  const { rating } = req.body || {};
  if (typeof rating !== 'number') return res.status(400).json({ ok: false, error: 'rating must be a number' });
  data.ratings = data.ratings || {};
  data.ratings[key] = rating;
  saveData(data);
  res.json({ ok: true, rating });
});

// Simple import/export endpoints
app.post('/api/import', (req, res) => {
  const payload = req.body || {};
  if (!payload) return res.status(400).json({ ok: false });
  const data = loadData();
  if (Array.isArray(payload.playlists)) data.playlists = payload.playlists;
  if (payload.ratings && typeof payload.ratings === 'object') data.ratings = payload.ratings;
  saveData(data);
  res.json({ ok: true });
});

app.get('/api/export', (req, res) => {
  const data = loadData();
  res.json({ ok: true, data });
});

app.get('/api/recommend', (req, res) => {
  const data = loadData();
  // basic naive recommend: top-rated items
  const ratings = data.ratings || {};
  const items = Object.keys(ratings).map(k => ({ path: k, rating: ratings[k] }));
  items.sort((a,b) => b.rating - a.rating);
  res.json({ ok: true, recommendations: items.slice(0, 20) });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Neon Stream backend listening on', port));

// Indexer endpoints
try {
  const Indexer = require('../metadata/indexer');
  app.post('/api/index/start', (req, res) => {
    const { dir, shards, sqlite } = req.body || {};
    if (!dir) return res.status(400).json({ ok: false, error: 'Missing dir' });
    const jobId = Indexer.startIndex(dir, { shards: shards || 1, sqlite: sqlite || null });
    res.json({ ok: true, jobId });
  });

  app.get('/api/index/status/:jobId', (req, res) => {
    const st = Indexer.state.jobs[req.params.jobId];
    if (!st) return res.status(404).json({ ok: false, error: 'job not found' });
    res.json({ ok: true, status: st });
  });

  app.get('/api/index/shard/:jobId/:shard', (req, res) => {
    const jobId = req.params.jobId; const shard = Number(req.params.shard);
    const st = Indexer.state.jobs[jobId];
    if (!st) return res.status(404).json({ ok: false, error: 'job not found' });
    const pathOnDisk = st.shards && st.shards[shard];
    if (!pathOnDisk || !fs.existsSync(pathOnDisk)) return res.status(404).json({ ok: false, error: 'shard not found' });
    res.sendFile(pathOnDisk);
  });
} catch(e){ console.warn('Indexer not available', e); }
