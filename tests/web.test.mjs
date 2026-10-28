// Run: node --test tests/
// Job-title search, and the survey's totals (shares in range, small groups hidden).
import test from 'node:test';
import assert from 'node:assert/strict';
import {search, useTitles} from '../web/js/search.js';
import {JOBS, totals, MIN_CELL, actsFor, submit, myCount} from '../web/js/survey.js';

// Avoid Node’s experimental native localStorage; tests install isolated browser storage.
Object.defineProperty(globalThis, 'localStorage', {value: undefined, writable: true, configurable: true});

test('search finds jobs by official and alternate titles', () => {
  const occs = [
    {soc: '15-1252', title: 'Software Developers', jobs: 48190}, {soc: '43-4051', title: 'Customer Service Representatives', jobs: 49990},
    {soc: '43-4041', title: 'Credit Authorizers, Checkers, and Clerks', jobs: 250}, {soc: '53-3032', title: 'Heavy and Tractor-Trailer Truck Drivers', jobs: 30890},
    {soc: '53-3033', title: 'Light Truck Drivers', jobs: 23350}];
  useTitles([['Software Engineer', '15-1252'], ['Customer Service Representative', '43-4041'], ['Truck Driver', '53-3032'], ['Truck Driver', '53-3033']]);
  assert.equal(search('software engineer', occs)[0].o.soc, '15-1252');
  assert.equal(search('software engineer', occs)[0].via, 'Software Engineer');
  assert.equal(search('customer service representative', occs)[0].o.soc, '43-4051', 'an official title beats an exact alternate title');
  assert.equal(search('truck driver', occs)[0].o.soc, '53-3032', 'ties go to the larger job');
  assert.equal(search('43-4051', occs)[0].o.soc, '43-4051');
  assert.deepEqual(search('', occs), []);
  assert.deepEqual(search('zzzz', occs), []);
  assert.deepEqual(search('*', occs), []);
});

const PLANS = {'43-6014': {lean: ['Scheduling Work and Activities'], use: ['Documenting/Recording Information', 'Working with Computers']}};

test('survey asks about the job’s O*NET activities plus the three AI activities', () => {
  assert.deepEqual(actsFor('43-6014', PLANS), ['scheduling', 'records', 'computers', 'ai-assist', 'ai-check', 'automation']);
});

test('survey totals are shares between 0 and 1, from the sample responses', () => {
  for (const j of JOBS) {
    const t = totals(j.soc, PLANS);
    assert.ok(t.nW >= MIN_CELL && t.nE >= MIN_CELL);
    for (const v of [t.useAnyAI, t.trainedByEmployer, t.adsMentionAI, t.employersTrain]) assert.ok(v >= 0 && v <= 1);
    for (const a of t.acts) {
      assert.ok(a.doPct >= 0 && a.doPct <= 1);
      assert.ok(a.aiOften + a.aiSome <= a.doPct + 1e-9, 'AI help is counted only among people who do the activity');
    }
  }
});

test('a group with fewer than 10 responses is hidden', () => {
  const t = totals('43-6014', PLANS, 'Cape and Islands');
  if (t.nW < MIN_CELL) { assert.equal(t.okW, false); assert.equal(t.useAnyAI, null); assert.ok(t.acts.every((a) => a.doPct == null)); }
  if (t.nE < MIN_CELL) { assert.equal(t.okE, false); assert.equal(t.adsMentionAI, null); }
  assert.ok(t.nW < MIN_CELL || t.nE < MIN_CELL, 'the smallest region should fall under the cutoff in the samples');
});

import {makeModel} from '../web/js/data.js';
import {parseHash, store} from '../web/js/util.js';
import {renderJob} from '../web/js/views/job.js';
import {renderOverview} from '../web/js/views/overview.js';
import {renderSurvey, renderResults} from '../web/js/views/survey.js';
import {renderBoard, QUADS} from '../web/js/views/board.js';

