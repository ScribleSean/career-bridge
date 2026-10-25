// Skill signals: workers and employers say which skills a job actually uses, and where AI helps.
// The community confirms them: coworkers vouch, employers and MassHire career centers verify.
// Static demo: sample signals are generated here (and labeled as samples); what you post or confirm
// is kept in this browser only (localStorage). Nothing is sent anywhere.
import {store} from './util.js';

/* ---------- vocabulary: plain labels over O*NET 31.0 work activities, plus newer skills O*NET doesn't list yet ---------- */
export const SKILLS = [
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
  ['advice', 'Giving advice', 'Providing Consultation and Advice to Others'],
  ['decisions', 'Making decisions', 'Making Decisions and Solving Problems'],
  ['leading', 'Leading a team', 'Guiding, Directing, and Motivating Subordinates'],
  ['coaching', 'Coaching and training others', 'Coaching and Developing Others'],
  ['strategy', 'Planning strategy', 'Developing Objectives and Strategies'],
  ['compliance', 'Checking rules and standards', 'Evaluating Information to Determine Compliance with Standards'],
  ['resources', 'Managing money and resources', 'Monitoring and Controlling Resources'],
  ['details', 'Spotting problems and details', 'Identifying Objects, Actions, and Events'],
  ['estimating', 'Estimating costs and amounts', 'Estimating the Quantifiable Characteristics of Products, Events, or Information'],
  ['inspecting', 'Inspecting equipment', 'Inspecting Equipment, Structures, or Materials'],
  ['monitoring', 'Monitoring processes', 'Monitoring Processes, Materials, or Surroundings'],
  ['organizing', 'Organizing and prioritizing', 'Organizing, Planning, and Prioritizing Work'],
  ['physical', 'Physical work', 'Performing General Physical Activities'],
  ['handling', 'Handling and moving things', 'Handling and Moving Objects'],
  ['repairing', 'Repairing equipment', 'Repairing and Maintaining Mechanical Equipment'],
  ['ai-assist', 'Using AI assistants', null],
  ['ai-check', 'Checking AI output', null],
  ['automation', 'Automating routine tasks', null],
].map(([id, label, onet]) => ({id, label, onet}));
export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
const BY_ONET = Object.fromEntries(SKILLS.filter((s) => s.onet).map((s) => [s.onet, s.id]));
export const onetIds = (names = []) => names.map((n) => BY_ONET[n]).filter(Boolean);

export const REGIONS = ['Boston', 'Metro North', 'Metro West', 'Northeast', 'Southeast', 'Central (Worcester)', 'Pioneer Valley', 'Berkshire', 'Cape and Islands'];

/* ---------- who you are in the demo ---------- */
export const ROLES = {
  worker: {label: 'Worker', you: 'You (worker)', can: 'Post what your job uses. Vouch for coworkers.'},
  employer: {label: 'Employer', you: 'You (employer)', can: 'Post what you need in a role. Verify workers.'},
  masshire: {label: 'MassHire', you: 'You (MassHire career center)', can: 'Verify any signal after talking with the person.'},
};
export const role = () => (ROLES[store.get('cb-role')] ? store.get('cb-role') : 'worker');
export const setRole = (r) => store.set('cb-role', r);

/* ---------- status ---------- */
export const COMMUNITY_MIN = 3;
export function status(sig) {
  const c = sig.confirms || [];
  if (c.some((x) => x.kind === 'masshire')) return 'masshire';
  if (c.some((x) => x.kind === 'employer')) return 'employer';
  if (c.filter((x) => x.kind === 'coworker').length >= COMMUNITY_MIN) return 'community';
  return 'posted';
}
export const STATUS = {
  masshire: ['Verified by MassHire', 'v-masshire'],
  employer: ['Employer verified', 'v-employer'],
  community: ['Community confirmed', 'v-community'],
  posted: ['Posted', 'v-posted'],
};
export const isVerified = (sig) => status(sig) !== 'posted';

