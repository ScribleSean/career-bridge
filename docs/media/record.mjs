// Records README clips of the running app as animated PNGs (APNG), with no dependencies:
// drives headless Chrome over the DevTools protocol, captures PNG frames, and stitches them into an APNG.
//   node docs/media/record.mjs [base-url]          (default http://localhost:8000/)
//   node docs/media/record.mjs --svg docs/img/hero.svg <out-dir>   (renders frames of an animated SVG for checking)
import {spawn} from 'node:child_process';
import {mkdtempSync, writeFileSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {crc32} from 'node:zlib';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = resolve('docs/img');
const W = 1100, H = 700, PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Chrome + DevTools protocol ---------- */
async function launch() {
  const dir = mkdtempSync(join(tmpdir(), 'cbrec-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`,
    `--window-size=${W},${H}`, '--force-color-profile=srgb', 'about:blank'], {stdio: 'ignore'});
  for (let i = 0; i < 50; i++) {
    try { const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); return {proc, url: v.webSocketDebuggerUrl}; } catch { await sleep(200); }
  }
  throw new Error('Chrome did not start');
}
function client(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  const ready = new Promise((r) => { ws.onopen = r; });
  return {ready, ws, send: (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, {res, rej}); ws.send(JSON.stringify({id: i, method, params, sessionId})); })};
}

