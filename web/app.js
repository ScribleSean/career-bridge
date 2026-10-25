// Career Bridge shell: loads data, owns the shared state (place, scenario), routes, and runs the search box.
//   #/job/<soc>   one job          #/explore?x=&y=&group=&posture=&sort=&dir=   all jobs
//   #/board?...   workforce board (private build)          #/about
//   #/signals?soc=&side=&region=&verified=   skill signals     #/post?soc=   post one     #/me   your profile
// Scenario settings travel in the URL as a=<adoption %>&p=<headcount %> so a link reproduces what you see.
import {$, h, store, announce, loading, errorBox, reduceMotion} from './js/util.js';
import {loadData, makeModel} from './js/data.js';
import {loadTitles, search} from './js/search.js';
import {renderJob} from './js/views/job.js';
import {renderExplore} from './js/views/explore.js';
import {renderBoard} from './js/views/board.js';
import {renderAbout} from './js/views/about.js';
import {renderSignals, renderPost, renderMe} from './js/views/signals.js';
import {ROLES, role, setRole} from './js/signals.js';

const DEFAULT_SOC = '43-6014';  // Denise, the administrative assistant from slide 2
const EXAMPLES = [['43-6014', 'Admin assistant'], ['43-4051', 'Customer service rep'], ['43-3031', 'Bookkeeping clerk'], ['25-2021', 'Elementary teacher'],
  ['13-2011', 'Accountant'], ['29-1141', 'Registered nurse'], ['15-1252', 'Software developer'], ['11-2021', 'Marketing manager'], ['47-2111', 'Electrician']];

let data = null, model = null;
const state = {geo: store.get('cb-geo') === 'US' ? 'US' : 'MA', A: 0.25, P: 0.5};
const ctx = {state, selected: null,
  get model() { return model; },
  hrefJob: (soc) => hashFor('job', {}, soc),
  go: (view, params = {}, soc) => { location.hash = hashFor(view, params, soc); },
  setScenario(A, P) {
    state.A = A; state.P = P; store.set('cb-scen', `${A},${P}`);
    history.replaceState(null, '', hashFor(...Object.values(parseHash()).slice(0, 3)));
  }};

/* ---------- routing ---------- */
function parseHash() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(query));
  const view = ['explore', 'board', 'about', 'signals', 'post', 'me'].includes(parts[0]) ? parts[0] : 'job';
  return {view, params, soc: view === 'job' ? decodeURIComponent(parts[1] || '') : ''};
}
function hashFor(view, params = {}, soc = '') {
  const base = model?.presets.base;
  const p = {...params};
  delete p.a; delete p.p;
  if (base && (Math.abs(state.A - base.A) > 1e-9 || Math.abs(state.P - base.P) > 1e-9)) { p.a = Math.round(state.A * 100); p.p = Math.round(state.P * 100); }
  const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== '' && v != null)).toString();
  return `#/${view}${view === 'job' && soc ? '/' + encodeURIComponent(soc) : ''}${qs ? '?' + qs : ''}`;
}
function readScenario(params) {
  const saved = (store.get('cb-scen') || '').split(',').map(Number);
  const a = params.a != null ? +params.a / 100 : saved.length === 2 && saved[0] ? saved[0] : model.presets.base.A;
  const p = params.p != null ? +params.p / 100 : saved.length === 2 && saved[1] ? saved[1] : model.presets.base.P;
  state.A = Math.min(0.8, Math.max(0.05, a)); state.P = Math.min(1, Math.max(0.1, p));
}

