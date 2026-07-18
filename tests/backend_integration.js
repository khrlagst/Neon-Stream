const http = require('http');
const { spawnSync } = require('child_process');

function req(method, path, data){
  return new Promise((resolve,reject)=>{
    const opts = { method, hostname: 'localhost', port: process.env.PORT||3000, path, headers: {'Content-Type':'application/json'} };
    const r = http.request(opts, res=>{
      let b=''; res.on('data', c=>b+=c); res.on('end', ()=>resolve({ status: res.statusCode, body: b }));
    });
    r.on('error', e=>reject(e));
    if (data) r.write(JSON.stringify(data));
    r.end();
  });
}

(async()=>{
  try{
    console.log('GET /api/playlists');
    let g = await req('GET', '/api/playlists'); console.log(g.status, g.body.slice(0,200));
    console.log('POST /api/playlists');
    let p = await req('POST', '/api/playlists', { name: 'TI test', trackPaths: ['/tmp/x.mp3'] }); console.log(p.status, p.body);
    console.log('GET /api/playlists (after create)'); let g2 = await req('GET','/api/playlists'); console.log(g2.status, g2.body.slice(0,200));
    console.log('PUT /api/ratings'); let rp = await req('PUT','/api/ratings/'+encodeURIComponent('/tmp/x.mp3'), { rating: 5 }); console.log(rp.status, rp.body);
    console.log('GET /api/ratings'); let rg = await req('GET','/api/ratings/'+encodeURIComponent('/tmp/x.mp3')); console.log(rg.status, rg.body);
    process.exit(0);
  }catch(e){ console.error(e); process.exit(2); }
})();