/* ---------- samples (deterministic, labeled "Sample" everywhere) ---------- */
function rng(seed) {
  let a = 0;
  for (const ch of seed) a = (a * 31 + ch.charCodeAt(0)) | 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const shuffle = (r, arr) => arr.map((x) => [r(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const FIRST = ['Ana', 'Marcus', 'Priya', 'Tom', 'Keisha', 'Luis', 'Mei', 'Dan', 'Rosa', 'Sam', 'Fatima', 'Kevin', 'Grace', 'Omar', 'Lena', 'Jake'];
const EMPLOYERS = ['Community health center', 'Regional hospital', 'Property management firm', 'Credit union', 'Public school district', 'Manufacturing plant', 'Retail chain', 'Software startup', 'Insurance office', 'City government'];
export const DEMO_JOBS = ['43-6014', '43-4051', '29-1141', '41-2031', '43-3031', '13-2011', '15-1252', '25-2021', '47-2111', '31-1131'];
// Hand-written notes for Denise's job (the demo story); other jobs use short templates.
const NOTES = {
  '43-6014': {
    worker: ['I use Claude to draft meeting notes and emails, then fix the tone. Scheduling still takes judgment: people have preferences no tool knows.',
      'Most of my day is people: visitors, calls, the director’s calendar. AI helps me write up minutes faster.',
      'We started using AI to summarize long email threads. I check every summary before it goes out.',
      'Our office has no AI tools yet. The job is mostly coordination and being the person everyone asks.'],
    employer: ['We want assistants who can run AI tools for drafting and records, and still own the relationships with clients.',
      'Next year we are moving scheduling and records to new software. We will train current staff rather than hire.'],
  },
};
// How people would say it: "AI helps me with ___" and "___ still needs a person".
const AI_PHRASE = {records: 'drafting notes and records', computers: 'routine computer work', info: 'looking things up', creative: 'brainstorming ideas',
  data: 'summarizing numbers', advice: 'preparing what I tell people', decisions: 'thinking through options', scheduling: 'scheduling',
  communicating: 'writing emails and updates', organizing: 'planning my week', compliance: 'checking documents against the rules', 'ai-assist': 'first drafts'};
const PERSON = (k) => SKILL[k].label.replace(/^./, (c) => c.toUpperCase());
const low = (k) => SKILL[k].label.replace(/^./, (c) => c.toLowerCase()).replace(/\bai\b/gi, 'AI');
const and = (xs) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const TEMPLATE = {
  worker: (s, ai) => {
    const human = s.find((k) => !ai.includes(k) && SKILL[k].onet) || s[0];
    const helps = [...new Set(ai.map((k) => AI_PHRASE[k]).filter(Boolean))];
    return helps.length ? `AI helps me with ${and(helps)}. ${PERSON(human)} still needs a person.`
      : `Most of my day is ${low(s[0])}, plus ${low(s[1])}. We don’t use AI tools yet.`;
  },
  employer: (s, g) => `This role runs on ${low(s[0])} and ${low(s[1])}. We are training people in ${and(g.filter((k) => k !== s[0]).slice(0, 2).map(low))}.`,
};
const TODAY = new Date('2026-10-24T12:00:00');
const daysAgo = (d) => new Date(TODAY - d * 864e5).toISOString().slice(0, 10);

function samplesFor(soc, plan) {
  const r = rng(soc), lean = onetIds(plan?.lean), use = onetIds(plan?.use);
  const base = [...new Set([...lean, ...use])];
  if (base.length < 3) return [];
  const out = [];
  const nW = 4 + Math.floor(r() * 3), nE = 2;
  for (let i = 0; i < nW + nE; i++) {
    const side = i < nW ? 'worker' : 'employer';
    const picked = shuffle(r, base).slice(0, 3 + Math.floor(r() * 2));
    const usesAI = side === 'employer' || r() < 0.65;
    const aiOn = usesAI ? picked.filter((k) => use.includes(k)).slice(0, 2) : [];
    if (usesAI && r() < 0.5) { picked.push('ai-assist'); aiOn.push('ai-assist'); }
    if (side === 'worker' && usesAI && r() < 0.2) picked.push('ai-check');
    const growing = side === 'employer' ? [...new Set(['ai-assist', r() < 0.5 ? 'ai-check' : 'automation', ...lean.slice(0, 1)])] : [];
    const notes = NOTES[soc]?.[side];
    const note = notes ? notes[i % notes.length] : TEMPLATE[side](picked, side === 'worker' ? aiOn : growing);
    const id = `s-${soc}-${i}`;
    const nConf = Math.floor(r() * 5);
    const confirms = Array.from({length: nConf}, (_, j) => ({by: `sample-${soc}-${i}-${j}`, name: pick(r, FIRST), kind: 'coworker', at: daysAgo(Math.floor(r() * 20))}));
    if (side === 'worker' && r() < 0.35) confirms.push({by: `sample-emp-${soc}-${i}`, name: pick(r, EMPLOYERS), kind: 'employer', at: daysAgo(Math.floor(r() * 10))});
    if (side === 'worker' && r() < 0.15) confirms.push({by: 'sample-masshire', name: 'MassHire Central Career Center', kind: 'masshire', at: daysAgo(Math.floor(r() * 10))});
    out.push({
      id, soc, side, sample: true,
      author: side === 'worker' ? {id: `sample-w-${soc}-${i}`, name: `${pick(r, FIRST)} ${String.fromCharCode(65 + Math.floor(r() * 26))}.`, years: 1 + Math.floor(r() * 15)}
        : {id: `sample-e-${soc}-${i}`, name: pick(r, EMPLOYERS)},
      region: pick(r, REGIONS), posted: daysAgo(3 + Math.floor(r() * 55)),
      skills: picked.map((k) => ({id: k, ai: aiOn.includes(k)})), growing, note, confirms,
    });
  }
  return out;
}

/* ---------- storage: samples + what this browser added ---------- */
const KEY = 'cb-signals-v1';
function local() {
  try { const v = JSON.parse(store.get(KEY) || '{}'); return {posts: v.posts || [], confirms: v.confirms || []}; } catch (e) { return {posts: [], confirms: []}; }
}
const saveLocal = (v) => store.set(KEY, JSON.stringify(v));
export const resetDemo = () => store.set(KEY, '{}');

let samples = null;
export function allSignals(model) {
  if (!samples) samples = DEMO_JOBS.flatMap((soc) => samplesFor(soc, model.plans?.[soc]));
  const mine = local();
  const list = [...mine.posts, ...samples].map((s) => ({...s, confirms: [...(s.confirms || []), ...mine.confirms.filter((c) => c.sig === s.id)]}));
  return list.sort((a, b) => (a.posted < b.posted ? 1 : -1));
}

export function post(sig) {
  const v = local();
  v.posts.unshift({...sig, id: 'mine-' + Date.now().toString(36), mine: true, posted: new Date().toISOString().slice(0, 10), confirms: []});
  saveLocal(v);
}
export function removePost(id) { const v = local(); v.posts = v.posts.filter((p) => p.id !== id); v.confirms = v.confirms.filter((c) => c.sig !== id); saveLocal(v); }

/** Can the current role confirm this signal, and as what? */
export function confirmKind(sig, r = role()) {
  if (sig.mine && sig.role === r) return null;   // you can't vouch for yourself; another demo role can
  if (r === 'masshire') return 'masshire';
  if (r === 'employer') return sig.side === 'worker' ? 'employer' : null;
  return 'coworker';
}
export const confirmedByMe = (sig) => (sig.confirms || []).some((c) => c.by === 'me-' + role());
export function confirm(sig) {
  const kind = confirmKind(sig);
  if (!kind || confirmedByMe(sig)) return;
  const v = local();
  v.confirms.push({sig: sig.id, by: 'me-' + role(), name: ROLES[role()].you, kind, at: new Date().toISOString().slice(0, 10)});
  saveLocal(v);
}
export function unconfirm(sig) { const v = local(); v.confirms = v.confirms.filter((c) => !(c.sig === sig.id && c.by === 'me-' + role())); saveLocal(v); }
export const myActivity = (model) => {
  const all = allSignals(model), r = role();
  return {posts: all.filter((s) => s.mine && s.role === r), confirmed: all.filter((s) => s.confirms.some((c) => c.by === 'me-' + r))};
};

/* ---------- what a job's signals add up to ---------- */
export function summarize(list, plan) {
  const official = new Set(onetIds([...(plan?.lean || []), ...(plan?.use || [])]));
  const rows = {};
  for (const s of list) {
    for (const k of s.skills) {
      const x = rows[k.id] ||= {id: k.id, worker: 0, employer: 0, ai: 0, verified: 0, growing: 0};
      x[s.side]++; if (k.ai) x.ai++; if (isVerified(s)) x.verified++;
    }
    for (const g of s.growing || []) (rows[g] ||= {id: g, worker: 0, employer: 0, ai: 0, verified: 0, growing: 0}).growing++;
  }
  const workers = list.filter((s) => s.side === 'worker'), employers = list.filter((s) => s.side === 'employer');
  return {
    total: list.length, workers: workers.length, employers: employers.length, verified: list.filter(isVerified).length,
    usesAI: workers.filter((s) => s.skills.some((k) => k.ai)).length,
    skills: Object.values(rows).map((x) => ({...x, official: official.has(x.id)})).sort((a, b) => (b.worker + b.employer) - (a.worker + a.employer)),
  };
}

// Badges for the profile (Terrarium-style): earned from what you post and confirm.
export function badges(act) {
  const n = act.posts.length, c = act.confirmed.length, verified = act.posts.filter(isVerified).length;
  return [
    ['First signal', 'Posted a signal', n >= 1],
    ['Voice of the job', 'Posted 3 signals', n >= 3],
    ['Good neighbor', 'Confirmed 3 signals', c >= 3],
    ['Trusted', 'Had a signal verified', verified >= 1],
  ];
}

/* ---------- skills market index ---------- */
// Demand: employer signals naming a skill (used = 1, becoming more important = 2).
// Supply: verified worker signals naming the skill. Index = demand share ÷ supply share.
// Above SHORT means employers want it more than verified workers report it; below SURPLUS the reverse.
export const SHORT = 1.25, SURPLUS = 0.8, MIN_MENTIONS = 4;  // fewer mentions than this: too few signals to call
export function market(list) {
  const d = {}, s = {};
  for (const sig of list) {
    if (sig.side === 'employer') {
      for (const k of sig.skills) d[k.id] = (d[k.id] || 0) + 1;
      for (const g of sig.growing || []) d[g] = (d[g] || 0) + 2;
    } else if (isVerified(sig)) {
      for (const k of sig.skills) s[k.id] = (s[k.id] || 0) + 1;
    }
  }
  const dT = Object.values(d).reduce((a, b) => a + b, 0) || 1, sT = Object.values(s).reduce((a, b) => a + b, 0) || 1;
  const rows = [...new Set([...Object.keys(d), ...Object.keys(s)])].map((id) => {
    const ds = (d[id] || 0) / dT, ss = (s[id] || 0) / sT;
    const index = ss ? ds / ss : (ds ? Infinity : 0);
    return {id, demand: d[id] || 0, supply: s[id] || 0, ds, ss, index,
      flag: (d[id] || 0) + (s[id] || 0) < MIN_MENTIONS ? 'thin' : index >= SHORT ? 'shortage' : index <= SURPLUS ? 'surplus' : 'balanced'};
  }).filter((r) => r.demand + r.supply >= 2);
  rows.sort((a, b) => (a.flag === 'thin') - (b.flag === 'thin') || b.index - a.index || b.demand - a.demand);
  return {rows, employers: list.filter((x) => x.side === 'employer').length, verifiedWorkers: list.filter((x) => x.side === 'worker' && isVerified(x)).length};
}
