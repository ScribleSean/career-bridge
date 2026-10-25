// One job: Lightcast standing and panels first (private builds, when careerbridge.json is loaded), then Claude use,
// the career plan, and the 2031 what-if. Design rule: no subtitles, footnotes or helper text; titles, scales and
// source tags carry the meaning, and explanations live on the About page.
import {h, fmt, announce, src, experimental} from '../util.js';
import {lineChart, barList} from '../charts.js';
import {trendJobs, pathJobs, jobs2031, presetOf} from '../scenario.js';
import {jobSignals} from './signals.js';

export const POSTURE = {
  'Stay the course': ['calm', 'Keep building', 'Claude isn’t used much on this kind of work today. Keep learning, and check back now and then.'],
  'Upskill in place': ['mid', 'Get good with AI', 'Some of this work is where people use Claude. Learn to use it well and you’ll be ahead of the pack.'],
  'Stay and reposition': ['high', 'Shift your focus', 'A lot of this work is where Claude gets used, but these jobs have held steady. Spend more of your time on the parts that need a person.'],
  'Prepare to move': ['urgent', 'Explore nearby jobs', 'A lot of this work is where Claude gets used, and the 2031 what-if shows fewer of these jobs. Building skills for a nearby job now keeps your options open.'],
};
export const postureLabel = (p) => (POSTURE[p] ? POSTURE[p][1] : '—');

const GAP = 'High exposure, low adoption', HIHI = 'High exposure, high adoption', LOHI = 'Lower exposure, high adoption', LOLO = 'Lower exposure, low adoption';

const SOURCES = {'What people in this job report': ['sig'], 'Where this job stands with AI': ['lc'], 'How much people use Claude on this work': ['aei', 'onet'], 'What if: jobs in 2031': ['oewsh', 'aei', 'onet'], 'What you can do about it': ['onet', 'aei', 'oews'],
  'Job ads asking for AI skills': ['lc'], 'Is this job following software?': ['lc'], 'Job growth in Massachusetts': ['oewsh'],
  'What people use AI for in this job': ['aei', 'onet', 'lc'], 'Your human edge and what employers ask for': ['lc', 'onet']};
// No subtitles or footnotes: a panel is its title, its source tags, and its content. Explanations live on the About page.
const panel = (title, ...kids) => h('section', {class: 'panel'}, h('h3', {}, title), SOURCES[title] ? src(...SOURCES[title]) : null, ...kids);
const QSHORT = {[GAP]: 'Broad gap', [HIHI]: 'Employers ask', [LOHI]: 'Lower overlap, higher signal', [LOLO]: 'Lower overlap, low signal'};  // the deck's group names
const tags = (arr) => h('div', {class: 'tags'}, arr.map((s) => h('span', {class: 'tag'}, s)));
const bare = (s) => s.replace(/^(Knowledge|Work Activities|Abilities): /, '');
const fold = (summary, ...kids) => h('details', {class: 'more'}, h('summary', {}, summary), h('div', {class: 'morebody'}, ...kids));

/* ------------------------------------------------------------------ header and the short answer */
function header(ctx, o) {
  const [cls, label] = POSTURE[o.posture] || ['mid', o.posture];
  const geo = ctx.state.geo === 'MA' ? 'MA' : 'US';
  // Lightcast verdict first (private build), then the plan's suggestion. Short pills, no sentences.
  const pills = [
    o.lc?.silent_gap ? h('span', {class: 'pill gap'}, 'Silent gap') : null,
    o.lc && !o.lc.silent_gap && QSHORT[o.lc.quadrant] ? h('span', {class: 'pill ' + (o.lc.quadrant === GAP ? 'gap' : 'neutral')}, QSHORT[o.lc.quadrant]) : null,
    h('span', {class: 'pill ' + cls}, label)];
  return h('header', {class: 'occhead'},
    h('span', {class: 'grp'}, o.group),
    h('h2', {id: 'occ-title', tabindex: '-1'}, o.title),
    h('div', {class: 'pills'}, pills),
    h('dl', {class: 'facts'},
      fact(`${geo} workers, 2025`, fmt.n(o.jobs), 'oews'),
      fact('Median pay', fmt.usd(o.wage), 'oews'),
      fact('Change a year, 2019–25', fmt.signed(o.g), 'oewsh'),
      fact('Training', o.prep ? o.prep.replace(/^./, (c) => c.toUpperCase()) : '—', 'onet', true)));
}
const fact = (k, v, s, text) => h('div', {class: 'fact' + (text ? ' text' : '')}, h('dt', {}, k), h('dd', {}, h('span', {class: 'fv'}, v), src(s)));

