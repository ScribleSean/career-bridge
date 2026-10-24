// Explore: every job on one chart, a group-by-group outlook, and a sortable table with the same data.
import {h, fmt, announce, src} from '../util.js';
import {scatter} from '../charts.js';
import {jobs2031, trendJobs, byGroup, presetOf, totals} from '../scenario.js';
import {jobsOf} from '../data.js';
import {dataTable, sortRows} from '../table.js';
import {postureLabel, POSTURE} from './job.js';

const fold = (summary, ...kids) => h('details', {class: 'more'}, h('summary', {}, summary), h('div', {class: 'morebody'}, ...kids));

const POSTURES = Object.keys(POSTURE);
const X = {
  use: {label: 'How much Claude is used', get: (o) => o.z, short: 'Claude use'},
  cap: {label: 'What AI could do in the job', get: (o) => o.capPct, short: 'What AI could do', full: true},
  ads: {label: 'Employers asking for AI skills', get: (o) => o.demandPct, short: 'Employer demand', full: true},
};
const Y = {
  growth: {label: 'Job growth a year, 2019 to 2025', get: (o) => o.g, fmt: (v) => fmt.signed(v, 0)},
  ai: {label: 'What AI could change by 2031', fmt: (v) => fmt.signed(v, 0)},
};

export function renderExplore(root, ctx, params) {
  const {model, state} = ctx;
  const xk = X[params.x] && (!X[params.x].full || model.full) ? params.x : 'use';
  const yk = Y[params.y] ? params.y : 'growth';
  const group = model.groups.includes(params.group) ? params.group : '';
  const picked = new Set((params.posture || '').split(',').filter((p) => POSTURES.includes(p)));
  const sort = {key: params.sort || 'jobs', dir: params.dir === 'asc' ? 'asc' : 'desc'};
  const set = (patch) => ctx.go('explore', {...params, ...patch});
  const aiPct = (o) => (jobs2031(o, o.jobs, state.A, state.P) / trendJobs(o, o.jobs) - 1) * 100;
  const yGet = yk === 'ai' ? aiPct : Y.growth.get;

  const inSel = (o) => (!group || o.group === group) && (!picked.size || picked.has(o.posture));
  const pool = model.occ.filter((o) => X[xk].get(o) != null);
  const sel = pool.filter(inSel);

  /* controls */
  const select = (id, label, opts, value, key) => h('label', {for: id}, label,
    h('select', {id, onchange: (e) => set({[key]: e.target.value})}, opts.map(([v, t]) => h('option', {value: v, selected: v === value}, t))));
  const cur = presetOf(state.A, state.P, model.presets);
  const presets = h('div', {class: 'segs', role: 'group', 'aria-label': 'How fast AI spreads'},
    Object.entries({slow: 'Slow', base: 'Medium', fast: 'Fast'}).map(([k, label]) =>
      h('button', {type: 'button', id: 'pre-' + k, class: 'seg', 'aria-pressed': String(cur === k), onclick: () => { ctx.setScenario(model.presets[k].A, model.presets[k].P); ctx.go('explore', params); }}, label)));
  const chips = h('div', {class: 'chips', role: 'group', 'aria-label': 'Filter by our suggestion'},
    POSTURES.map((p, i) => h('button', {type: 'button', id: 'chip-' + i, class: 'chip tier-' + POSTURE[p][0], 'aria-pressed': String(picked.has(p)), onclick: () => {
      const next = new Set(picked); next.has(p) ? next.delete(p) : next.add(p); set({posture: [...next].join(',')});
    }}, h('span', {class: 'swatch', 'aria-hidden': 'true'}), postureLabel(p), h('small', {}, ` ${pool.filter((o) => (!group || o.group === group) && o.posture === p).length}`))));

  /* chart */
  const ys = sel.map(yGet);
  const lo = Math.min(0, ...ys), hi = Math.max(0, ...ys), pad = (hi - lo || 1) * 0.08;
  const total = sel.reduce((s, o) => s + o.jobs, 0);
  const chartWrap = h('div', {class: 'chartwrap'});
  const draw = () => {
    const W = Math.max(320, Math.min(900, chartWrap.clientWidth || 760));
    chartWrap.replaceChildren(sel.length ? scatter({
      points: sel.map((o) => ({id: o.soc, x: X[xk].get(o), y: yGet(o), r: o.jobs, title: o.title, selected: o.soc === ctx.selected,
        fill: `var(--p${POSTURES.indexOf(o.posture) + 1})`,
        lines: [`${fmt.n(o.jobs)} people · ${group ? '' : o.group}`, `${X[xk].short}: higher than ${Math.round(X[xk].get(o))} of 100 jobs`, `${Y[yk].label.split(',')[0]}: ${Y[yk].fmt(yGet(o))}`, postureLabel(o.posture)]})),
      yDomain: [lo - pad, hi + pad], xLabel: X[xk].label + ' (0 to 100)', yLabel: Y[yk].label,
      xFmt: (v) => v, yFmt: Y[yk].fmt, onPick: (soc) => ctx.go('job', {}, soc), W, H: W < 520 ? 340 : 440, rMax: W < 520 ? 14 : 20,
      desc: `Scatter of ${sel.length} occupations. Horizontal: ${X[xk].label}. Vertical: ${Y[yk].label}. The same data is in the table below.`,
    }) : h('p', {class: 'empty'}, 'No jobs match these filters.'));
  };

  /* group outlook */
  const rows = byGroup(pool, jobsOf, state, model.presets).sort((a, b) => a.fastPct - b.fastPct);
  const gmin = Math.min(...rows.map((r) => r.fastPct)) * 1.06;
  const gx = (v) => ((v - gmin) / (0 - gmin)) * 100;
  const outlook = h('ul', {class: 'groups'}, rows.map((r, i) => h('li', {}, h('button', {type: 'button', id: 'gr-' + i, class: 'gr', 'aria-pressed': String(group === r.group),
    'aria-label': `${r.group}: ${fmt.signed(r.vsTrendPct)} compared with recent trends at this speed, ${fmt.signed(r.fastPct)} if AI spreads fast to ${fmt.signed(r.slowPct)} if slow. ${group === r.group ? 'Selected. Press to clear.' : 'Press to show only this group.'}`,
    onclick: () => set({group: group === r.group ? '' : r.group})},
    h('span', {class: 'gl'}, r.group, h('small', {}, `${fmt.compact(r.jobs)} people`)),
    h('span', {class: 'trk', 'aria-hidden': 'true'}, h('i', {class: 'zero'}), h('i', {class: 'whisk', style: `left:${gx(r.fastPct)}%;width:${gx(r.slowPct) - gx(r.fastPct)}%`}), h('i', {class: 'dotm', style: `left:${gx(r.vsTrendPct)}%`})),
    h('span', {class: 'gv'}, h('b', {}, fmt.signed(r.vsTrendPct)), h('small', {}, `${fmt.signed(r.fastPct, 0)} to ${fmt.signed(r.slowPct, 0)}`))))));

  /* table twin */
  const cols = [
    {key: 'title', label: 'Job', first: true, value: (o) => o.title},
    {key: 'group', label: 'Kind of work', opt: true, value: (o) => o.group},
    {key: 'jobs', label: model.geo === 'MA' ? 'MA jobs' : 'US jobs', num: true, value: (o) => o.jobs, cell: (o) => fmt.n(o.jobs)},
    {key: 'wage', label: 'Typical pay', num: true, opt: true, value: (o) => o.wage, cell: (o) => fmt.usd(o.wage)},
    {key: 'use', label: 'Claude use (0 to 100)', num: true, value: (o) => o.z, cell: (o) => Math.round(o.z)},
    ...(model.full ? [{key: 'ads', label: 'Ads asking for AI', num: true, opt: true, value: (o) => o.lc?.ma_ai_2025 ?? null, cell: (o) => fmt.pct(o.lc?.ma_ai_2025 ?? null)}] : []),
    {key: 'growth', label: 'Growth a year', num: true, opt: true, value: (o) => o.g, cell: (o) => fmt.signed(o.g)},
    {key: 'ai', label: 'AI change by 2031', num: true, value: aiPct, cell: (o) => fmt.signed(aiPct(o))},
    {key: 'posture', label: 'Our suggestion', value: (o) => POSTURES.indexOf(o.posture), cell: (o) => postureLabel(o.posture)},
  ];
  const col = cols.find((c) => c.key === sort.key) || cols[2];
  const tbl = dataTable({caption: 'Jobs with how much Claude is used, recent growth and what AI could change by 2031. Select a column heading to sort.', columns: cols,
    rows: sortRows(sel, col, sort.dir), sort: {key: col.key, dir: sort.dir}, onSort: (key, dir) => set({sort: key, dir}), href: (o) => ctx.hrefJob(o.soc), onOpen: (o) => ctx.go('job', {}, o.soc)});

  const t = totals(sel, jobsOf, state.A, state.P);
  const summary = `${sel.length} jobs, ${fmt.n(total)} people. If AI spreads at the speed you picked, these jobs could end 2031 ${fmt.signed(t.vsTrendPct, 0)} compared with recent trends.`;
  announce(summary);

  root.replaceChildren(h('div', {class: 'exploreview'},
    h('header', {class: 'viewhead'}, h('h2', {id: 'view-title', tabindex: '-1'}, 'Compare jobs'),
      h('p', {class: 'lede'}, 'See every job side by side: where AI shows up, which jobs are growing, and what could change. Click any job to open it.')),
    h('section', {class: 'panel controls'},
      h('div', {class: 'ctlrow'}, select('ex-g', 'Show only one kind of work', [['', 'All kinds of work'], ...model.groups.map((g) => [g, g])], group, 'group')),
      h('div', {}, h('p', {class: 'lbl'}, 'Show only jobs where we suggest'), chips),
      h('div', {}, h('p', {class: 'lbl'}, 'How fast does AI spread? (changes the 2031 numbers)'), presets),
      fold('Change what the picture shows',
        h('div', {class: 'ctlrow'},
          select('ex-x', 'Across the bottom', Object.entries(X).filter(([, v]) => !v.full || model.full).map(([k, v]) => [k, v.label]), xk, 'x'),
          select('ex-y', 'Up the side', Object.entries(Y).map(([k, v]) => [k, v.label]), yk, 'y')))),
    h('section', {class: 'panel'}, h('h3', {}, 'Which kinds of work could change the most?'),
      h('p', {class: 'sub'}, 'The dot shows where each kind of work could end up by 2031, compared with recent trends. The line runs from fast to slow AI spread. Click a row to show only that kind of work.'), src('oewsh', 'aei', 'onet'), outlook),
    h('section', {class: 'panel'}, h('h3', {}, 'Every job in one picture'), h('p', {class: 'sub'}, summary), src(...(model.full ? ['oewsh', 'aei', 'onet', 'lc'] : ['oewsh', 'aei', 'onet'])), chartWrap,
      h('p', {class: 'foot'}, 'Bigger circles mean more people. Colors match our suggestion for each job. Growth is capped at the extremes, so some circles line up along a flat edge. Hover or tap a circle to see the job. The table below has the same information.')),
    h('section', {class: 'panel'}, h('h3', {}, 'The same thing as a table'), h('p', {class: 'sub'}, 'Every job in your selection. Click a heading to sort.'), tbl)));
  draw();
  if (window.ResizeObserver) { let last = chartWrap.clientWidth; new ResizeObserver(() => { if (Math.abs(chartWrap.clientWidth - last) > 24) { last = chartWrap.clientWidth; draw(); } }).observe(chartWrap); }
}
