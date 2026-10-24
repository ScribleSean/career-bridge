// Run: node --test tests/
// Checks the browser's scenario math against numbers computed independently in Python
// (sgi_analysis/analysis/occupation_risk.py, May 2025 -> May 2031), and the job-title search.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loss, trendJobs, jobs2031, pathJobs, totals, byGroup, presetOf, HORIZON} from '../web/js/scenario.js';
import {search, useTitles} from '../web/js/search.js';

const near = (a, b, tol = 0.0005) => assert.ok(Math.abs(a - b) <= Math.abs(b) * tol, `${a} is not within ${tol * 100}% of ${b}`);
// Reference rows (US). The page stores growth and shares as percents; the CSV holds fractions.
const SOFTWARE = {o: {g: -0.14, z: 78.51, auto: 65.99}, jobs: 1687890, trend: 1673711.83, base: 1565320.93, fast: 1456930.02, slow: 1630355.47};
const CSR = {o: {g: -1.94, z: 49.08, auto: 59.62}, jobs: 2595750, trend: 2308114.83, base: 2223683.48, fast: 2139252.13, slow: 2274342.29};
const PRESETS = {slow: {A: 0.1, P: 0.5}, base: {A: 0.25, P: 0.5}, fast: {A: 0.5, P: 0.5}};

test('matches the Python scenario numbers', () => {
  for (const r of [SOFTWARE, CSR]) {
    near(trendJobs(r.o, r.jobs), r.trend);
    near(jobs2031(r.o, r.jobs, 0.1, 0.5), r.slow);
    near(jobs2031(r.o, r.jobs, 0.25, 0.5), r.base);
    near(jobs2031(r.o, r.jobs, 0.5, 0.5), r.fast);
  }
});

test('no adoption means the past trend', () => {
  assert.equal(jobs2031(SOFTWARE.o, 1000, 0, 0.5), trendJobs(SOFTWARE.o, 1000));
  assert.equal(loss(SOFTWARE.o, 0, 1), 0);
});

test('more adoption or more headcount effect never adds jobs', () => {
  let prev = Infinity;
  for (const A of [0.05, 0.25, 0.5, 0.8]) { const v = jobs2031(CSR.o, 1000, A, 0.5); assert.ok(v < prev); prev = v; }
  assert.ok(jobs2031(CSR.o, 1000, 0.25, 1) < jobs2031(CSR.o, 1000, 0.25, 0.1));
});

test('the path starts at today and ends at the 2031 value', () => {
  assert.equal(pathJobs(CSR.o, 1000, 0.25, 0.5, 0), 1000);
  near(pathJobs(CSR.o, 1000, 0.25, 0.5, HORIZON), jobs2031(CSR.o, 1000, 0.25, 0.5), 1e-12);
});

test('totals and group rows add up, and skip jobs without a count', () => {
  const list = [{...SOFTWARE.o, group: 'A', jobs: 100}, {...CSR.o, group: 'B', jobs: 300}, {...CSR.o, group: 'B', jobs: null}];
  const t = totals(list, (o) => o.jobs, 0.25, 0.5);
  assert.equal(t.now, 400);
  const g = byGroup(list, (o) => o.jobs, {A: 0.25, P: 0.5}, PRESETS);
  assert.equal(g.length, 2);
  assert.ok(g.every((r) => r.fastPct < r.vsTrendPct && r.vsTrendPct < r.slowPct));
});

test('presetOf names a preset or says custom', () => {
  assert.equal(presetOf(0.25, 0.5, PRESETS), 'base');
  assert.equal(presetOf(0.3, 0.5, PRESETS), 'custom');
});

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
});
