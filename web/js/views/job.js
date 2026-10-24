// One job, in plain words: the short answer, how much AI shows up in the work, what could change by 2031
// (live sliders), and a career plan. The numbers behind it sit in a fold-out. Lightcast panels render only
// when careerbridge.json is loaded (private builds).
import {h, fmt, announce, src} from '../util.js';
import {lineChart} from '../charts.js';
import {trendJobs, pathJobs, jobs2031, presetOf} from '../scenario.js';

export const POSTURE = {
  'Stay the course': ['calm', 'You’re in good shape', 'Claude isn’t used much on this kind of work. Keep learning, and check back now and then.'],
  'Upskill in place': ['mid', 'Get good with AI', 'Some of this work is where people use Claude. Learn to use it well and you’ll be ahead of the pack.'],
  'Stay and reposition': ['high', 'Shift your focus', 'A lot of this work is where Claude gets used, but these jobs have held steady. Spend more of your time on the parts that need a person.'],
  'Prepare to move': ['urgent', 'Start planning a move', 'A lot of this work is where Claude gets used, and there could be fewer of these jobs. Better to build skills for a nearby job now than to scramble later.'],
};
export const postureLabel = (p) => (POSTURE[p] ? POSTURE[p][1] : '—');

const GAP = 'High exposure, low adoption', HIHI = 'High exposure, high adoption', LOHI = 'Lower exposure, high adoption', LOLO = 'Lower exposure, low adoption';
const QTEXT = {
  [GAP]: 'A lot of this work overlaps with what AI can do, but few Massachusetts employers are asking for AI skills yet. Workers here may get little warning or support.',
  [HIHI]: 'A lot of this work overlaps with what AI can do, and employers already ask for AI skills. Building those skills is part of staying competitive.',
  [LOHI]: 'Less of this work overlaps with what AI can do, but employers still ask for AI skills, often for tools used alongside the main work.',
  [LOLO]: 'Less of this work overlaps with what AI can do today, and employers rarely ask for AI skills.',
};

const SOURCES = {'How much does AI show up in this work?': ['aei', 'onet', 'oews'], 'What could happen by 2031?': ['oewsh', 'aei', 'onet'], 'What you can do about it': ['onet', 'aei', 'oews'],
  'Job ads asking for AI skills': ['lc'], 'Is this job following software?': ['lc'], 'Job growth in Massachusetts': ['oewsh'],
  'What people use AI for in this job': ['aei', 'onet', 'lc'], 'Your human edge and what employers ask for': ['lc', 'onet']};
const panel = (title, sub, ...kids) => h('section', {class: 'panel'}, h('h3', {}, title), sub ? h('p', {class: 'sub'}, sub) : null, SOURCES[title] ? src(...SOURCES[title]) : null, ...kids);
const tags = (arr) => h('div', {class: 'tags'}, arr.map((s) => h('span', {class: 'tag'}, s)));
const bare = (s) => s.replace(/^(Knowledge|Work Activities|Abilities): /, '');
const fold = (summary, ...kids) => h('details', {class: 'more'}, h('summary', {}, summary), h('div', {class: 'morebody'}, ...kids));
const place = (ctx) => (ctx.state.geo === 'MA' ? 'in Massachusetts' : 'across the U.S.');

