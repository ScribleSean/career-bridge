// Career Bridge front end. Talks only to the JSON API in server.py. Routes:
//   #/job/<soc>   worker view for one job      #/board?quadrant=&family=&q=&sort=&dir=
//   #/about       about the data               #/ (default: last job viewed)

const GAP = 'High exposure, low adoption', HIHI = 'High exposure, high adoption', LOHI = 'Lower exposure, high adoption', LOLO = 'Lower exposure, low adoption', THIN = 'Too few MA job ads to measure';
const QTEXT = {
  [GAP]: ['gap', 'Much of this work overlaps with what AI can do, but few Massachusetts job ads ask for AI skills yet. Workers here may get little warning or support.'],
  [HIHI]: ['ai', 'Much of this work overlaps with AI, and employers already ask for AI skills in it. Building those skills is part of staying competitive.'],
  [LOHI]: ['ai', 'Less of this work overlaps with AI, but employers still ask for AI skills, often for tools used alongside the core work.'],
  [LOLO]: ['neutral', 'Less of this work overlaps with AI today, and employers rarely ask for AI skills.'],
  [THIN]: ['neutral', 'There are too few Massachusetts job ads for this job to measure employer demand reliably.']
};
const QCLASS = q => (QTEXT[q] || QTEXT[THIN])[0];
const JZ = {1: 'little or no preparation', 2: 'some preparation', 3: 'medium preparation', 4: 'considerable preparation', 5: 'extensive preparation'};
const EXAMPLES = [['43-6014', 'Admin assistant'], ['43-4051', 'Customer service rep'], ['43-3031', 'Bookkeeping clerk'], ['25-2021', 'Elementary teacher'], ['13-2011', 'Accountant'], ['43-1011', 'Office supervisor'], ['29-1141', 'Registered nurse']];
const DEFAULT_SOC = '43-6014';

let META = {state_rate_2025: 6.18, exposure_median: 55.7, exposure_min: 31.5, exposure_max: 82.8};

const fmtN = n => n == null ? '—' : Math.round(n).toLocaleString('en-US');
const fmtW = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US');
const fmtP = (n, d = 1) => n == null ? '—' : Number(n).toFixed(d) + '%';
const fmtK = n => n == null ? '—' : (n >= 0 ? '+' : '−') + '$' + Math.abs(Math.round(n / 100) * 100).toLocaleString('en-US');

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'style') e.setAttribute('style', v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const $ = id => document.getElementById(id);

/* ---------- API ---------- */
const cache = new Map();
// Mode: the Python server if it answers, else no-server mode reading careerbridge.json beside this page.
let staticHandle = null;
const modeReady = (async () => {
  try {
    const r = await fetch('/api/meta', {headers: {Accept: 'application/json'}});
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return;
  } catch (e) { /* no server */ }
  const [{makeStaticApi}, data] = await Promise.all([
    import('./static-api.js'),
    fetch(new URL('careerbridge.json', document.baseURI)).then(r => { if (!r.ok) throw new Error('data file missing'); return r.json(); }),
  ]);
  staticHandle = makeStaticApi(data);
})();
async function api(path, {useCache = true, signal} = {}) {
  if (useCache && cache.has(path)) return cache.get(path);
  await modeReady;
  if (staticHandle) {
    const [status, body] = staticHandle(path);
    if (status !== 200) { const err = new Error(body.error || `Request failed (${status})`); err.status = status; throw err; }
    if (useCache) cache.set(path, body);
    return body;
  }
  const r = await fetch(path, {signal, headers: {Accept: 'application/json'}});
  let body = null;
  try { body = await r.json(); } catch (e) { /* non-JSON */ }
  if (!r.ok) { const err = new Error((body && body.error) || `Request failed (${r.status})`); err.status = r.status; throw err; }
  if (useCache) cache.set(path, body);
  return body;
}
const loading = msg => h('div', {class: 'status', role: 'status'}, h('div', {class: 'spinner', 'aria-hidden': 'true'}), h('span', {}, msg));
const errorBox = (msg, retry) => h('div', {class: 'status err', role: 'alert'}, h('span', {}, msg), retry ? h('button', {type: 'button', onclick: retry}, 'Try again') : null);

/* ---------- theme ---------- */
$('theme').addEventListener('click', () => {
  const root = document.documentElement;
  const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next; store.set('cb-theme', next);
});

/* ---------- routing ---------- */
const TABS = ['worker', 'board', 'about'];
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(query));
  if (parts[0] === 'board') return {view: 'board', params};
  if (parts[0] === 'about') return {view: 'about'};
  if (parts[0] === 'job' && parts[1]) return {view: 'worker', soc: decodeURIComponent(parts[1])};
  if (/^occ-/.test(raw)) return {view: 'worker', soc: raw.slice(4)}; // old prototype links
  return {view: 'worker', soc: null};
}
function showTab(name) {
  TABS.forEach(t => { $('tab-' + t).setAttribute('aria-selected', String(t === name)); $('view-' + t).hidden = t !== name; });
}
let lastWorkerSoc = store.get('cb-last') || DEFAULT_SOC;
async function route() {
  const r = parseHash();
  if (r.view === 'worker' && !r.soc) { history.replaceState(null, '', '#/job/' + lastWorkerSoc); return route(); }
  $('tab-worker').setAttribute('href', '#/job/' + lastWorkerSoc);
  showTab(r.view);
  if (r.view === 'worker') await renderOcc(r.soc);
  else if (r.view === 'board') await renderBoard(r.params || {});
  else document.title = 'About the data · Career Bridge';
}
window.addEventListener('hashchange', route);
const go = soc => { location.hash = '#/job/' + soc; };