/** One ruler. The track ranks every job from lowest (left) to highest (right).
 *  ticks: [[position 0-100, label]] printed under the track; ref: {pos, label} marks a reference value above it. */
function ruler(cls, shape, label, pct, value, ticks, ref) {
  const rank = pct == null ? 'Not enough data' : `Top ${Math.max(1, 100 - pct)}%`;
  const at = (pos) => ({style: `left:${pos}%`});
  return h('li', {class: 'ruler'},
    h('div', {class: 'rl'}, h('span', {class: `mk ${cls} ${shape}`, 'aria-hidden': 'true'}), h('b', {}, label)),
    ref ? h('div', {class: 'rref', 'aria-hidden': 'true'}, h('span', at(ref.pos), ref.label)) : null,
    h('div', {class: 'rtrack', role: 'img', 'aria-label': `${label}: ${rank} of jobs. ${value}`},
      ticks.map(([pos]) => h('i', {class: 'rtick', ...at(pos)})),
      ref ? h('i', {class: 'rtick ref', ...at(ref.pos)}) : null,
      pct == null ? null : h('span', {class: `mk dotm ${cls} ${shape}`, ...at(pct)})),
    h('div', {class: 'rticks', 'aria-hidden': 'true'}, ticks.map(([pos, t]) => h('span', at(pos), t))),
    h('div', {class: 'rv'}, h('b', {}, value), h('small', {}, rank)));
}
const WORD = {0: 'lowest', 50: 'median', 100: 'highest'};
const named = (anchors, f) => anchors.map(([pos, v]) => [pos, `${f(v)} · ${WORD[pos]}`]);

function standing(ctx, o) {
  return panel('How much people use Claude on this work',
    h('ul', {class: 'rulers'}, ruler('use', 'circle', 'Claude use', Math.round(o.z), o.basis === 'content only (AEI withheld)' ? 'Estimated from tasks' : `${Math.round(o.z)} of 100`,
      [[0, '0'], [50, '50'], [100, '100']])));
}

/** Lightcast first: AI overlap and employer demand (private build only). The header pills carry the verdict. */
function lightcastStanding(ctx, o) {
  const m = ctx.model, r = o.lc.ma_ai_2025, state = m.lcMeta?.state_rate_2025 ?? 6.18;
  const adsFmt = (v) => `${v < 10 ? v.toFixed(1) : v.toFixed(0)}%`;
  return panel('Where this job stands with AI',
    h('ul', {class: 'rulers'},
      ruler('cap', 'square', 'AI overlap', o.capPct, `${o.lc.exposure.toFixed(1)} of 100`, named(m.capAnchors, (v) => v.toFixed(0))),
      ruler('ads', 'diamond', 'MA job ads asking for AI', o.demandPct, r == null ? 'Too few ads' : `${fmt.pct(r)} of ads`,
        named(m.demandAnchors, adsFmt), {pos: m.demandRank(state), label: `State ${state}%`})));
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
  const aRow = mk('sc-a', 'Work AI takes on by 2031', 5, 80, 5, Math.round(state.A * 100));
  const pRow = mk('sc-p', 'Share of that which means fewer jobs', 10, 100, 10, Math.round(state.P * 100));
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
    big.replaceChildren(h('b', {}, fmt.n(ai)), ` in 2031 · ${fmt.n(o.jobs)} today`);
    stats.replaceChildren(
      stat('Recent trend', fmt.n(trend), fmt.signed((trend / o.jobs - 1) * 100, 0)),
      stat('AI what-if', fmt.n(ai), fmt.signed((ai / o.jobs - 1) * 100, 0)),
      stat('Difference', fmt.signedN(ai - trend), fmt.signed((ai / trend - 1) * 100)));
    const years = [0, 1, 2, 3, 4, 5, 6];
    const all = years.flatMap((y) => [trendJobs(o, o.jobs, y), pathJobs(o, o.jobs, A, P, y)]);
    const lo = Math.min(...all), hi = Math.max(...all), padv = (hi - lo || hi * 0.05) * 0.25;
    chartBox.replaceChildren(lineChart({
      series: [
        {name: 'Recent trend', color: 'var(--muted)', dash: '5 4', shape: 'circle', points: years.map((y) => [2025 + y, trendJobs(o, o.jobs, y)])},
        {name: 'AI what-if', color: 'var(--c-use)', shape: 'square', points: years.map((y) => [2025 + y, pathJobs(o, o.jobs, A, P, y)])},
      ],
      xTicks: years.filter((y) => y % 2 === 0).map((y) => [2025 + y, String(2025 + y)]), yMin: Math.max(0, lo - padv), yMax: hi + padv,
      yFmt: (v) => fmt.compact(v), endFmt: (v) => fmt.compact(v), right: 56,
      desc: `Jobs in ${o.title} from 2025 to 2031. If recent trends continue: ${fmt.n(trend)}. AI what-if at the chosen speed: ${fmt.n(ai)}.`,
    }));
    if (commit) announce(`2031 jobs: ${fmt.n(ai)} in the AI what-if, ${fmt.n(trend)} if recent trends continue.`);
  }
  for (const s of Object.values(sliders)) { s.input.addEventListener('input', () => update(false)); s.input.addEventListener('change', () => update(true)); }
  update(false);
  return panel('What if: jobs in 2031', experimental(),
    h('div', {class: 'segs', role: 'group', 'aria-label': 'How fast AI spreads'}, presetBtns),
    big, chartBox, stats,
    fold('Set your own numbers', h('div', {class: 'sliders'}, aRow, pRow)));
}
const stat = (k, v, n) => h('div', {class: 'stat'}, h('span', {class: 'k'}, k), h('span', {class: 'v'}, v), h('span', {class: 'n'}, n));