/* ------------------------------------------------------------------ header and the short answer */
function header(ctx, o) {
  const [cls, label, line] = POSTURE[o.posture] || ['mid', o.posture, ''];
  const trend = o.g >= 1 ? 'Growing' : o.g <= -1 ? 'Shrinking' : 'Holding steady';
  return h('header', {class: 'occhead'},
    h('span', {class: 'grp'}, o.group),
    h('h2', {id: 'occ-title', tabindex: '-1'}, o.title),
    h('div', {class: 'verdict ' + cls}, h('span', {class: 'v-label'}, label), h('p', {}, line),
      o.lc?.silent_gap ? h('p', {}, `Few employers here are asking for AI skills yet (under ${ctx.model.lcMeta?.silent_cut ?? 1}% of Massachusetts job ads), so you may not hear about changes early. Start asking around now.`) : null),
    h('dl', {class: 'facts'},
      fact('People doing this job', fmt.n(o.jobs), ctx.state.geo === 'MA' ? 'in Massachusetts, 2025' : 'in the U.S., 2025', false, 'oews'),
      fact('Typical pay', fmt.usd(o.wage), 'a year, before benefits', false, 'oews'),
      fact('Lately', trend, `${fmt.signed(o.g)} a year, 2019 to 2025`, false, 'oewsh'),
      fact('Usual training', o.prep ? o.prep.replace(/^./, (c) => c.toUpperCase()) : '—', o.edu ? `Most often: ${o.edu}` : '', true, 'onet')));
}
const fact = (k, v, n, text, s) => h('div', {class: 'fact' + (text ? ' text' : '')}, h('dt', {}, k), h('dd', {}, h('span', {class: 'fv'}, v), n ? h('small', {}, n) : null, s ? src(s) : null));

/** One ruler: where this job falls between the lowest and the highest of all jobs. */
function ruler(cls, shape, label, src, pct, value, explain) {
  const words = pct == null ? 'Not enough data' : pct < 5 ? 'Lower than almost every job' : pct > 95 ? 'Higher than almost every job' : `Higher than ${pct} of 100 jobs`;
  return h('li', {class: 'ruler'},
    h('div', {class: 'rl'}, h('span', {class: `mk ${cls} ${shape}`, 'aria-hidden': 'true'}), h('b', {}, label), src ? h('span', {class: 'src'}, src) : null),
    h('div', {class: 'rtrack', role: 'img', 'aria-label': `${label}: ${words}. ${value}`},
      pct == null ? null : h('span', {class: `mk dotm ${cls} ${shape}`, style: `left:${pct}%`})),
    h('div', {class: 'rends', 'aria-hidden': 'true'}, h('span', {}, 'Lowest of all jobs'), h('span', {}, 'Highest')),
    h('div', {class: 'rv'}, h('b', {}, words), h('small', {}, value)),
    explain ? h('p', {class: 'explain'}, explain) : null);
}

function standing(ctx, o) {
  const basis = {'usage+content': 'Based on what people ask Claude and what the job involves', 'content only (AEI withheld)': 'Based on what the job involves only, because usage numbers weren’t published (a rougher guess)', 'usage only': 'Based on what people ask Claude'}[o.basis];
  const reading = o.z >= 70 ? 'Claude gets used on this kind of work more than on most jobs.' : o.z >= 40 ? 'Claude gets used on this kind of work about as much as on a typical job.' : 'Claude gets used on this kind of work less than on most jobs.';
  return panel('How much does AI show up in this work?', 'We compared what people actually ask Claude, an AI assistant, to help with against the work this job involves.',
    h('ul', {class: 'rulers'}, ruler('use', 'circle', 'How much Claude is used', '', Math.round(o.z), basis)),
    h('p', {class: 'reading'}, reading),
    h('p', {class: 'foot'}, 'This shows where AI is being used. It doesn’t mean the job is going away. Often AI just helps with the work.'));
}

/** Where this job sits among the others in its group, by Claude use (1 = most). */
function groupRank(ctx, o) {
  const peers = ctx.model.occ.filter((p) => p.group === o.group).sort((a, b) => b.z - a.z);
  const i = peers.findIndex((p) => p.soc === o.soc) + 1;
  return peers.length < 2 ? '' : `Among ${peers.length} jobs in “${o.group}”, this one ranks ${fmt.ord(i)} for how much Claude is used.`;
}

