// Simple metadata index generator (example). Scans a folder of MP3/FLAC files and emits a JSON index.
// Usage: node generate_index.js /path/to/music out.json

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
    return crypto.createHash('sha1').update(data).digest('hex');
  } catch(e){ return null; }
}

function shardArray(arr, shardCount) {
  if (shardCount <= 1) return [arr];
  const out = Array.from({length: shardCount}, ()=>[]);
  arr.forEach((it, i) => out[i % shardCount].push(it));
  return out;
}

async function main(){
  const args = process.argv.slice(2);
  if (args.length < 2) { console.error('Usage: node generate_index.js /music/dir out.json [--shards N] [--sqlite out.db]'); process.exit(2); }
  const dir = args[0];
  const out = args[1];
  const shardsArg = args.includes('--shards') ? Number(args[args.indexOf('--shards')+1] || 1) : 1;
  const sqliteArg = args.includes('--sqlite') ? args[args.indexOf('--sqlite')+1] : null;

  const files = walk(dir, ['.mp3', '.flac', '.m4a', '.wav', '.ogg']);
  const items = files.map((p, i) => ({ id: `t${i+1}`, path: p, title: path.basename(p), artist: 'Unknown', album: 'Unknown', duration: 0, fingerprint: fingerprintFile(p) }));

  // write shards
  const shards = shardArray(items, shardsArg);
  if (shardsArg > 1) {
    shards.forEach((sh, idx) => {
      const fileName = out.replace(/\.json$/,'') + `_shard_${idx}.json`;
      fs.writeFileSync(fileName, JSON.stringify({ shard: idx, items: sh }, null, 2));
      console.log('Wrote shard', fileName, 'items=', sh.length);
    });
  } else {
    fs.writeFileSync(out, JSON.stringify({ generatedAt: Date.now(), items }, null, 2));
    console.log('Wrote', out, 'items=', items.length);
  }

  if (sqliteArg) {
    try {
      const sqlite3 = require('sqlite3');
      const db = new sqlite3.Database(sqliteArg);
      db.serialize(() => {
        db.run('CREATE TABLE IF NOT EXISTS tracks (id TEXT PRIMARY KEY, path TEXT, title TEXT, artist TEXT, album TEXT, duration INTEGER, fingerprint TEXT)');
        const stmt = db.prepare('INSERT OR REPLACE INTO tracks VALUES (?,?,?,?,?,?,?)');
        for (const it of items) stmt.run(it.id, it.path, it.title, it.artist, it.album, it.duration||0, it.fingerprint);
        stmt.finalize();
      });
      db.close();
      console.log('Wrote sqlite', sqliteArg);
    } catch(e){ console.warn('sqlite export failed', e); }
  }
}

main();