/* ------------------------------------------------------------------ career plan */
function moveCard(ctx, o, t, extra, meta) {
  const dz = t.z - o.z;
  const wd = t.wage != null && o.wage != null ? t.wage - o.wage : null;
  return h('li', {class: 'move'},
    h('a', {class: 't', href: ctx.hrefJob(t.soc), 'aria-label': `Open ${t.title}`}, t.title),
    h('div', {class: 'row'},
      h('span', {}, 'Median pay ', h('b', {class: wd > 0 ? 'up' : ''}, fmt.usd(t.wage)), wd != null ? ` (${fmt.usdDiff(wd)})` : ''),
      h('span', {}, h('b', {}, fmt.n(t.jobs)), ' workers'),
      meta,
      h('span', {}, 'Claude use ', h('b', {}, dz <= -1 ? 'lower' : 'similar'))),
    extra);
}

function movesPanel(ctx, o, plan) {
  const {model} = ctx;
  const paths = model.cb?.paths?.[o.soc] || [];
  let mode = 'less';
  const list = h('ul', {class: 'moves'});
  const note = h('p', {class: 'empty'});
  const draw = () => {
    list.replaceChildren();
    if (mode === 'less') {
      const mv = (plan.moves || []).map((m) => ({m, t: model.bySoc.get(m.soc)})).filter((x) => x.t && x.t.jobs != null);
      note.textContent = o.tier === 'Low' ? 'No move needed' : !mv.length ? 'No close match' : '';
      note.hidden = !note.textContent;
      for (const {m, t} of mv) {
        list.append(moveCard(ctx, o, t,
          h('div', {class: 'row'}, m.skills.length ? h('span', {}, 'Skills to build: ', tags(m.skills.map(bare))) : null,
            m.loose ? h('span', {class: 'loose'}, 'Rougher match') : null),
          h('span', {}, 'Skills in common ', h('b', {}, Math.round(m.sim * 100) + '%'))));
      }
    } else {
      note.hidden = true;
      const rows = paths.map((p) => ({p, t: model.bySoc.get(p[0])})).filter((x) => x.t && x.t.lc).slice(0, 5);
      if (!rows.length) list.append(h('li', {class: 'empty'}, 'No close match'));
      for (const {p, t} of rows) {
        list.append(h('li', {class: 'move'},
          h('a', {class: 't', href: ctx.hrefJob(t.soc), 'aria-label': `Open ${t.title}`}, t.title),
          h('div', {class: 'row'}, h('span', {}, 'Skills in common ', h('b', {}, Math.round(p[1] * 100) + '%')),
            h('span', {}, 'Median pay ', h('b', {class: p[2] > 0 ? 'up' : ''}, fmt.usd(t.lc.ma_median_wage)), ` (${fmt.usdDiff(p[2])})`),
            h('span', {}, 'MA ads asking for AI ', h('b', {}, fmt.pct(t.lc.ma_ai_2025))), h('span', {}, h('b', {}, fmt.n(t.lc.ma_employment)), ' MA workers')),
          h('div', {class: 'row'}, h('span', {}, 'Skills to build: ', tags(String(p[3] || '').split(',').map((s) => s.trim()).filter(Boolean))))));
      }
    }
  };
  const toggle = !paths.length ? null : h('div', {class: 'segs', role: 'group', 'aria-label': 'What kind of move'},
    [['less', 'Less Claude use'], ['ads', 'Employers want AI skills']].map(([k, label]) =>
      h('button', {type: 'button', class: 'seg', 'aria-pressed': String(k === mode), onclick: (e) => {
        mode = k; e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); draw();
      }}, label)));
  draw();
  return h('div', {class: 'block'}, h('h3', {}, 'Next moves'), toggle, note, list);
}