let lastKey = null;
let lastSoc = store.get('cb-last') || DEFAULT_SOC;
function route() {
  const r = parseHash();
  if (r.view === 'job' && !r.soc) { history.replaceState(null, '', hashFor('job', {}, model.bySoc.has(lastSoc) ? lastSoc : DEFAULT_SOC)); return route(); }
  if (r.view === 'board' && !model.full) { history.replaceState(null, '', hashFor('explore')); return route(); }
  readScenario(r.params);
  drawNav(r);
  document.querySelector('.find').hidden = !['job', 'explore', 'board'].includes(r.view);  // job search only where it's used
  const view = $('view');
  const activeId = document.activeElement && view.contains(document.activeElement) ? document.activeElement.id : '';
  let key = r.view;
  if (r.view === 'job') {
    const o = model.bySoc.get(r.soc);
    if (!o || o.jobs == null) {
      view.replaceChildren(errorBox(o ? `We don’t have a job count for ${o.title} in ${model.geo === 'MA' ? 'Massachusetts' : 'the US'}. Try the other place above, or look up a different job.` : `We couldn’t find that job. Try looking it up in the box above.`));
      document.title = 'Job not found · Career Bridge';
      return;
    }
    lastSoc = o.soc; ctx.selected = o.soc; store.set('cb-last', o.soc); key = 'job:' + o.soc;
    if (document.activeElement !== $('q')) $('q').value = o.title;
    renderJob(view, ctx, o);
    document.title = `${o.title} · Career Bridge`;
  } else if (r.view === 'explore') { renderExplore(view, ctx, r.params); document.title = 'Compare jobs · Career Bridge'; }
  else if (r.view === 'board') { renderBoard(view, ctx, r.params); document.title = 'For workforce boards · Career Bridge'; }
  else if (r.view === 'signals') { renderSignals(view, ctx, r.params); document.title = 'Skill signals · Career Bridge'; }
  else if (r.view === 'post') { renderPost(view, ctx, r.params); document.title = 'Post a signal · Career Bridge'; key = 'post:' + (r.params.soc || ''); }
  else if (r.view === 'me') { renderMe(view, ctx); document.title = 'Your profile · Career Bridge'; }
  else { renderAbout(view, ctx); document.title = 'About the numbers · Career Bridge'; }
  if (key !== lastKey) {   // new page: move focus to its heading so screen-reader users hear where they are
    lastKey = key;
    const head = $('occ-title') || $('view-title');
    if (head) { head.focus({preventScroll: true}); head.scrollIntoView({block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth'}); }
  } else if (activeId && $(activeId)) $(activeId).focus({preventScroll: true});  // same page re-rendered: keep focus on the control
}

function drawNav(r) {
  const items = [['job', 'Your job', ctx.hrefJob(lastSoc)], ['signals', 'Skill signals', hashFor('signals')], ['explore', 'Compare jobs', hashFor('explore')], ...(model.full ? [['board', 'For workforce boards', hashFor('board')]] : []), ['about', 'About the numbers', hashFor('about')]];
  $('nav').replaceChildren(...items.map(([k, label, href]) => h('a', {href, 'aria-current': k === r.view ? 'page' : null}, label)));
}

/* ---------- who you are (demo) ---------- */
function drawRole() {
  const r = role();
  $('role').replaceChildren(h('span', {class: 'rolelabel', id: 'rolelabel'}, 'You are'),
    h('div', {class: 'segs', role: 'group', 'aria-labelledby': 'rolelabel'}, Object.entries(ROLES).map(([k, v]) => h('button', {type: 'button', class: 'seg sm', 'aria-pressed': String(r === k), onclick: () => {
      if (role() === k) return;
      setRole(k); drawRole(); route(); announce(`Now viewing as ${v.label}.`);
    }}, v.label))),
    h('a', {href: '#/me', class: 'melink'}, 'Your profile'));
}

/* ---------- place ---------- */
function drawGeo() {
  $('geo').replaceChildren(...[['MA', 'Massachusetts'], ['US', 'United States']].map(([k, label]) => h('button', {type: 'button', class: 'seg', 'aria-pressed': String(state.geo === k), onclick: () => {
    if (state.geo === k) return;
    state.geo = k; store.set('cb-geo', k); model = makeModel(data, k); drawGeo(); drawExamples(); route(); announce(`Showing numbers for ${label}.`);
  }}, label)));
}
/* ---------- search ---------- */
const q = $('q'), res = $('results');
let hits = [], active = -1, timer = null;
function drawResults() {
  res.replaceChildren(...hits.map((x, i) => h('li', {role: 'option', id: 'opt' + i, 'aria-selected': String(i === active), onmousedown: (e) => { e.preventDefault(); pick(x.o.soc); }},
    h('span', {}, x.o.title, x.via ? h('small', {class: 'via'}, ` matched “${x.via}”`) : null), h('small', {}, `${x.o.jobs.toLocaleString('en-US')} jobs`))));
  res.hidden = !hits.length; q.setAttribute('aria-expanded', String(!!hits.length));
  hits.length && active >= 0 ? q.setAttribute('aria-activedescendant', 'opt' + active) : q.removeAttribute('aria-activedescendant');
}
function runSearch() {
  const text = q.value.trim();
  hits = text.length < 2 ? [] : search(text, model.occ); active = hits.length ? 0 : -1; drawResults();
  if (text.length >= 2) announce(hits.length ? `${hits.length} matching jobs. Use the arrow keys to choose.` : 'No matching jobs.');
  if (text.length >= 2 && !hits.length) { res.hidden = false; res.replaceChildren(h('li', {role: 'option', 'aria-disabled': 'true'}, 'No matching jobs. Try a shorter word.')); }
}
q.addEventListener('input', () => { loadTitles().then(runSearch); clearTimeout(timer); timer = setTimeout(runSearch, 100); });
q.addEventListener('focus', () => loadTitles());
q.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' && hits.length) { active = (active + 1) % hits.length; drawResults(); e.preventDefault(); }
  else if (e.key === 'ArrowUp' && hits.length) { active = (active - 1 + hits.length) % hits.length; drawResults(); e.preventDefault(); }
  else if (e.key === 'Enter' && active >= 0 && hits[active]) { pick(hits[active].o.soc); e.preventDefault(); }
  else if (e.key === 'Escape') { hits = []; drawResults(); }
});
q.addEventListener('blur', () => setTimeout(() => { hits = []; drawResults(); }, 120));
function pick(soc) { hits = []; drawResults(); q.blur(); if (location.hash === ctx.hrefJob(soc)) route(); else ctx.go('job', {}, soc); }
function drawExamples() {
  $('examples').replaceChildren(...EXAMPLES.filter(([soc]) => model.bySoc.get(soc)?.jobs != null)
    .map(([soc, name]) => h('button', {class: 'chip', type: 'button', onclick: () => pick(soc)}, name)));
}

/* ---------- start ---------- */
(async function start() {
  const view = $('view');
  view.replaceChildren(loading('Loading jobs…'));
  try { data = await loadData(); }
  catch (e) {
    view.replaceChildren(errorBox('Couldn’t load the data. Build it with: python pipeline/atlas.py, then start the app with: python server.py'));
    return;
  }
  model = makeModel(data, state.geo);
  if (model.full) $('lcnote').textContent = 'Data Source: Lightcast, 2026 · ';
  if (data.cb?.meta?.synthetic) { $('notice').hidden = false; $('notice').textContent = 'Test data: the Lightcast numbers shown are made up for testing.'; }
  drawGeo(); drawExamples(); drawRole();
  window.addEventListener('hashchange', route);
  route();
})();