// Only the DOM operations used by the renderers. No browser or data files needed.
class Element {
  nodeType = 1;
  children = [];
  attrs = {};
  constructor(tag) { this.tag = tag; }
  append(...kids) { this.children.push(...kids); }
  replaceChildren(...kids) { this.children = kids; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  events = {};
  addEventListener(name, handler) { this.events[name] = handler; }
  focus() {}
  get textContent() { return this.children.map((c) => typeof c === 'object' ? c.textContent : c).join(''); }
  set textContent(v) { this.children = [v]; }
}
globalThis.document = {createElement: (tag) => new Element(tag), createElementNS: (_, tag) => new Element(tag)};
function nodes(root, predicate) {
  return [root, ...root.children.filter((c) => typeof c === 'object').flatMap((c) => nodes(c, () => true))].filter(predicate);
}
function context(geo = 'MA', patch = {}, licensed = false) {
  const o = {soc: JOBS[0].soc, title: 'Example job', group: 'Example', ma_jobs: 1200, us_jobs: 900000,
    ma_wage: 60000, us_wage: 80000, g: 5, growth_pct: 12, z: 50, ...patch};
  const model = makeModel({atlas: {meta: {scenarios: {}}, occ: [o], plans: {}}, cb: licensed ? {
    meta: {}, occ: [{soc: o.soc, exposure: 60, ma_ai_2025: .5, quadrant: QUADS[0], silent_gap: true}],
    strengths: {[o.soc]: [['Missing importance', null, 1], ['Missing difference', 4, null], ['Valid strength', 4, 1]]},
  } : null}, geo);
  return {model, state: {geo}, hrefJob: (soc) => `#/job/${soc}`, go() {}};
}
function render(fn, ctx, ...args) { const root = new Element('root'); fn(root, ctx, ...args); return root; }

test('growth fact uses uncapped US change, with an honestly labeled capped fallback', () => {
  for (const [growth_pct, label, value] of [[12, 'US change a year, 2019–25', '+12.0%'], [null, 'Capped US change a year, 2019–25', '+5.0%']]) {
    const ctx = context('MA', {growth_pct});
    const root = render(renderJob, ctx, ctx.model.all[0]);
    const fact = nodes(root, (n) => n.className === 'fact').find((n) => n.textContent.startsWith(label));
    assert.ok(fact);
    assert.ok(fact.textContent.includes(value));
    assert.ok(fact.textContent.includes('BLS OEWS 2019–2025'));
  }
});

test('pilot cards follow geography and the board always uses MA counts and wages', () => {
  for (const geo of ['MA', 'US']) {
    const ctx = context(geo, {}, true);
    for (const fn of [renderOverview, renderSurvey]) {
      const root = render(fn, ctx, {});
      const cards = nodes(root, (n) => n.className === 'jobcard');
      assert.ok(cards[0].textContent.includes(geo === 'MA' ? '1,200 Massachusetts workers' : '900,000 US workers'));
      assert.ok(cards[0].textContent.includes('BLS OEWS May 2025'));
    }
    const board = render(renderBoard, ctx, {});
    assert.ok(board.textContent.includes('1,200 MA workers'));
    assert.ok(board.textContent.includes('$60,000'));
    assert.ok(!board.textContent.includes('900,000'));
    assert.ok(!board.textContent.includes('$80,000'));
  }
  const ctx = context('US', {ma_jobs: null}, true);
  assert.ok(render(renderBoard, ctx, {}).textContent.includes('0 jobs · 0 MA workers'));
});

test('missing exposure, AI use, strengths, counts and pay never become zero or throw', () => {
  const ctx = context('MA', {z: null, ma_jobs: null, ma_wage: null}, true);
  ctx.model.all[0].lc.exposure = null;
  ctx.model.all[0].capPct = null;
  const job = render(renderJob, ctx, ctx.model.all[0]);
  assert.ok(job.textContent.includes('Not enough data'));
  assert.ok(!job.textContent.includes('Top 100%'));
  assert.ok(!job.textContent.includes('0 of 100'));
  assert.ok(!job.textContent.includes('Missing importance'));
  assert.ok(!job.textContent.includes('Missing difference'));
  assert.ok(job.textContent.includes('Valid strength 4.0'));
  for (const fn of [renderOverview, renderSurvey]) {
    const root = render(fn, ctx, {});
    const card = nodes(root, (n) => n.className === 'jobcard')[0];
    assert.ok(card.textContent.includes('Not enough data'));
    assert.ok(!card.textContent.includes('0 Massachusetts workers'));
    assert.ok(!card.textContent.includes('$0'));
  }
  const payCtx = context('MA', {ma_wage: null});
  assert.ok(render(renderOverview, payCtx).textContent.includes('median pay Not enough data'));
  const boardCtx = context('US', {z: null}, true);
  const board = render(renderBoard, boardCtx, {});
  const row = nodes(board, (n) => n.tag === 'tbody')[0].children[0];
  assert.equal(row.children.at(-1).textContent, 'Not enough data');
  const zeroCtx = context('MA', {z: 0});
  assert.ok(render(renderJob, zeroCtx, zeroCtx.model.all[0]).textContent.includes('Top 100%'));
});

test('routing falls back on malformed routes and leaves in-page fragments to the browser', () => {
  assert.deepEqual(parseHash('#/job/%'), {view: 'overview', params: {}, soc: ''});
  assert.equal(parseHash('#main'), null);
  assert.equal(parseHash('#anything'), null);
  assert.equal(parseHash('#/unknown').view, 'overview');
  assert.equal(parseHash('').view, 'overview');
  assert.deepEqual(parseHash('#/job/43%2D6014?x=1'), {view: 'job', soc: '43-6014', params: {x: '1'}});
  assert.equal(parseHash('#/survey?job=43-6014').view, 'survey');
});

import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('hashchange preserves the current view for #main and renders overview for bad decoding', () => {
  const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
  const route = app.slice(app.indexOf('function route()'), app.indexOf('\nfunction drawNav'));
  const root = new Element('root');
  root.contains = () => false;
  root.append('Current job');
  let rendered = 0, navDraws = 0;
  const sandbox = {
    parseHash, location: {hash: '#main'}, lastKey: 'job:43-6014',
    model: {full: false}, ctx: {},
    document: {activeElement: null, querySelector: () => ({hidden: false})},
    $: (id) => id === 'view' ? root : null,
    drawNav() { navDraws++; },
    renderOverview(view) { rendered++; view.replaceChildren('Overview'); },
  };
  vm.createContext(sandbox);
  vm.runInContext(route + '\nroute();', sandbox);
  assert.equal(root.textContent, 'Current job');
  assert.equal(rendered, 0);
  assert.equal(navDraws, 0);
  sandbox.location.hash = '#/job/%';
  vm.runInContext('route();', sandbox);
  assert.equal(root.textContent, 'Overview');
  assert.equal(rendered, 1);
  assert.equal(sandbox.lastKey, 'overview');
});


test('search folds accents in queries, official titles and alternate titles', () => {
  const occs = [{soc: '1', title: 'Résumé Writer'}, {soc: '2', title: 'Cafeteria Worker'}, {soc: '3', title: 'Café Manager'}];
  useTitles([['Résumé Specialist', '1']]);
  for (const q of ['résumé writer', 'resume writer', 're\u0301sume\u0301 writer']) assert.equal(search(q, occs)[0].o.soc, '1');
  assert.equal(search('resume specialist', occs)[0].via, 'Résumé Specialist');
  for (const q of ['café', 'cafe', 'cafe\u0301']) assert.ok(search(q, occs).some((x) => x.o.soc === '3'));
  assert.deepEqual(search('writ', occs).map((x) => x.o.soc), ['1']);  // partial words still match while typing
  assert.doesNotThrow(() => search('*', [{soc: '9', title: '*'}]));
});

function storage(t, fail = false) {
  const old = globalThis.localStorage;
  const data = new Map();
  globalThis.localStorage = {getItem: (k) => data.get(k) ?? null, setItem(k, v) {
    if (fail) throw new Error('quota');
    data.set(k, v);
  }};
  t.after(() => { globalThis.localStorage = old; });
  return data;
}
const worker = (region = 'Boston') => ({side: 'worker', soc: JOBS[0].soc, region,
  acts: {'ai-assist': 'often', 'ai-check': 'some'}, tools: ['chat'], help: ['tools'], trained: 'yes'});
const employer = () => ({side: 'employer', soc: JOBS[0].soc, region: 'Boston', need: {'ai-assist': true}, growing: ['ai-assist']});

test('sample and submitted totals apply the cutoff separately, including region filters', (t) => {
  storage(t);
  const sample = totals(JOBS[0].soc, PLANS);
  for (let i = 0; i < 9; i++) { assert.equal(submit(worker()), true); submit(employer()); }
  let own = totals(JOBS[0].soc, PLANS, '', 'mine');
  assert.equal(own.nW, 9); assert.equal(own.nE, 9);
  assert.equal(own.useAnyAI, null); assert.equal(own.adsMentionAI, null);
  assert.ok(own.acts.every((a) => a.doPct === null && a.needPct === null));
  assert.deepEqual(totals(JOBS[0].soc, PLANS), sample);
  submit(worker()); submit(employer());
  own = totals(JOBS[0].soc, PLANS, '', 'mine');
  assert.equal(own.okW, true); assert.equal(own.okE, true); assert.equal(own.useAnyAI, 1);
  submit(worker('Berkshire'));
  own = totals(JOBS[0].soc, PLANS, 'Berkshire', 'mine');
  assert.equal(own.nW, 1); assert.equal(own.useAnyAI, null);
  const ctx = context();
  let route;
  ctx.go = (view, params) => { route = {view, params}; };
  const root = render(renderResults, ctx, {source: 'mine'});
  assert.ok(root.textContent.includes('Your answers · this browser'));
  assert.ok(!root.textContent.includes('Sample results.'));
  const sampleRoot = render(renderResults, ctx, {});
  assert.ok(sampleRoot.textContent.includes('Sample results.'));
  nodes(sampleRoot, (n) => n.tag === 'button' && n.textContent === 'Your answers')[0].events.click();
  assert.deepEqual(route, {view: 'results', params: {source: 'mine'}});
});

test('malformed saved answers are ignored by counts and results', (t) => {
  const data = storage(t);
  for (const value of ['bad json', '{}', 'null', JSON.stringify([null, {}, {...worker(), acts: null},
    {...employer(), need: null}, {...employer(), growing: null}, worker(), employer()])]) {
    data.set('cb-survey-v1', value);
    assert.doesNotThrow(() => totals(JOBS[0].soc, PLANS, '', 'mine'));
    assert.doesNotThrow(() => render(renderResults, context(), {source: 'mine'}));
  }
  assert.equal(myCount(), 2);
});

test('failed storage keeps the form visible and success alone shows thank-you', (t) => {
  const oldFormData = globalThis.FormData;
  const oldGet = document.getElementById;
  t.after(() => { globalThis.FormData = oldFormData; document.getElementById = oldGet; });
  globalThis.FormData = class {
    get(k) { return k === 'region' ? 'Boston' : k.startsWith('a-') ? 'often' : 'yes'; }
    getAll() { return []; }
  };
  document.getElementById = (id) => id === 'view-title' ? new Element('h2') : null;
  storage(t);
  const setItem = globalThis.localStorage.setItem;
  for (const fail of [true, false]) {
    globalThis.localStorage.setItem = fail ? () => { throw new Error('quota'); } : setItem;
    assert.equal(store.set('probe', 'value'), !fail);
    assert.equal(submit(worker()), !fail);
    const root = render(renderSurvey, context(), {job: JOBS[0].soc, as: 'worker'});
    assert.ok(root.textContent.includes('Stored as-is in this browser until you choose “Clear my answers”.'));
    const form = nodes(root, (n) => n.tag === 'form')[0];
    form.events.submit({preventDefault() {}, currentTarget: form});
    assert.equal(root.textContent.includes('Thank you'), !fail);
    assert.equal(root.textContent.includes('Could not save your answers. Try again.'), fail);
  }
});