/** Everything a curious person might want, folded away so the page stays calm. */
function details(ctx, o, plan) {
  const kids = [];
  if (o.lc) {
    const r = o.lc.ma_ai_2025;
    kids.push(h('div', {class: 'stack'}, h('h3', {}, 'Two more ways to look at it'),
      h('ul', {class: 'rulers'},
        ruler('cap', 'square', 'What AI could do in this job', 'Lightcast', o.capPct, `Score: ${o.lc.exposure.toFixed(1)}`),
        ruler('ads', 'diamond', 'Employers asking for AI skills', 'Lightcast', o.demandPct,
          r == null ? 'Too few Massachusetts job ads to measure' : `${fmt.pct(r)} of Massachusetts job ads, compared with ${ctx.model.lcMeta?.state_rate_2025 ?? 6.18}% across all jobs`)),
      QTEXT[o.lc.quadrant] ? h('p', {class: 'reading'}, QTEXT[o.lc.quadrant]) : null,
      o.lc.silent_gap ? h('p', {class: 'reading'}, `This is a “silent gap”: under ${ctx.model.lcMeta?.silent_cut ?? 1}% of Massachusetts job ads for this job asked for AI skills in 2025, so workers may get little warning.`) : null,
      o.capPct != null && Math.abs(o.capPct - o.z) >= 30
        ? h('p', {class: 'reading'}, o.capPct > o.z
          ? `These two don’t agree here. AI could do a lot of this work (higher than ${o.capPct} of 100 jobs), but Claude is used on it less (higher than ${Math.round(o.z)} of 100). Work can be a good fit for AI before people start using it that way.`
          : `These two don’t agree here. Claude is used on this work a lot (higher than ${Math.round(o.z)} of 100 jobs), even though AI could do less of it on paper (higher than ${o.capPct} of 100). People may be using it to help with parts of the job.`) : null));
  }
  const g = groupRank(ctx, o);
  if (g || plan?.why) kids.push(h('div', {class: 'stack'}, h('h3', {}, 'How we got here'), g ? h('p', {}, g) : null, plan?.why ? h('p', {}, 'Nationally, this job ' + plan.why.replace(/^Ranks/, 'ranks')) : null,
    h('p', {class: 'foot'}, `Job code ${o.soc}. The About page explains the numbers.`)));
  if (ctx.model.full && o.lc) kids.push(h('div', {class: 'stackp'}, lightcastPanels(ctx, o)));
  return fold('See the numbers behind this', ...kids);
}