async function page(c) {
  const {targetId} = await c.send('Target.createTarget', {url: 'about:blank'});
  const {sessionId} = await c.send('Target.attachToTarget', {targetId, flatten: true});
  const s = (m, p) => c.send(m, p, sessionId);
  await s('Page.enable'); await s('Runtime.enable');
  await s('Emulation.setDeviceMetricsOverride', {width: W, height: H, deviceScaleFactor: 1, mobile: false});
  const ev = async (expr) => (await s('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true})).result.value;
  return {s, ev};
}

/* ---------- recording helpers: a fake cursor so viewers can follow along ----------
   Local tool only: the injected markup is a fixed constant, and the expressions run in our own app's page. */
const CURSOR = `(() => { if (document.getElementById('rec-cursor')) return;
  const st = document.createElement('style'); st.textContent = '#rec-cursor{position:fixed;z-index:99999;width:22px;height:22px;pointer-events:none;transition:none;left:0;top:0}#rec-cursor svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}.rec-ripple{position:fixed;z-index:99998;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #F6C51B;pointer-events:none;animation:recr .5s ease-out forwards}@keyframes recr{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}html{scroll-behavior:auto !important}';
  document.head.append(st);
  const c = document.createElement('div'); c.id = 'rec-cursor'; c.innerHTML = '<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2 L3 18 L7.5 14 L10.5 20.5 L13.5 19 L10.6 12.8 L16.5 12.8 Z" fill="#141414" stroke="#fff" stroke-width="1.5"/></svg>';
  c.style.left = (window.__cx ?? ${W * 0.6}) + 'px'; c.style.top = (window.__cy ?? ${H * 0.55}) + 'px'; document.body.append(c); })()`;

function recorder(p) {
  const frames = [];
  let cx = W * 0.6, cy = H * 0.55;
  const r = {
    frames,
    async shot(hold = 120) { const {data} = await p.s('Page.captureScreenshot', {format: 'png'}); frames.push({png: Buffer.from(data, 'base64'), delay: hold}); },
    async goto(url, settle = 1400) { await p.s('Page.navigate', {url}); await sleep(settle); await p.ev(`window.__cx=${cx};window.__cy=${cy};` + CURSOR); },
    async hash(h, settle = 900) { await p.ev(`location.hash=${JSON.stringify(h)}`); await sleep(settle); await p.ev(CURSOR); },
    async eval(js, settle = 0) { const v = await p.ev(js); if (settle) await sleep(settle); return v; },
    async scrollTo(target, steps = 7, hold = 90) {   // target: y or selector
      const from = await p.ev('scrollY');
      const el = (t) => (t.startsWith('(') ? t : `document.querySelector(${JSON.stringify(t)})`);
      const to = typeof target === 'number' ? target : await p.ev(`(()=>{const e=${el(target)};return e?Math.max(0,e.getBoundingClientRect().top+scrollY-24):scrollY})()`);
      for (let i = 1; i <= steps; i++) { const t = i / steps, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; await p.ev(`scrollTo(0, ${from + (to - from) * e})`); await r.shot(hold); }
    },
    async move(sel, steps = 4) {
      const pt = await p.ev(`(()=>{const e=${sel.startsWith('(') ? sel : `document.querySelector(${JSON.stringify(sel)})`};if(!e)return null;e.scrollIntoView({block:'nearest'});const b=e.getBoundingClientRect();return [b.left+Math.min(b.width/2,60),b.top+b.height/2]})()`);
      if (!pt) throw new Error('not found: ' + sel);
      const [x0, y0] = [cx, cy];
      for (let i = 1; i <= steps; i++) { const t = i / steps, e = 1 - Math.pow(1 - t, 3); cx = x0 + (pt[0] - x0) * e; cy = y0 + (pt[1] - y0) * e; await p.ev(`(()=>{const c=document.getElementById('rec-cursor');if(c){c.style.left='${cx}px';c.style.top='${cy}px'}window.__cx=${cx};window.__cy=${cy}})()`); await r.shot(55); }
    },
    async click(sel, settle = 500, hold = 700) {
      await r.move(sel);
      await p.ev(`(()=>{const d=document.createElement('div');d.className='rec-ripple';d.style.left='${cx}px';d.style.top='${cy}px';document.body.append(d);setTimeout(()=>d.remove(),600)})()`);
      await r.shot(120);
      await p.ev(`(${sel.startsWith('(') ? sel : `document.querySelector(${JSON.stringify(sel)})`}).click()`);
      await sleep(settle); await p.ev(CURSOR); await r.shot(hold);
    },
    async type(sel, text, chunk = 12) {
      await r.move(sel);
      for (let i = chunk; i < text.length + chunk; i += chunk) { await p.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.value=${JSON.stringify(text)}.slice(0,${i})})()`); await r.shot(70); }
    },
  };
  return r;
}

/* ---------- APNG: reuse each PNG frame's compressed image data, no decoding needed ---------- */
function chunks(png) {
  const out = []; let o = 8;
  while (o < png.length) { const len = png.readUInt32BE(o), type = png.toString('ascii', o + 4, o + 8); out.push({type, data: png.subarray(o + 8, o + 8 + len)}); o += 12 + len; }
  return out;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
export function apng(frames) {
  const parsed = frames.map((f) => chunks(f.png));
  const ihdr = parsed[0].find((c) => c.type === 'IHDR').data;
  for (const p of parsed) if (!p.find((c) => c.type === 'IHDR').data.equals(ihdr)) throw new Error('frames differ in size or color type');
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4);
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr)];
  const actl = Buffer.alloc(8); actl.writeUInt32BE(frames.length, 0); actl.writeUInt32BE(0, 4); parts.push(chunk('acTL', actl));
  let seq = 0;
  frames.forEach((f, i) => {
    const fc = Buffer.alloc(26);
    fc.writeUInt32BE(seq++, 0); fc.writeUInt32BE(w, 4); fc.writeUInt32BE(h, 8); fc.writeUInt32BE(0, 12); fc.writeUInt32BE(0, 16);
    fc.writeUInt16BE(Math.max(1, Math.round(f.delay)), 20); fc.writeUInt16BE(1000, 22); fc[24] = 0; fc[25] = 0;
    parts.push(chunk('fcTL', fc));
    for (const c of parsed[i].filter((c) => c.type === 'IDAT')) {
      if (i === 0) parts.push(chunk('IDAT', c.data));
      else { const sq = Buffer.alloc(4); sq.writeUInt32BE(seq++); parts.push(chunk('fdAT', Buffer.concat([sq, c.data]))); }
    }
  });
  parts.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/* ---------- scenes ---------- */
async function scenes(p, base) {
  const save = (name, r) => { const b = apng(r.frames); writeFileSync(join(OUT, name), b); console.log(`${name}: ${r.frames.length} frames, ${(b.length / 1e6).toFixed(1)} MB`); };

  // 1. The case for leaders, then the skills market.
  let r = recorder(p);
  await p.ev('localStorage.clear()');
  await r.goto(base + '#/');
  await r.shot(1800);
  await r.scrollTo('.band', 8); await r.shot(1600);
  await r.scrollTo('.steps', 7); await r.shot(1800);
  await r.click('(Array.from(document.querySelectorAll("#nav a")).find(a=>a.textContent==="Skills market"))', 900, 1400);
  await r.scrollTo('.act', 6); await r.shot(1600);
  await r.scrollTo('.mkt', 7); await r.shot(2200);
  save('tour-market.png', r);

  // 2. Two sides: post a signal as a worker, then verify it as an employer.
  r = recorder(p);
  await p.ev('localStorage.clear()');
  await r.goto(base + '#/post?soc=43-6014', 1600);
  await r.shot(1200);
  await r.click('(document.querySelectorAll(".skillopt > label input")[2])', 150, 300);
  await r.click('(document.querySelectorAll(".skillopt > label input")[4])', 150, 300);
  await r.click('(document.querySelectorAll(".aiopt input")[1])', 150, 300);
  await r.click('(document.querySelectorAll(".skillopt > label input")[6])', 150, 300);
  await r.click('(document.querySelectorAll(".aiopt input")[2])', 150, 400);
  await r.type('#pn', 'I run scheduling for a 12-person office. AI drafts our minutes; I check every one.');
  await r.shot(600);
  await r.click('.postform button[type=submit]', 900, 1600);
  await r.click('(Array.from(document.querySelectorAll("#role .seg")).find(b=>b.textContent==="Employer"))', 600, 900);
  await r.click('(Array.from(document.querySelectorAll(".sig")).find(c=>c.innerText.includes("Yours")).querySelector(".sigfoot .btn:not(.ghost)"))', 600, 1800);
  await r.click('.melink', 900, 1800);
  save('tour-signals.png', r);

  // 3. A job from both sides: the public data plus what people in the job report.
  r = recorder(p);
  await p.ev('localStorage.clear();localStorage.setItem("cb-role","worker")');
  await r.goto(base + '#/job/43-6014', 1600);
  await r.shot(1800);
  const panelOf = (title) => `(Array.from(document.querySelectorAll(".panel h3")).find(h=>h.textContent===${JSON.stringify(title)}).closest("section"))`;
  await r.scrollTo(panelOf('What people in this job report'), 8); await r.shot(2400);
  await r.scrollTo(panelOf('What you can do about it'), 8); await r.shot(2000);
  await r.scrollTo('.tl', 6); await r.shot(2000);
  save('tour-job.png', r);
}

async function svgFrames(p, file, dir) {
  mkdirSync(dir, {recursive: true});
  await p.s('Page.navigate', {url: 'file://' + resolve(file)}); await sleep(800);
  for (const t of [0, 1500, 2700, 3600, 5000, 6500, 8000]) {
    await p.ev(`document.getAnimations().forEach(a=>{a.pause();a.currentTime=${t}})`); await sleep(100);
    const {data} = await p.s('Page.captureScreenshot', {format: 'png'}); writeFileSync(join(dir, `t${t}.png`), Buffer.from(data, 'base64'));
  }
  console.log('wrote', dir);
}

const {proc, url} = await launch();
const c = client(url); await c.ready;
try {
  const p = await page(c);
  if (process.argv[2] === '--svg') await svgFrames(p, process.argv[3], process.argv[4] || 'svg-frames');
  else await scenes(p, process.argv[2] || 'http://localhost:8000/');
} finally { c.ws.close(); proc.kill(); }
