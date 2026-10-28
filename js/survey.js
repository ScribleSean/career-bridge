// The AI-at-work survey: a short, repeatable question set for three silent-gap jobs, answered by workers and by
// employers, published only as totals. Built on O*NET work activities so results line up with federal and Lightcast data.
// Demo: sample responses are generated here and labeled as samples; answers you submit stay in this browser.
import {store} from './util.js';

/* ---------- the three pilot jobs ---------- */
export const JOBS = [
  {soc: '43-6014', short: 'Administrative assistants'},
  {soc: '43-4051', short: 'Customer service representatives'},
  {soc: '41-2031', short: 'Retail salespeople'},
];
export const jobShort = (soc) => JOBS.find((j) => j.soc === soc)?.short || soc;

/* ---------- work activities: plain labels over O*NET 31.0, plus three AI activities O*NET doesn't track ---------- */
export const ACTS = [
  ['relationships', 'Building relationships', 'Establishing and Maintaining Interpersonal Relationships'],
  ['caring', 'Caring for people', 'Assisting and Caring for Others'],
  ['scheduling', 'Scheduling', 'Scheduling Work and Activities'],
  ['communicating', 'Team communication', 'Communicating with Supervisors, Peers, or Subordinates'],
  ['info', 'Finding information', 'Getting Information'],
  ['creative', 'Creative thinking', 'Thinking Creatively'],
  ['records', 'Writing records and notes', 'Documenting/Recording Information'],
  ['computers', 'Computer work', 'Working with Computers'],
  ['conflicts', 'Handling complaints', 'Resolving Conflicts and Negotiating with Others'],
  ['learning', 'Keeping up with new knowledge', 'Updating and Using Relevant Knowledge'],
  ['staffing', 'Hiring and staffing', 'Staffing Organizational Units'],
  ['selling', 'Selling and persuading', 'Selling or Influencing Others'],
  ['data', 'Analyzing data', 'Analyzing Data or Information'],
  ['decisions', 'Making decisions', 'Making Decisions and Solving Problems'],
  ['handling', 'Handling and moving things', 'Handling and Moving Objects'],
  ['ai-assist', 'Using AI assistants', null],
  ['ai-check', 'Checking AI output', null],
  ['automation', 'Automating routine tasks', null],
].map(([id, label, onet]) => ({id, label, onet}));
export const ACT = Object.fromEntries(ACTS.map((a) => [a.id, a]));
const BY_ONET = Object.fromEntries(ACTS.filter((a) => a.onet).map((a) => [a.onet, a.id]));
const AI_ACTS = ['ai-assist', 'ai-check', 'automation'];

/** The activities asked about for a job: the ones O*NET lists for it, then the three AI activities. */
export function actsFor(soc, plans) {
  const p = plans?.[soc];
  const ids = [...new Set([...(p?.lean || []), ...(p?.use || [])].map((n) => BY_ONET[n]).filter(Boolean))];
  return [...ids, ...AI_ACTS];
}

export const REGIONS = ['Boston', 'Metro North', 'Metro South/West', 'Northeast', 'Southeast', 'Central', 'Pioneer Valley', 'Berkshire', 'Cape and Islands'];

/* ---------- the questions ---------- */
export const AI_LEVELS = [['no', 'Not at all'], ['some', 'Sometimes'], ['often', 'Most of the time']];
export const WORKER_Q = {
  tools: {q: 'Which AI tools, if any, do you use for work?', multi: true, opts: [['none', 'None'], ['chat', 'A chat assistant (ChatGPT, Claude, Copilot or similar)'], ['builtin', 'AI built into software we already use'], ['other', 'Something else']]},
  trained: {q: 'Has your employer trained you to use AI?', opts: [['yes', 'Yes'], ['self', 'No, I learned on my own'], ['no', 'No']]},
  help: {q: 'What would help you most in the next year?', multi: true, opts: [['tools', 'Training on AI tools'], ['check', 'Training on checking AI’s work'], ['people', 'More time on work with people'], ['nothing', 'Nothing needed']]},
  years: {q: 'How long have you done this job?', opts: [['lt1', 'Less than a year'], ['1to5', '1 to 5 years'], ['gt5', 'More than 5 years']]},
};
export const EMPLOYER_Q = {
  ads: {q: 'Do your job ads for this role mention AI skills?', opts: [['yes', 'Yes'], ['want', 'Not yet, but we want those skills'], ['no', 'No']]},
  train: {q: 'Do you train people in this role to use AI?', opts: [['yes', 'Yes'], ['planning', 'Planning to'], ['no', 'No']]},
  size: {q: 'How many people work at your organization?', opts: [['s', 'Fewer than 50'], ['m', '50 to 499'], ['l', '500 or more']]},
};