/* ------------------------------------------------------------------ scenario */
function scenarioPanel(ctx, o) {
  const {model, state} = ctx;
  const sliders = {};
  const mk = (id, label, min, max, step, val) => {
    const out = h('output', {for: id});
    const input = h('input', {type: 'range', id, min, max, step, value: val});
    sliders[id] = {input, out};
    return h('div', {class: 'slider'}, h('label', {for: id}, label), h('div', {class: 'srow'}, input, out));
  };
  const aRow = mk('sc-a', 'How much of the work AI takes on by 2031', 5, 80, 5, Math.round(state.A * 100));
  const pRow = mk('sc-p', 'How much of that means fewer jobs (the rest just saves time)', 10, 100, 10, Math.round(state.P * 100));
  const presetBtns = Object.entries({slow: 'Slow', base: 'Medium', fast: 'Fast'}).map(([k, label]) =>
    h('button', {type: 'button', class: 'seg', 'data-k': k, onclick: () => { sliders['sc-a'].input.value = model.presets[k].A * 100; sliders['sc-p'].input.value = model.presets[k].P * 100; update(true); }}, label));
  const big = h('p', {class: 'bignum'});
  const stats = h('div', {class: 'sstats'});
  const chartBox = h('div');

  function update(commit) {
    const A = +sliders['sc-a'].input.value / 100, P = +sliders['sc-p'].input.value / 100;
    sliders['sc-a'].out.textContent = Math.round(A * 100) + '%';
    sliders['sc-p'].out.textContent = Math.round(P * 100) + '%';
    sliders['sc-a'].input.setAttribute('aria-valuetext', `${Math.round(A * 100)} percent`);
    sliders['sc-p'].input.setAttribute('aria-valuetext', `${Math.round(P * 100)} percent`);
    ctx.setScenario(A, P);
    const cur = presetOf(A, P, model.presets);
    presetBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === cur)));
    const trend = trendJobs(o, o.jobs), ai = jobs2031(o, o.jobs, A, P);
    big.replaceChildren('By 2031, there could be about ', h('b', {}, fmt.n(ai)), ` jobs like this ${place(ctx)}, compared with `, h('b', {}, fmt.n(o.jobs)), ' today.');
    stats.replaceChildren(
      stat('If recent trends continue', fmt.n(trend), fmt.signed((trend / o.jobs - 1) * 100, 0) + ' compared with today'),
      stat('With AI at this speed', fmt.n(ai), fmt.signed((ai / o.jobs - 1) * 100, 0) + ' compared with today'),
      stat('What AI changes', fmt.signedN(ai - trend), fmt.signed((ai / trend - 1) * 100) + ' of jobs'));
    const years = [0, 1, 2, 3, 4, 5, 6];
    const all = years.flatMap((y) => [trendJobs(o, o.jobs, y), pathJobs(o, o.jobs, A, P, y)]);
    const lo = Math.min(...all), hi = Math.max(...all), padv = (hi - lo || hi * 0.05) * 0.25;
    chartBox.replaceChildren(lineChart({
      series: [
        {name: 'If recent trends continue', color: 'var(--muted)', dash: '5 4', shape: 'circle', points: years.map((y) => [2025 + y, trendJobs(o, o.jobs, y)])},
        {name: 'With AI at this speed', color: 'var(--c-use)', shape: 'square', points: years.map((y) => [2025 + y, pathJobs(o, o.jobs, A, P, y)])},
      ],
      xTicks: years.filter((y) => y % 2 === 0).map((y) => [2025 + y, String(2025 + y)]), yMin: Math.max(0, lo - padv), yMax: hi + padv,
      yFmt: (v) => fmt.compact(v), endFmt: (v) => fmt.compact(v), right: 56,
      desc: `Jobs in ${o.title} from 2025 to 2031. If recent trends continue: ${fmt.n(trend)}. With AI at the chosen speed: ${fmt.n(ai)}.`,
    }));
    if (commit) announce(`2031 jobs: ${fmt.n(ai)} with AI, ${fmt.n(trend)} if recent trends continue.`);
  }
  for (const s of Object.values(sliders)) { s.input.addEventListener('input', () => update(false)); s.input.addEventListener('change', () => update(true)); }
  update(false);
  return panel('What could happen by 2031?', 'Nobody knows how fast AI will spread, so try a few speeds and see what changes.',
    h('div', {}, h('h4', {}, 'How fast does AI spread?'), h('div', {class: 'segs', role: 'group', 'aria-label': 'How fast AI spreads'}, presetBtns)),
    big, chartBox, stats,
    fold('Set your own numbers', h('div', {class: 'sliders'}, aRow, pRow)),
    h('p', {class: 'foot'}, 'This is a “what if,” not a prediction. It leaves out new jobs AI might create, changes in pay, and the economy. The About page has the math.'));
}
const stat = (k, v, n) => h('div', {class: 'stat'}, h('span', {class: 'k'}, k), h('span', {class: 'v'}, v), h('span', {class: 'n'}, n));

