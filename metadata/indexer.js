const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_FILE = path.join(__dirname, 'indexer_state.json');

let state = { jobs: {} };
try { if (fs.existsSync(STATE_FILE)) state = JSON.parse(fs.readFileSync(STATE_FILE,'utf8')||'{}'); } catch(e){ state = { jobs: {} }; }

function persist(){ fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

function walk(dir, exts, files=[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, files);
    else if (exts.includes(path.extname(e.name).toLowerCase())) files.push(p);
  }
  return files;
}

function fingerprintFile(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha1').update(data).digest('hex');
    return hash;
  } catch(e){ return null; }
}

function shardArray(arr, shardCount) {
  if (shardCount <= 1) return [arr];
  const out = Array.from({length: shardCount}, ()=>[]);
  arr.forEach((it, i) => out[i % shardCount].push(it));
  return out;
}

async function runJob(jobId, dir, opts={}){
  state.jobs[jobId] = { status: 'running', startedAt: Date.now(), progress: 0, total: 0, shards: [] };
  persist();
  const exts = ['.mp3','.flac','.m4a','.wav','.ogg'];
  const files = walk(dir, exts);
  state.jobs[jobId].total = files.length;
  persist();

  const items = [];
  let i=0;
  for (const f of files) {
    const fp = fingerprintFile(f);
    items.push({ id: `t_${i+1}`, path: f, title: path.basename(f), artist: 'Unknown', album: 'Unknown', duration: 0, fingerprint: fp });
    i++; state.jobs[jobId].progress = i; if (i % 20 === 0) persist();
  }

  // sharding
  const shardCount = opts.shards && Number(opts.shards) > 0 ? Number(opts.shards) : 1;
  const shards = shardArray(items, shardCount);
  for (let s=0; s<shards.length; s++){
    const outPath = path.join(__dirname, `index_shard_${jobId}_${s}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ shard: s, items: shards[s] }, null, 2));
    state.jobs[jobId].shards.push(outPath);
  }

  // optional sqlite export
  if (opts.sqlite) {
    try {
      const sqlite3 = require('sqlite3');
      const db = new sqlite3.Database(opts.sqlite);
      db.serialize(() => {
        db.run('CREATE TABLE IF NOT EXISTS tracks (id TEXT PRIMARY KEY, path TEXT, title TEXT, artist TEXT, album TEXT, duration INTEGER, fingerprint TEXT)');
        const stmt = db.prepare('INSERT OR REPLACE INTO tracks VALUES (?,?,?,?,?,?,?)');
        for (const it of items) stmt.run(it.id, it.path, it.title, it.artist, it.album, it.duration||0, it.fingerprint);
        stmt.finalize();
      });
      db.close();
      state.jobs[jobId].sqlite = opts.sqlite;
    } catch(e){ state.jobs[jobId].sqliteError = String(e); }
  }

  state.jobs[jobId].status = 'completed';
  state.jobs[jobId].completedAt = Date.now();
  persist();
}

function startIndex(dir, opts){
  const jobId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6);
  runJob(jobId, dir, opts).catch(err=>{ state.jobs[jobId].status = 'failed'; state.jobs[jobId].error = String(err); persist(); });
  persist();
  return jobId;
}

module.exports = { startIndex, state, persist };
