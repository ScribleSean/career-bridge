// Run: node --test tests/
// Job-title search, and the survey's totals (shares in range, small groups hidden).
import test from 'node:test';
import assert from 'node:assert/strict';
import {search, useTitles} from '../web/js/search.js';
import {JOBS, totals, MIN_CELL, actsFor} from '../web/js/survey.js';

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