/* ------------------------------------------------------------------ career plan */
function moveCard(ctx, o, t, extra, meta) {
  const dz = t.z - o.z;
  const wd = t.wage != null && o.wage != null ? t.wage - o.wage : null;
  return h('li', {class: 'move'},
    h('a', {class: 't', href: ctx.hrefJob(t.soc), 'aria-label': `Open ${t.title}`}, t.title),
    h('div', {class: 'row'},
      h('span', {}, 'Typical pay ', h('b', {class: wd > 0 ? 'up' : ''}, fmt.usd(t.wage)), wd != null ? ` (${fmt.usdDiff(wd)})` : ''),
      h('span', {}, h('b', {}, fmt.n(t.jobs)), ' people do it'),
      meta,
      h('span', {}, dz <= -1 ? 'Claude is used less on this work' : 'Claude is used about as much on this work')),
    extra);
}

function movesPanel(ctx, o, plan) {
  const {model} = ctx;
  const paths = model.cb?.paths?.[o.soc] || [];
  let mode = 'less';
  const list = h('ul', {class: 'moves'});
  const note = h('p', {class: 'sub'});
  const draw = () => {
    list.replaceChildren();
    if (mode === 'less') {
      const mv = (plan.moves || []).map((m) => ({m, t: model.bySoc.get(m.soc)})).filter((x) => x.t && x.t.jobs != null);
      note.textContent = o.tier === 'Low' ? 'Claude is already used little in this work, so we’re not suggesting a move.'
        : !mv.length ? 'We didn’t find a close match with less AI use, so the plan is to stay where you are and grow in this job.'
        : mv.some((x) => x.m.loose) ? 'We couldn’t find a close match, so these are rougher guesses. Treat them as ideas to look into.'
        : 'These use skills a lot like yours, have less AI use, are still growing, and pay at least about 90% as much.';
      for (const {m, t} of mv) {
        list.append(moveCard(ctx, o, t,
          h('div', {class: 'row'}, m.skills.length ? h('span', {}, 'Skills to build: ', tags(m.skills.map(bare))) : null,
            h('span', {}, t.prep ? `Usual training: ${t.prep}.` : ''), m.loose ? h('span', {class: 'loose'}, 'Rougher match') : null),
          h('span', {}, 'Skills in common ', h('b', {}, Math.round(m.sim * 100) + '%'))));
      }
    } else {
      note.textContent = `Jobs with skills close to ${o.title.toLowerCase()} that pay at least as much in Massachusetts, where more employers ask for AI skills.`;
      const rows = paths.map((p) => ({p, t: model.bySoc.get(p[0])})).filter((x) => x.t && x.t.lc).slice(0, 5);
      if (!rows.length) list.append(h('li', {class: 'empty'}, 'No close match pays at least as much and has more employers asking for AI skills.'));
      for (const {p, t} of rows) {
        list.append(h('li', {class: 'move'},
          h('a', {class: 't', href: ctx.hrefJob(t.soc), 'aria-label': `Open ${t.title}`}, t.title),
          h('div', {class: 'row'}, h('span', {}, 'Skills in common ', h('b', {}, Math.round(p[1] * 100) + '%')),
            h('span', {}, 'Typical pay ', h('b', {class: p[2] > 0 ? 'up' : ''}, fmt.usd(t.lc.ma_median_wage)), ` (${fmt.usdDiff(p[2])})`),
            h('span', {}, 'Job ads asking for AI: ', h('b', {}, fmt.pct(t.lc.ma_ai_2025))), h('span', {}, h('b', {}, fmt.n(t.lc.ma_employment)), ' people in MA')),
          h('div', {class: 'row'}, h('span', {}, 'Skills to build: ', tags(String(p[3] || '').split(',').map((s) => s.trim()).filter(Boolean))))));
      }
    }
  };
  const toggle = !paths.length ? null : h('div', {class: 'segs', role: 'group', 'aria-label': 'What kind of move'},
    [['less', 'Where AI is used less'], ['ads', 'Where employers want AI skills']].map(([k, label]) =>
      h('button', {type: 'button', class: 'seg', 'aria-pressed': String(k === mode), onclick: (e) => {
        mode = k; e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); draw();
      }}, label)));
  draw();
  return h('div', {class: 'block'}, h('h3', {}, 'Other jobs worth a look'), toggle, note, list,
    h('p', {class: 'foot'}, 'These are ideas to talk through with a career advisor. Things like licenses and what’s hiring near you aren’t in the data.'));
}

