// One job, for career counselors: Lightcast standing and panels first (private builds, when careerbridge.json is
// loaded), then AI use, the survey summary for the three survey jobs, and the career plan. Design rule: no subtitles, footnotes or helper text; titles, scales and
// source tags carry the meaning, and explanations live on the About page.
import {h, fmt, announce, src} from '../util.js';
import {lineChart, barList} from '../charts.js';
import {jobSurvey} from './survey.js';


const GAP = 'High exposure, low adoption', HIHI = 'High exposure, high adoption', LOHI = 'Lower exposure, high adoption', LOLO = 'Lower exposure, low adoption';

const SOURCES = {'Where this job stands with AI': ['lc'], 'How much AI is used on this work': ['aei', 'onet'], 'What you can do about it': ['onet', 'aei', 'oews'],
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
  const geo = ctx.state.geo === 'MA' ? 'MA' : 'US';
  // Lightcast verdict first (private build), then the plan's suggestion. Short pills, no sentences.
  const pills = [
    o.lc?.silent_gap ? h('span', {class: 'pill gap'}, 'Silent gap') : null,
    o.lc && !o.lc.silent_gap && QSHORT[o.lc.quadrant] ? h('span', {class: 'pill ' + (o.lc.quadrant === GAP ? 'gap' : 'neutral')}, QSHORT[o.lc.quadrant]) : null];
  return h('header', {class: 'occhead'},
    h('span', {class: 'grp'}, o.group),
    h('h2', {id: 'occ-title', tabindex: '-1'}, o.title),
    h('div', {class: 'pills'}, pills),
    h('dl', {class: 'facts'},
      fact(`${geo} workers, 2025`, fmt.n(o.jobs), 'oews'),
      fact('Median pay', fmt.usd(o.wage), 'oews'),
      fact(o.growth_pct == null ? 'Capped US change a year, 2019–25' : 'US change a year, 2019–25', fmt.signed(o.growth_pct ?? o.g), 'oewsh'),
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
  return panel('How much AI is used on this work',
    h('ul', {class: 'rulers'}, ruler('use', 'circle', 'AI use (Anthropic Economic Index)', o.z == null ? null : Math.round(o.z), o.z == null ? 'Not enough data' : o.basis === 'content only (AEI withheld)' ? 'Estimated from tasks' : `${Math.round(o.z)} of 100`,
      [[0, '0'], [50, '50'], [100, '100']])));
}

/** Lightcast first: AI overlap and employer demand (private build only). The header pills carry the verdict. */
function lightcastStanding(ctx, o) {
  const m = ctx.model, r = o.lc.ma_ai_2025, state = m.lcMeta?.state_rate_2025 ?? 6.18;
  const adsFmt = (v) => `${v < 10 ? v.toFixed(1) : v.toFixed(0)}%`;
  return panel('Where this job stands with AI',
    h('ul', {class: 'rulers'},
      ruler('cap', 'square', 'AI overlap', o.capPct, o.lc.exposure == null ? 'Not enough data' : `${o.lc.exposure.toFixed(1)} of 100`, named(m.capAnchors, (v) => v.toFixed(0))),
      ruler('ads', 'diamond', 'MA job ads asking for AI', o.demandPct, r == null ? 'Too few ads' : `${fmt.pct(r)} of ads`,
        named(m.demandAnchors, adsFmt), {pos: m.demandRank(state), label: `State ${state}%`})));
}

/* ------------------------------------------------------------------ career plan */
function moveCard(ctx, o, t, extra, meta) {
  const wd = t.wage != null && o.wage != null ? t.wage - o.wage : null;
  return h('li', {class: 'move'},
    h('a', {class: 't', href: ctx.hrefJob(t.soc), 'aria-label': `Open ${t.title}`}, t.title),
    h('div', {class: 'row'},
      h('span', {}, 'Median pay ', h('b', {class: wd > 0 ? 'up' : ''}, fmt.usd(t.wage)), wd != null ? ` (${fmt.usdDiff(wd)})` : ''),
      h('span', {}, h('b', {}, fmt.n(t.jobs)), ' workers'),
      meta),
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
      // Ranked by skill match, then pay; never by lower AI use.
      const mv = (plan.moves || []).map((m) => ({m, t: model.bySoc.get(m.soc)})).filter((x) => x.t && x.t.jobs != null)
        .sort((a, b) => b.m.sim - a.m.sim || (b.t.wage || 0) - (a.t.wage || 0));
      note.textContent = !mv.length ? 'No close match' : '';
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
    [['less', 'Similar skills'], ['ads', 'Employers want AI skills']].map(([k, label]) =>
      h('button', {type: 'button', class: 'seg', 'aria-pressed': String(k === mode), onclick: (e) => {
        mode = k; e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); draw();
      }}, label)));
  draw();
  return h('div', {class: 'block'}, h('h3', {}, 'Jobs with similar skills'), toggle, note, list);
}

function planText(ctx, o, plan) {
  const mv = (plan.moves || []).map((m) => ctx.model.bySoc.get(m.soc)).filter(Boolean).slice(0, 3).map((t) => t.title);
  return [`Career plan: ${o.title}`, '',
    `Do more of: ${plan.lean.join('; ') || 'n/a'}`, `AI can speed up: ${plan.use.join('; ') || 'n/a'}`, mv.length ? `Jobs with similar skills: ${mv.join('; ')}` : '', '',
    ...plan.timeline.map((s) => `${s.when}: ${s.text}`), '', 'Source: Career Bridge (O*NET 31.0, BLS OEWS, Anthropic Economic Index). AI use shows where AI is used today, not a prediction about jobs.'].filter((l, i, a) => l || a[i - 1]).join('\n');
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
    h('div', {class: 'two'}, acts('Do more of this', plan.lean), acts('AI can speed these up', plan.use)),
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
  const tasks = (cb.tasks?.[soc] || []).filter((t) => t[1] > 0), skills = cb.skills?.[soc] || [], strengths = (cb.strengths?.[soc] || []).filter((s) => s[1] != null && s[2] != null);
  out.push(panel('What people use AI for in this job',
    tasks.length ? barList(tasks.map((t) => ({label: t[0], value: t[1]})), {fmt: (v) => (v === 0 ? '0' : v.toFixed(v < 0.1 ? 2 : 1)) + '%', unit: 'of US Claude conversations, Apr–May 2026'})
      : h('p', {class: 'empty'}, 'Too few conversations to show'),
    h('h4', {}, 'AI skills in job ads (% of ads)'),
    skills.some((s) => s[4]) ? h('div', {class: 'tags'}, skills.filter((s) => s[4]).map((s) => h('span', {class: 'tag aiTag'}, s[1], h('em', {}, s[2] + '%')))) : h('p', {class: 'empty'}, 'None in the top skills')));
  out.push(panel('Your human edge and what employers ask for',
    h('div', {class: 'two'},
      h('div', {}, h('h4', {}, 'Strengths (importance, 1–5)'), strengths.length ? h('ul', {class: 'list'}, strengths.map((s) => h('li', {}, h('span', {}, h('b', {}, s[0]), ` ${s[1].toFixed(1)}`), h('span', {class: 'meta'}, `+${s[2].toFixed(2)} vs MA average`)))) : h('p', {class: 'empty'}, 'Not enough data')),
      h('div', {class: 'stack'}, [['S', 'Core skills (% of ads)'], ['C', 'Everyday skills (% of ads)'], ['R', 'Certifications (% of ads)']].map(([k, label]) => {
        const arr = skills.filter((s) => s[0] === k);
        return h('div', {}, h('h4', {}, label), arr.length ? h('div', {class: 'tags'}, arr.map((s) => h('span', {class: 'tag' + (s[4] ? ' aiTag' : '')}, s[1], h('em', {}, s[2] + '%')))) : h('p', {class: 'empty'}, 'Not listed'));
      })))));
  return out;
}

/* ------------------------------------------------------------------ entry */
export function renderJob(root, ctx, o) {
  // Lightcast leads in private builds; then AI use, the survey summary (three survey jobs), and the plan.
  const lc = ctx.model.full && o.lc ? [lightcastStanding(ctx, o), ...lightcastPanels(ctx, o)] : [];
  root.replaceChildren(h('div', {class: 'jobview'},
    header(ctx, o), ...lc, standing(ctx, o), jobSurvey(ctx, o, panel), planPanel(ctx, o)));
}