/* ---------- search ---------- */
const q = $('q'), res = $('results');
let hits = [], active = -1, searchSeq = 0, searchTimer = null;
function drawResults() {
  res.textContent = '';
  res.hidden = !hits.length; q.setAttribute('aria-expanded', String(!!hits.length));
  hits.forEach((o, i) => res.append(h('li', {role: 'option', id: 'opt' + i, 'aria-selected': String(i === active), onmousedown: e => { e.preventDefault(); pick(o.soc); }}, h('span', {}, o.title), h('small', {}, fmtN(o.ma_employment) + ' in MA'))));
  if (active >= 0) q.setAttribute('aria-activedescendant', 'opt' + active); else q.removeAttribute('aria-activedescendant');
}
async function runSearch(text) {
  const seq = ++searchSeq;
  if (!text.trim()) { hits = []; active = -1; drawResults(); return; }
  try {
    const out = await api('/api/occupations?q=' + encodeURIComponent(text));
    if (seq !== searchSeq) return;
    hits = out; active = hits.length ? 0 : -1; drawResults();
    if (!hits.length) { res.hidden = false; res.append(h('li', {role: 'option', 'aria-disabled': 'true'}, h('span', {}, 'No matching jobs. Try a shorter word.'))); }
  } catch (e) { if (seq === searchSeq) { hits = []; drawResults(); } }
}
q.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(q.value), 120); });
q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' && hits.length) { active = (active + 1) % hits.length; drawResults(); e.preventDefault(); }
  else if (e.key === 'ArrowUp' && hits.length) { active = (active - 1 + hits.length) % hits.length; drawResults(); e.preventDefault(); }
  else if (e.key === 'Enter' && active >= 0 && hits[active]) { pick(hits[active].soc); e.preventDefault(); }
  else if (e.key === 'Escape') { hits = []; drawResults(); }
});
q.addEventListener('blur', () => setTimeout(() => { hits = []; drawResults(); }, 120));
EXAMPLES.forEach(([soc, name]) => $('examples').append(h('button', {class: 'chip', type: 'button', onclick: () => pick(soc)}, name)));

function pick(soc) {
  hits = []; searchSeq++; drawResults(); q.blur();
  if (location.hash === '#/job/' + soc) route(); else go(soc);
}