function planText(ctx, o, plan) {
  const mv = (plan.moves || []).map((m) => ctx.model.bySoc.get(m.soc)).filter(Boolean).slice(0, 3).map((t) => t.title);
  return [`Career plan: ${o.title}`, `Suggested approach: ${postureLabel(o.posture)}. ${(POSTURE[o.posture] || [])[2] || ''}`, '',
    `Do more of: ${plan.lean.join('; ') || 'n/a'}`, `Let Claude speed up: ${plan.use.join('; ') || 'n/a'}`, mv.length ? `Other jobs worth a look: ${mv.join('; ')}` : '', '',
    ...plan.timeline.map((s) => `${s.when}: ${s.text}`), '', 'Source: Career Bridge. This shows where Claude is used today, not a prediction that jobs will disappear.'].filter((l, i, a) => l || a[i - 1]).join('\n');
}

function planPanel(ctx, o) {
  const plan = ctx.model.plans[o.soc];
  if (!plan) return panel('What you can do about it', null, h('p', {class: 'empty'}, 'We don’t have a plan for this job yet.'));
  const copyBtn = h('button', {type: 'button', class: 'btn', onclick: async () => {
    const text = planText(ctx, o, plan);
    try { await navigator.clipboard.writeText(text); announce('Plan copied.'); copyBtn.textContent = 'Copied'; }
    catch (e) { const ta = h('textarea', {class: 'sr', 'aria-hidden': 'true'}); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); announce('Plan copied.'); copyBtn.textContent = 'Copied'; }
    setTimeout(() => { copyBtn.textContent = 'Copy this plan'; }, 2000);
  }}, 'Copy this plan');
  const acts = (title, note, items, empty) => h('div', {class: 'twocol'}, h('h4', {}, title), h('p', {class: 'foot'}, note),
    items.length ? h('ul', {class: 'alist'}, items.map((a) => h('li', {}, a))) : h('p', {class: 'empty'}, empty));
  return panel('What you can do about it', 'A place to start, not personal advice.',
    h('div', {class: 'two'},
      acts('Do more of this', 'Your job leans on these more than most, and Claude is used on them less. A good place to build a track record.', plan.lean, 'We don’t have enough information on this job.'),
      acts('Let Claude speed these up', 'Your job leans on these a lot, and Claude is used heavily on them. Get quick at it, and you’ll have more time for the list on the left.', plan.use, 'We don’t have enough information on this job.')),
    movesPanel(ctx, o, plan),
    h('div', {class: 'block'}, h('h3', {}, 'Your next 12 months'),
      h('ol', {class: 'tl'}, plan.timeline.map((s) => h('li', {}, h('b', {}, s.when), h('span', {}, s.text)))),
      h('p', {class: 'foot'}, 'These steps are a template filled in with this job’s details.')),
    h('div', {class: 'actions'}, copyBtn));
}

/* ------------------------------------------------------------------ Lightcast panels (private build) */
const SOFT = 'software_genai_us';
const yrsTxt = (yb) => { const t = 2026 - yb, f = t - Math.floor(t); return (f < 0.34 ? 'early ' : f < 0.67 ? 'mid-' : 'late ') + Math.floor(t); };
function softwareSentence(lc) {
  const st = lc.software_path_status, yb = lc.years_behind_software;
  if (st === 'level') return 'Level with software: employers here ask for generative-AI skills at least as often as software employers do now.';
  if (st === 'behind' && yb === 0) return 'Close to level with software: employers here ask for generative-AI skills almost as often as software employers do now.';
  if (st === 'behind' && yb != null) return `Employers here ask for generative-AI skills about as often as software employers did in ${yrsTxt(yb)}.`;
  if (st === 'not_started') return 'Not started: fewer job ads here ask for generative-AI skills than software’s did in 2023.';
  return 'Too few job ads to tell.';
}