/* ---------- sample responses (deterministic; every one labeled "sample") ---------- */
function rng(seed) {
  let a = 0;
  for (const ch of seed) a = (a * 31 + ch.charCodeAt(0)) | 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// How much each pilot job leans on AI in the samples. Made up to show how results read, not estimates.
const AI_LEAN = {'43-6014': 0.55, '43-4051': 0.45, '41-2031': 0.25};
const pickW = (r, pairs) => { let x = r() * pairs.reduce((s, p) => s + p[1], 0); for (const [k, w] of pairs) { x -= w; if (x <= 0) return k; } return pairs[0][0]; };

function samples(soc, plans) {
  const r = rng('survey-' + soc), lean = AI_LEAN[soc] ?? 0.4;
  const acts = actsFor(soc, plans), use = new Set((plans?.[soc]?.use || []).map((n) => BY_ONET[n]));
  const out = [];
  for (let i = 0; i < 124; i++) {
    const usesAI = r() < lean + 0.1;
    const a = {};
    for (const id of acts) {
      const ai = AI_ACTS.includes(id);
      const does = ai ? usesAI && r() < (id === 'ai-assist' ? 0.85 : id === 'ai-check' ? 0.5 : 0.3) : r() < (use.has(id) ? 0.8 : 0.88);
      if (!does) continue;
      a[id] = ai ? (r() < 0.5 ? 'often' : 'some') : usesAI && use.has(id) ? pickW(r, [['often', .3], ['some', .45], ['no', .25]]) : pickW(r, [['some', .12], ['no', .88]]);
    }
    const tools = usesAI ? [r() < 0.7 ? 'chat' : null, r() < 0.45 ? 'builtin' : null].filter(Boolean) : ['none'];
    out.push({side: 'worker', soc, sample: true, region: pickW(r, REGIONS.map((x, j) => [x, j < 6 ? 3 : 1])), acts: a,
      tools: tools.length ? tools : ['chat'], trained: pickW(r, [['yes', .18], ['self', usesAI ? .5 : .1], ['no', .5]]),
      help: [r() < (usesAI ? .55 : .3) ? 'tools' : null, r() < (usesAI ? .45 : .15) ? 'check' : null, r() < .3 ? 'people' : null].filter(Boolean).concat([]),
      years: pickW(r, [['lt1', .2], ['1to5', .45], ['gt5', .35]])});
  }
  for (let i = 0; i < 26; i++) {
    const need = {}, growing = [];
    for (const id of acts) {
      const ai = AI_ACTS.includes(id);
      if (r() < (ai ? lean * 0.9 : 0.8)) need[id] = true;
      if (r() < (ai ? lean * 0.7 : 0.12)) growing.push(id);
    }
    out.push({side: 'employer', soc, sample: true, region: pickW(r, REGIONS.map((x, j) => [x, j < 6 ? 3 : 1])), need, growing,
      ads: pickW(r, [['yes', .1], ['want', .3], ['no', .6]]), train: pickW(r, [['yes', .22], ['planning', .35], ['no', .43]]), size: pickW(r, [['s', .45], ['m', .35], ['l', .2]])});
  }
  return out;
}

/* ---------- storage ---------- */
const KEY = 'cb-survey-v1';
const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const valid = (v) => record(v) && JOBS.some((j) => j.soc === v.soc) && REGIONS.includes(v.region) &&
  (v.side === 'worker' ? record(v.acts) && Object.values(v.acts).every((x) => AI_LEVELS.some(([id]) => id === x)) &&
    Array.isArray(v.tools) && Array.isArray(v.help) :
    v.side === 'employer' && record(v.need) && Object.values(v.need).every((x) => x === true) &&
    Array.isArray(v.growing) && v.growing.every((x) => typeof x === 'string'));
const mine = () => {
  try { const v = JSON.parse(store.get(KEY) || '[]'); return Array.isArray(v) ? v.filter(valid) : []; }
  catch (e) { return []; }
};
export function submit(resp) { const v = mine(); v.push({...resp, mine: true, at: new Date().toISOString().slice(0, 10)}); return store.set(KEY, JSON.stringify(v)); }
export const resetMine = () => store.set(KEY, '[]');
export const myCount = () => mine().length;

const cache = {};
export function responses(soc, plans, source = 'sample') {
  cache[soc] ||= samples(soc, plans);
  return source === 'mine' ? mine().filter((x) => x.soc === soc) : [...cache[soc]];
}

/* ---------- totals: nothing is shown for a group under MIN_CELL responses ---------- */
export const MIN_CELL = 10;
const share = (n, d) => (d ? n / d : null);
export function totals(soc, plans, region = '', source = 'sample') {
  const all = responses(soc, plans, source).filter((x) => !region || x.region === region);
  const W = all.filter((x) => x.side === 'worker'), E = all.filter((x) => x.side === 'employer');
  const okW = W.length >= MIN_CELL, okE = E.length >= MIN_CELL;
  const acts = actsFor(soc, plans).map((id) => {
    const doers = W.filter((x) => x.acts[id]);
    return {id, doPct: okW ? share(doers.length, W.length) : null,
      aiOften: okW ? share(doers.filter((x) => x.acts[id] === 'often').length, W.length) : null,
      aiSome: okW ? share(doers.filter((x) => x.acts[id] === 'some').length, W.length) : null,
      needPct: okE ? share(E.filter((x) => x.need[id]).length, E.length) : null,
      growPct: okE ? share(E.filter((x) => x.growing.includes(id)).length, E.length) : null};
  });
  const opt = (list, key, val) => share(list.filter((x) => (Array.isArray(x[key]) ? x[key].includes(val) : x[key] === val)).length, list.length);
  return {
    nW: W.length, nE: E.length, okW, okE, acts,
    useAnyAI: okW ? 1 - opt(W, 'tools', 'none') : null,
    trainedByEmployer: okW ? opt(W, 'trained', 'yes') : null,
    adsMentionAI: okE ? opt(E, 'ads', 'yes') : null,
    employersTrain: okE ? opt(E, 'train', 'yes') : null,
    help: okW ? WORKER_Q.help.opts.map(([k, label]) => ({label, pct: opt(W, 'help', k)})) : [],
  };
}