/* ---------- worker view ---------- */
let strict = store.get('cb-strict') === '1';
let occSeq = 0;
async function renderOcc(soc) {
  const root = $('occ'), seq = ++occSeq;
  root.textContent = ''; root.append(loading('Loading job…'));
  let d;
  try { d = await api('/api/occupations/' + encodeURIComponent(soc)); }
  catch (e) {
    if (seq !== occSeq) return;
    root.textContent = '';
    root.append(e.status === 404
      ? errorBox(`We couldn’t find a job with code ${soc}. Search for your job above.`)
      : errorBox('Couldn’t load this job. Is the server running?', () => renderOcc(soc)));
    return;
  }
  if (seq !== occSeq) return;
  const o = d.occ;
  lastWorkerSoc = o.soc; store.set('cb-last', o.soc);
  $('tab-worker').setAttribute('href', '#/job/' + o.soc);
  if (document.activeElement !== q) q.value = o.title;
  document.title = o.title + ' · Career Bridge';
  const [cls, text] = QTEXT[o.quadrant] || QTEXT[THIN];
  root.textContent = '';
  root.append(h('div', {style: 'display:grid;gap:16px'},
    h('div', {class: 'occhead'},
      h('span', {class: 'grp'}, o.major_group + ' · SOC ' + o.soc),
      h('h2', {id: 'occ-title', tabindex: '-1'}, o.title),
      h('div', {class: 'verdict'}, h('span', {class: 'pill ' + cls}, o.quadrant), h('p', {}, text))),
    h('div', {class: 'grid'}, panelStand(o, d.trend), panelUse(o, d), panelSkills(d), panelMoves(o, d.paths))));
  if (shownSoc && shownSoc !== o.soc && root.getBoundingClientRect().top < 0) {
    root.scrollIntoView({block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    $('occ-title').focus({preventScroll: true});
  }
  shownSoc = o.soc;
}
let shownSoc = null;

function meter(x) {
  const lo = META.exposure_min, hi = META.exposure_max, med = META.exposure_median;
  const pos = v => Math.max(0, Math.min(100, 100 * (v - lo) / (hi - lo)));
  return h('div', {class: 'meterwrap'},
    h('div', {class: 'meter', role: 'img', 'aria-label': `Exposure ${x.toFixed(1)} on a scale from ${lo} (least overlap) to ${hi} (most overlap with AI); median job ${med}`},
      h('i', {style: `width:${pos(x)}%`}), h('b', {style: `left:${pos(med)}%`})),
    h('div', {class: 'meterscale', 'aria-hidden': 'true'},
      h('span', {class: 'lo'}, String(lo)), h('span', {class: 'md', style: `left:${pos(med)}%`}, 'median ' + med), h('span', {class: 'hi'}, String(hi))));
}

function panelStand(o, trend) {
  const tr = (trend || []).filter(r => r[1] != null || r[2] != null);
  const jz = o.job_zone != null ? Math.round(o.job_zone) : null;
  const rel = o.exposure > META.exposure_median ? 'More exposed than the median job' : 'Less exposed than the median job';
  return h('div', {class: 'panel'},
    h('h3', {}, 'Where your job stands'),
    h('p', {class: 'sub'}, 'Massachusetts, 2025 unless noted'),
    h('div', {class: 'stats'},
      h('div', {class: 'stat'}, h('span', {class: 'k'}, 'AI exposure (overlap with AI)'), h('span', {class: 'v'}, o.exposure.toFixed(1)),
        meter(o.exposure), h('span', {class: 'n'}, rel)),
      h('div', {class: 'stat'}, h('span', {class: 'k'}, 'Job ads asking for AI skills'), h('span', {class: 'v'}, fmtP(o.ma_ai_2025)), h('span', {class: 'n'}, `US ${fmtP(o.us_ai_2025)} · state average ${META.state_rate_2025}%`)),
      h('div', {class: 'stat'}, h('span', {class: 'k'}, 'Median annual wage'), h('span', {class: 'v'}, fmtW(o.ma_median_wage)), h('span', {class: 'n'}, 'US ' + fmtW(o.us_median_wage))),
      h('div', {class: 'stat'}, h('span', {class: 'k'}, 'People in this job in MA'), h('span', {class: 'v'}, fmtN(o.ma_employment)), h('span', {class: 'n'}, o.bachelors_plus_pct != null ? `${Math.round(o.bachelors_plus_pct)}% hold a bachelor’s or more` : '')),
    ),
    tr.length > 1 ? spark(tr) : h('p', {class: 'empty'}, 'Not enough job ads to show a trend.'),
    jz ? h('p', {class: 'foot', style: 'margin:0'}, `Job Zone ${jz}: ${JZ[jz]}. Postings confidence in MA: ${o.ma_confidence}.`) : null);
}

function spark(tr) {
  const W = 600, H = 150, L = 44, R = 56, T = 14, B = 26;
  const vals = tr.flatMap(r => [r[1], r[2]]).filter(v => v != null);
  const max = Math.max(1, ...vals) * 1.15;
  const x = i => L + i * (W - L - R) / (tr.length - 1), y = v => T + (H - T - B) * (1 - v / max);
  const s = svgEl('svg', {viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Share of job ads asking for AI skills by year: ' + tr.map(r => `${r[0]} MA ${r[1] ?? 'n/a'}%, US ${r[2] ?? 'n/a'}%`).join('; ')});
  [0, max / 2].forEach(v => { s.append(svgEl('line', {x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-width': 1})); const t = svgEl('text', {x: L - 6, y: y(v) + 4, 'text-anchor': 'end'}); t.textContent = v.toFixed(v < 10 ? 1 : 0) + '%'; s.append(t); });
  tr.forEach((r, i) => { const t = svgEl('text', {x: x(i), y: H - 6, 'text-anchor': 'middle'}); t.textContent = r[0] === 2026 ? '2026*' : r[0]; s.append(t); });
  const ends = {};
  [1, 2].forEach(k => { const r = tr.filter(r => r[k] != null).slice(-1)[0]; if (r) ends[k] = y(r[k]); });
  if (ends[1] != null && ends[2] != null && Math.abs(ends[1] - ends[2]) < 16) { const mid = (ends[1] + ends[2]) / 2; const up = ends[1] <= ends[2]; ends[1] = mid + (up ? -8 : 8); ends[2] = mid + (up ? 8 : -8); }
  [[2, 'var(--muted)', '4 3'], [1, 'var(--ai)', '']].forEach(([k, c, dash]) => {
    const pts = tr.map((r, i) => r[k] == null ? null : [x(i), y(r[k])]).filter(Boolean);
    if (pts.length < 2) return;
    s.append(svgEl('polyline', {points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: c, 'stroke-width': 2, 'stroke-dasharray': dash, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'}));
    const last = pts[pts.length - 1]; s.append(svgEl('circle', {cx: last[0], cy: last[1], r: 3.5, fill: c}));
    const lv = tr.filter(r => r[k] != null).slice(-1)[0][k];
    const t = svgEl('text', {x: last[0] + 8, y: ends[k] + 4}); t.textContent = lv.toFixed(1) + '%'; t.setAttribute('style', `fill:${c}`); s.append(t);
  });
  return h('div', {class: 'spark'}, h('div', {class: 'legend'}, h('span', {style: '--c: var(--ai)'}, 'Massachusetts'), h('span', {style: '--c: var(--muted)'}, 'United States'), h('span', {}, '*Jan–Sep')), s);
}

function panelUse(o, d) {
  const tasks = (d.tasks || []).filter(t => t[1] > 0);
  const ai = (d.skills || []).filter(s => s[4]);
  const max = Math.max(...tasks.map(t => t[1]), 0.0001);
  return h('div', {class: 'panel'},
    h('h3', {}, 'What people already use AI for in this job'),
    h('p', {class: 'sub'}, 'Tasks from this job that show up most in Claude conversations, US, Apr–May 2026'),
    tasks.length ? h('ul', {class: 'list'}, tasks.map(t => h('li', {}, h('span', {}, t[0]), h('div', {class: 'bar', style: `width:${Math.max(3, 100 * t[1] / max)}%`}), h('span', {class: 'meta'}, `${t[1].toFixed(2)}% of conversations`))))
      : h('p', {class: 'empty'}, 'Too few conversations map to this job’s tasks to show. That can mean little AI use, or a job the data does not capture well.'),
    o.claude_share_us != null ? h('p', {class: 'foot', style: 'margin:0'}, `This job’s tasks appear in ${o.claude_share_us.toFixed(2)}% of US Claude conversations.`) : null,
    h('div', {}, h('h4', {}, 'AI skills employers name in job ads'),
      ai.length ? h('div', {class: 'tags'}, ai.map(s => h('span', {class: 'tag aiTag'}, s[1], h('em', {}, s[2] + '%'))))
        : h('p', {class: 'empty'}, 'None of the most-requested skills in this job’s ads are AI skills.')));
}

function panelSkills(d) {
  const st = d.strengths || [];
  const sk = d.skills || [];
  const by = t => sk.filter(s => s[0] === t);
  const geo = sk.length ? sk[0][3] : 'MA';
  const tags = arr => arr.length ? h('div', {class: 'tags'}, arr.map(s => h('span', {class: 'tag' + (s[4] ? ' aiTag' : '')}, s[1], h('em', {}, s[2] + '%')))) : h('p', {class: 'empty'}, 'Not listed');
  return h('div', {class: 'panel'},
    h('h3', {}, 'Your human edge and what employers ask for'),
    h('p', {class: 'sub'}, 'O*NET skill ratings and the skills most named in job ads'),
    h('div', {class: 'two'},
      h('div', {}, h('h4', {}, 'Your strengths'),
        st.length ? h('ul', {class: 'list'}, st.map(s => h('li', {}, h('span', {}, h('b', {}, s[0]), ` · importance ${s[1].toFixed(1)} of 5`), h('span', {class: 'meta'}, `+${s[2].toFixed(2)} above the average MA job`)))) : h('p', {class: 'empty'}, 'No O*NET skill ratings for this job.')),
      h('div', {style: 'display:grid;gap:12px'},
        h('div', {}, h('h4', {}, 'Core skills in ads'), tags(by('S'))),
        h('div', {}, h('h4', {}, 'Everyday skills in ads'), tags(by('C'))),
        h('div', {}, h('h4', {}, 'Certifications'), tags(by('R'))))),
    h('p', {class: 'foot', style: 'margin:0'}, `Percent of ${geo === 'MA' ? 'Massachusetts' : 'US'} job ads for this job naming each skill, 2025.`));
}

function panelMoves(o, paths) {
  const all = (paths || []).filter(p => p.target);
  const box = h('div', {class: 'moves'});
  const draw = () => {
    box.textContent = '';
    let list = strict ? all.filter(p => (p.target.ma_ai_2025 ?? 0) >= META.state_rate_2025) : all;
    list = [...list].sort((a, b) => b.similarity - a.similarity).slice(0, 5);
    if (!list.length) { box.append(h('p', {class: 'empty'}, strict ? 'No close match where employers already ask for AI skills at the state rate. Turn the filter off to see nearby moves.' : 'No close skill match pays at least as much in Massachusetts.')); return; }
    list.forEach(p => { const t = p.target; box.append(h('a', {class: 'move', href: '#/job/' + t.soc, 'aria-label': `Open ${t.title}`},
      h('span', {class: 't'}, t.title, ' ', h('span', {class: 'arrow', 'aria-hidden': 'true'}, '→')),
      h('span', {class: 'row'},
        h('span', {}, 'Skill match ', h('b', {}, Math.round(p.similarity * 100) + '%')),
        h('span', {class: p.wage_diff > 0 ? 'up' : ''}, 'Median wage ', h('b', {class: p.wage_diff > 0 ? 'up' : ''}, fmtW(t.ma_median_wage)), ` (${fmtK(p.wage_diff)})`),
        h('span', {}, 'Ads asking AI ', h('b', {}, fmtP(t.ma_ai_2025))),
        h('span', {}, h('b', {}, fmtN(t.ma_employment)), ' in MA')),
      h('span', {class: 'row'}, 'Skills to build: ', h('b', {}, p.bridge_skills.join(', '))))); });
  };
  const cb = h('input', {type: 'checkbox', id: 'strict', checked: strict, onchange: e => { strict = e.target.checked; store.set('cb-strict', strict ? '1' : '0'); draw(); }});
  draw();
  return h('div', {class: 'panel'},
    h('h3', {}, 'Next moves that use your skills'),
    h('p', {class: 'sub'}, 'Closest jobs by skill profile that pay at least as much in MA and ask for more AI skills'),
    h('label', {class: 'toggle', for: 'strict'}, cb, `Only jobs where employers already ask for AI skills (${META.state_rate_2025}%+ of ads)`),
    box,
    h('p', {class: 'foot', style: 'margin:0'}, 'Starting points for a conversation with a career advisor. Select a move to see its full profile.'));
}

/* ---------- board view ---------- */
const COLS = [['title', 'Job', 0, ''], ['ma_employment', 'MA workers', 1, ''], ['exposure', 'Exposure', 1, ''], ['ma_ai_2025', 'Ads asking AI', 1, ''], ['us_ai_2025', 'US ads asking AI', 1, 'opt'], ['ma_median_wage', 'Median wage', 1, 'opt'], ['bachelors_plus_pct', 'Bachelor’s+', 1, 'opt']];
let boardInit = false, boardSeq = 0, boardState = {quadrant: GAP, family: '', q: '', sort: 'ma_employment', dir: 'desc'};
function boardHash(s) {
  const p = new URLSearchParams();
  for (const k of ['quadrant', 'family', 'q', 'sort', 'dir']) if (s[k]) p.set(k, s[k]);
  return '#/board?' + p.toString();
}
function setBoard(patch, push = false) {
  const next = {...boardState, ...patch};
  const url = boardHash(next);
  if (push) location.hash = url; else { history.replaceState(null, '', url); renderBoard(next); }
}
function initBoard(meta) {
  boardInit = true;
  const fq = $('fq'), fs = $('fs'), fg = $('fg');
  [GAP, HIHI, LOHI, LOLO, THIN].forEach(v => fq.append(h('option', {value: v}, v)));
  fq.append(h('option', {value: 'all'}, 'All jobs'));
  fg.append(h('option', {value: ''}, 'All families'));
  (meta.families || []).forEach(g => fg.append(h('option', {value: g}, g)));
  fq.addEventListener('change', () => setBoard({quadrant: fq.value}));
  fg.addEventListener('change', () => setBoard({family: fg.value}));
  let t; fs.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => setBoard({q: fs.value.trim()}), 150); });
  const tr = document.querySelector('#bt thead tr');
  COLS.forEach(([k, label, num, opt]) => tr.append(h('th', {class: [num ? 'n' : '', opt].join(' ').trim() || null, 'data-k': k, scope: 'col'},
    h('button', {type: 'button', onclick: () => {
      const dir = boardState.sort === k ? (boardState.dir === 'asc' ? 'desc' : 'asc') : (num ? 'desc' : 'asc');
      setBoard({sort: k, dir});
    }}, label, h('span', {class: 'arr', 'aria-hidden': 'true'})))));
}
async function renderBoard(params) {
  if (!boardInit) initBoard(META);
  const DEF = {quadrant: GAP, family: '', q: '', sort: 'ma_employment', dir: 'desc'};
  const s = Object.keys(params).length ? {...DEF, ...params} : boardState;
  boardState = s;
  document.title = 'For workforce boards · Career Bridge';
  const fq = $('fq'), fs = $('fs'), fg = $('fg');
  fq.value = s.quadrant || 'all'; fg.value = s.family || ''; if (document.activeElement !== fs) fs.value = s.q || '';
  const seq = ++boardSeq;
  const tb = document.querySelector('#bt tbody');
  const qs = new URLSearchParams({quadrant: s.quadrant || 'all', family: s.family || '', q: s.q || '', sort: s.sort, dir: s.dir});
  if (!tb.children.length) { $('boardNote').textContent = 'Loading jobs…'; }
  let d;
  try { d = await api('/api/board?' + qs.toString()); }
  catch (e) {
    if (seq !== boardSeq) return;
    tb.textContent = ''; $('boardNote').textContent = '';
    tb.append(h('tr', {}, h('td', {colspan: COLS.length}, errorBox('Couldn’t load the board. Is the server running?', () => renderBoard(params)))));
    return;
  }
  if (seq !== boardSeq) return;
  const sum = d.summary, sb = $('boardSummary');
  if (!sb.children.length) {
    [[fmtN(sum.gap_workers), 'MA workers in exposed jobs with little employer demand for AI skills'], [Math.round(sum.gap_share) + '%', 'of workers in the jobs covered here'], [String(sum.gap_count), 'occupations in that group'], [fmtP(sum.state_rate, 2), 'of all MA job ads asked for AI skills in 2025']]
      .forEach(([v, k]) => sb.append(h('div', {class: 'panel stat'}, h('span', {class: 'v'}, v), h('span', {class: 'k'}, k))));
  }
  document.querySelectorAll('#bt th').forEach(th => {
    const on = th.dataset.k === d.sort;
    th.setAttribute('aria-sort', on ? (d.dir === 'asc' ? 'ascending' : 'descending') : 'none');
    th.querySelector('.arr').textContent = on ? (d.dir === 'asc' ? '▲' : '▼') : '';
  });
  $('boardNote').textContent = `${d.count} jobs · ${fmtN(d.workers)} MA workers. Select a row to open the worker view.`;
  tb.textContent = '';
  if (!d.rows.length) tb.append(h('tr', {}, h('td', {colspan: COLS.length, class: 'empty'}, 'No jobs match these filters.')));
  const frag = document.createDocumentFragment();
  d.rows.forEach(o => frag.append(h('tr', {tabindex: '0', onclick: () => go(o.soc), onkeydown: e => { if (e.key === 'Enter') go(o.soc); }},
    h('td', {class: 'title'}, h('span', {class: 'q ' + QCLASS(o.quadrant), title: o.quadrant, 'aria-hidden': 'true'}), o.title), h('td', {class: 'n'}, fmtN(o.ma_employment)), h('td', {class: 'n'}, o.exposure == null ? '—' : o.exposure.toFixed(1)), h('td', {class: 'n'}, fmtP(o.ma_ai_2025)),
    h('td', {class: 'n opt'}, fmtP(o.us_ai_2025)), h('td', {class: 'n opt'}, fmtW(o.ma_median_wage)), h('td', {class: 'n opt'}, o.bachelors_plus_pct == null ? '—' : Math.round(o.bachelors_plus_pct) + '%'))));
  tb.append(frag);
}

/* ---------- start ---------- */
(async function start() {
  try {
    const m = await api('/api/meta');
    META = {...META, ...m};
    if (m.using_reference) { $('notice').hidden = false; $('notice').textContent = 'Preview data: showing the reference prototype numbers. Build data/careerbridge.json with the pipeline for the full dataset.'; }
    $('aboutMeta').textContent = `${m.counts ? m.counts.occ : '?'} occupations · data file ${m.data_file || ''}${m.built_at ? ' · built ' + m.built_at.slice(0, 10) : ''}`;
  } catch (e) {
    $('notice').hidden = false; $('notice').textContent = 'Couldn’t reach the Career Bridge server. Start it with: python career-bridge/server.py';
  }
  route();
})();