function lightcastPanels(ctx, o) {
  const {cb} = ctx.model, lc = o.lc, soc = o.soc, out = [];
  const pctTick = (v) => v.toFixed(v < 10 ? 1 : 0) + '%';
  const yearTicks = (rows) => rows.map((r) => [r[0], r[0] === 2026 ? '2026*' : String(r[0])]);
  const trend = (cb.trend?.[soc] || []).filter((r) => r[1] != null || r[2] != null);
  if (trend.length > 1) out.push(panel('Job ads asking for AI skills', 'How many job ads mention at least one AI skill, by year. *January to September.',
    lineChart({series: [
      {name: 'Massachusetts', color: 'var(--c-ads)', shape: 'diamond', points: trend.map((r) => [r[0], r[1]])},
      {name: 'United States', color: 'var(--muted)', dash: '5 4', shape: 'circle', points: trend.map((r) => [r[0], r[2]])}],
      xTicks: yearTicks(trend), yFmt: pctTick, endFmt: pctTick,
      desc: 'Share of job ads asking for AI skills by year: ' + trend.map((r) => `${r[0]} MA ${r[1] ?? 'n/a'}%, US ${r[2] ?? 'n/a'}%`).join('; ')})));
  const soft = cb.meta?.[SOFT] || [], job = (cb.genai?.[soc] || []).map((r) => [r[0], r[2]]);
  if (soft.length > 1) {
    const j26 = job.find((r) => r[0] === 2026);
    out.push(panel('Is this job following software?', 'Software changed first. This shows how often job ads ask for generative-AI skills.',
      lineChart({series: [
        {name: 'This job', color: 'var(--c-ads)', shape: 'diamond', points: job},
        {name: 'Software developers', color: 'var(--muted)', dash: '5 4', shape: 'circle', points: soft}],
        xTicks: soft.map((r) => [r[0], r[0] === 2026 ? '2026*' : String(r[0])]), yFmt: pctTick, endFmt: pctTick,
        guide: lc.software_path_status === 'behind' && lc.years_behind_software != null && j26 && j26[1] != null ? {x1: 2026 - lc.years_behind_software, x2: 2026, y: j26[1]} : null,
        desc: 'US job ads asking for generative-AI skills. Software developers: ' + soft.map((r) => `${r[0]} ${r[1]}%`).join(', ') + '. This job: ' + job.map((r) => `${r[0]} ${r[1] ?? 'n/a'}%`).join(', ')}),
      h('p', {}, softwareSentence(lc)),
      h('p', {class: 'foot'}, 'A position on software’s path, not a timeline. Employer demand in job ads, not a forecast of jobs.')));
  }
  const gm = cb.meta?.ma_growth, series = cb.growth?.[soc] || [];
  if (gm?.all_jobs?.length && series.length > 1) {
    const base = series[0][1], allBy = Object.fromEntries(gm.all_jobs), allBase = allBy[series[0][0]];
    const jobIdx = series.map(([y, e]) => [y, 100 * e / base]);
    const allIdx = gm.all_jobs.filter(([y]) => y >= series[0][0]).map(([y, e]) => [y, 100 * e / allBase]);
    const vals = jobIdx.concat(allIdx).map((r) => r[1]);
    const g = lc.ma_growth_pct, since = lc.ma_growth_since;
    out.push(panel('Job growth in Massachusetts', 'People employed in this job, indexed to 100 in ' + series[0][0] + ' (BLS OEWS).',
      lineChart({series: [
        {name: 'This job', color: 'var(--c-ads)', shape: 'diamond', points: jobIdx}, {name: 'All MA jobs', color: 'var(--muted)', dash: '5 4', shape: 'circle', points: allIdx}],
        xTicks: series.map((r) => [r[0], String(r[0])]), yMin: Math.min(...vals) * 0.97, yMax: Math.max(...vals) * 1.03, yTicks: [100],
        yFmt: () => String(series[0][0]), endFmt: (v) => fmt.signed(v - 100, 0),
        desc: 'Employment in this job: ' + series.map((r) => `${r[0]}: ${fmt.n(r[1])}`).join(', ')}),
      h('p', {}, g == null ? 'Not enough Massachusetts data across these years to compare.'
        : `Jobs here ${g >= 0 ? 'grew ' + g.toFixed(0) : 'shrank ' + Math.abs(g).toFixed(0)}% since ${since}, ${({faster: 'faster than', slower: 'slower than'})[lc.ma_growth_status] || 'about the same as'} Massachusetts jobs overall (${fmt.signed(gm.all_growth_pct, 0)}).`),
      h('p', {class: 'foot'}, 'What happened, not why: the pandemic, interest rates and tech layoffs overlap these years. Not a forecast. Excludes self-employed.')));
  }
  const tasks = (cb.tasks?.[soc] || []).filter((t) => t[1] > 0), skills = cb.skills?.[soc] || [], strengths = cb.strengths?.[soc] || [];
  const max = Math.max(...tasks.map((t) => t[1]), 0.0001);
  out.push(panel('What people use AI for in this job', 'The parts of this job that come up most when people talk to Claude. US, April and May 2026.',
    tasks.length ? h('ul', {class: 'list'}, tasks.map((t) => h('li', {}, h('span', {}, t[0]), h('span', {class: 'bar', style: `width:${Math.max(3, 100 * t[1] / max)}%`}), h('span', {class: 'meta'}, `${t[1].toFixed(2)}% of conversations`))))
      : h('p', {class: 'empty'}, 'Too few conversations map to this job’s tasks to show. That can mean little AI use, or a job the data does not capture well.'),
    h('h4', {}, 'AI skills employers name in job ads'),
    skills.some((s) => s[4]) ? h('div', {class: 'tags'}, skills.filter((s) => s[4]).map((s) => h('span', {class: 'tag aiTag'}, s[1], h('em', {}, s[2] + '%')))) : h('p', {class: 'empty'}, 'None of the most-requested skills in this job’s ads are AI skills.')));
  out.push(panel('Your human edge and what employers ask for', 'What this job rates highest on, and what employers ask for in job ads (2025).',
    h('div', {class: 'two'},
      h('div', {}, h('h4', {}, 'Your strengths'), strengths.length ? h('ul', {class: 'list'}, strengths.map((s) => h('li', {}, h('span', {}, h('b', {}, s[0]), ` · importance ${s[1].toFixed(1)} of 5`), h('span', {class: 'meta'}, `+${s[2].toFixed(2)} above the average MA job`)))) : h('p', {class: 'empty'}, 'No O*NET skill ratings for this job.')),
      h('div', {class: 'stack'}, [['S', 'Core skills in ads'], ['C', 'Everyday skills in ads'], ['R', 'Certifications']].map(([k, label]) => {
        const arr = skills.filter((s) => s[0] === k);
        return h('div', {}, h('h4', {}, label), arr.length ? h('div', {class: 'tags'}, arr.map((s) => h('span', {class: 'tag' + (s[4] ? ' aiTag' : '')}, s[1], h('em', {}, s[2] + '%')))) : h('p', {class: 'empty'}, 'Not listed'));
      })))));
  return out;
}

/* ------------------------------------------------------------------ entry */
export function renderJob(root, ctx, o) {
  const plan = ctx.model.plans[o.soc];
  root.replaceChildren(h('div', {class: 'jobview'},
    header(ctx, o), standing(ctx, o), scenarioPanel(ctx, o), planPanel(ctx, o), details(ctx, o, plan)));
}