function planText(ctx, o, plan) {
  const mv = (plan.moves || []).map((m) => ctx.model.bySoc.get(m.soc)).filter(Boolean).slice(0, 3).map((t) => t.title);
  return [`Career plan: ${o.title}`, `Suggested approach: ${postureLabel(o.posture)}. ${(POSTURE[o.posture] || [])[2] || ''}`, '',
    `Do more of: ${plan.lean.join('; ') || 'n/a'}`, `Let Claude speed up: ${plan.use.join('; ') || 'n/a'}`, mv.length ? `Other jobs worth a look: ${mv.join('; ')}` : '', '',
    ...plan.timeline.map((s) => `${s.when}: ${s.text}`), '', 'Source: Career Bridge. This shows where Claude is used today, not a prediction that jobs will disappear.'].filter((l, i, a) => l || a[i - 1]).join('\n');
}

function planPanel(ctx, o) {
  const plan = ctx.model.plans[o.soc];
  if (!plan) return panel('What you can do about it', h('p', {class: 'empty'}, 'No plan for this job yet'));
  const copyBtn = h('button', {type: 'button', class: 'btn', onclick: async () => {
    const text = planText(ctx, o, plan);
    try { await navigator.clipboard.writeText(text); announce('Plan copied.'); copyBtn.textContent = 'Copied'; }
    catch (e) { const ta = h('textarea', {class: 'sr', 'aria-hidden': 'true'}); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); announce('Plan copied.'); copyBtn.textContent = 'Copied'; }
    setTimeout(() => { copyBtn.textContent = 'Copy this plan'; }, 2000);
  }}, 'Copy this plan');
  const acts = (title, items) => h('div', {class: 'twocol'}, h('h4', {}, title),
    items.length ? h('ul', {class: 'alist'}, items.map((a) => h('li', {}, a))) : h('p', {class: 'empty'}, 'Not enough data'));
  return panel('What you can do about it',
    h('div', {class: 'two'}, acts('Do more of this', plan.lean), acts('Let Claude speed these up', plan.use)),
    movesPanel(ctx, o, plan),
    h('div', {class: 'block'}, h('h3', {}, 'Your next 12 months'),
      h('ol', {class: 'tl'}, plan.timeline.map((s) => h('li', {}, h('b', {}, s.when), h('span', {}, s.text))))),
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
  if (trend.length > 1) out.push(panel('Job ads asking for AI skills',
    lineChart({series: [
      {name: 'Massachusetts', color: 'var(--c-ads)', shape: 'diamond', points: trend.map((r) => [r[0], r[1]])},
      {name: 'United States', color: 'var(--muted)', dash: '5 4', shape: 'circle', points: trend.map((r) => [r[0], r[2]])}],
      xTicks: yearTicks(trend), yFmt: pctTick, endFmt: pctTick,
      desc: 'Share of job ads asking for AI skills by year: ' + trend.map((r) => `${r[0]} MA ${r[1] ?? 'n/a'}%, US ${r[2] ?? 'n/a'}%`).join('; ')})));
  const soft = cb.meta?.[SOFT] || [], job = (cb.genai?.[soc] || []).map((r) => [r[0], r[2]]);
  if (soft.length > 1) {
    const j26 = job.find((r) => r[0] === 2026);
    out.push(panel('Is this job following software?',
      lineChart({series: [
        {name: 'This job', color: 'var(--c-ads)', shape: 'diamond', points: job},
        {name: 'Software developers', color: 'var(--muted)', dash: '5 4', shape: 'circle', points: soft}],
        xTicks: soft.map((r) => [r[0], r[0] === 2026 ? '2026*' : String(r[0])]), yFmt: pctTick, endFmt: pctTick,
        guide: lc.software_path_status === 'behind' && lc.years_behind_software != null && j26 && j26[1] != null ? {x1: 2026 - lc.years_behind_software, x2: 2026, y: j26[1]} : null,
        desc: 'US job ads asking for generative-AI skills. Software developers: ' + soft.map((r) => `${r[0]} ${r[1]}%`).join(', ') + '. This job: ' + job.map((r) => `${r[0]} ${r[1] ?? 'n/a'}%`).join(', ')}),
      h('p', {class: 'result'}, softwareSentence(lc))));
  }
  const gm = cb.meta?.ma_growth, series = cb.growth?.[soc] || [];
  if (gm?.all_jobs?.length && series.length > 1) {
    const base = series[0][1], allBy = Object.fromEntries(gm.all_jobs), allBase = allBy[series[0][0]];
    const jobIdx = series.map(([y, e]) => [y, 100 * e / base]);
    const allIdx = gm.all_jobs.filter(([y]) => y >= series[0][0]).map(([y, e]) => [y, 100 * e / allBase]);
    const vals = jobIdx.concat(allIdx).map((r) => r[1]);
    const g = lc.ma_growth_pct, since = lc.ma_growth_since;
    out.push(panel('Job growth in Massachusetts',
      lineChart({series: [
        {name: 'This job', color: 'var(--c-ads)', shape: 'diamond', points: jobIdx}, {name: 'All MA jobs', color: 'var(--muted)', dash: '5 4', shape: 'circle', points: allIdx}],
        xTicks: series.map((r) => [r[0], String(r[0])]), yMin: Math.min(...vals) * 0.97, yMax: Math.max(...vals) * 1.03, yTicks: [100],
        yFmt: () => String(series[0][0]), endFmt: (v) => fmt.signed(v - 100, 0),
        desc: 'Employment in this job: ' + series.map((r) => `${r[0]}: ${fmt.n(r[1])}`).join(', ')}),
      g == null ? null : h('p', {class: 'result'}, `${fmt.signed(g, 0)} since ${since} · all MA jobs ${fmt.signed(gm.all_growth_pct, 0)}`)));
  }
  const tasks = (cb.tasks?.[soc] || []).filter((t) => t[1] > 0), skills = cb.skills?.[soc] || [], strengths = cb.strengths?.[soc] || [];
  out.push(panel('What people use AI for in this job',
    tasks.length ? barList(tasks.map((t) => ({label: t[0], value: t[1]})), {fmt: (v) => (v === 0 ? '0' : v.toFixed(v < 0.1 ? 2 : 1)) + '%', unit: 'of US Claude conversations, Apr–May 2026'})
      : h('p', {class: 'empty'}, 'Too few conversations to show'),
    h('h4', {}, 'AI skills in job ads (% of ads)'),
    skills.some((s) => s[4]) ? h('div', {class: 'tags'}, skills.filter((s) => s[4]).map((s) => h('span', {class: 'tag aiTag'}, s[1], h('em', {}, s[2] + '%')))) : h('p', {class: 'empty'}, 'None in the top skills')));
  out.push(panel('Your human edge and what employers ask for',
    h('div', {class: 'two'},
      h('div', {}, h('h4', {}, 'Strengths (importance, 1–5)'), strengths.length ? h('ul', {class: 'list'}, strengths.map((s) => h('li', {}, h('span', {}, h('b', {}, s[0]), ` ${s[1].toFixed(1)}`), h('span', {class: 'meta'}, `+${s[2].toFixed(2)} vs MA average`)))) : h('p', {class: 'empty'}, 'No O*NET skill ratings for this job.')),
      h('div', {class: 'stack'}, [['S', 'Core skills (% of ads)'], ['C', 'Everyday skills (% of ads)'], ['R', 'Certifications (% of ads)']].map(([k, label]) => {
        const arr = skills.filter((s) => s[0] === k);
        return h('div', {}, h('h4', {}, label), arr.length ? h('div', {class: 'tags'}, arr.map((s) => h('span', {class: 'tag' + (s[4] ? ' aiTag' : '')}, s[1], h('em', {}, s[2] + '%')))) : h('p', {class: 'empty'}, 'Not listed'));
      })))));
  return out;
}

/* ------------------------------------------------------------------ entry */
export function renderJob(root, ctx, o) {
  // Lightcast leads (exposure, employer demand, software path, skills); then Claude usage, the plan,
  // and the 2031 "what if" last, so the page matches the team's deck.
  const lc = ctx.model.full && o.lc ? [lightcastStanding(ctx, o), ...lightcastPanels(ctx, o)] : [];
  root.replaceChildren(h('div', {class: 'jobview'},
    header(ctx, o), ...lc, standing(ctx, o), jobSignals(ctx, o, panel), planPanel(ctx, o), scenarioPanel(ctx, o)));
}
