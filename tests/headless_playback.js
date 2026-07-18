const http = require('http');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

// Simple static server to serve project files
function serveOnce(port=8001){
  const root = path.resolve(__dirname, '..');
  const srv = http.createServer((req,res)=>{
    let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (p.endsWith('/')) p = path.join(p,'index.html');
    if (!fs.existsSync(p)) { res.statusCode=404; res.end('not found'); return; }
    const stream = fs.createReadStream(p);
    stream.pipe(res);
  });
  return new Promise((resolve)=>{ srv.listen(port, ()=>resolve(srv)); });
}

(async()=>{
  const server = await serveOnce(8001);
  console.log('Static server running on http://localhost:8001');
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:8001/test/playback_smoke.html', { waitUntil: 'networkidle2', timeout: 60000 });
    // wait for results to render
    await page.waitForSelector('#results div', { timeout: 10000 });
    const results = await page.evaluate(()=>Array.from(document.querySelectorAll('#results div')).map(d=>d.innerText));
    console.log('Smoke test results:');
    results.forEach(r=>console.log(r));
    const failed = results.some(r=>r.includes('FAIL'));
    await browser.close();
    server.close();
    process.exit(failed?2:0);
  } catch (e){
    console.error('Headless test error', e);
    await browser.close();
    server.close();
    process.exit(2);
  }
})();
