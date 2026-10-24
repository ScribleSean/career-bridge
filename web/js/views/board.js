// Workforce-board view: jobs where exposure is high but employer demand for AI skills is low.
// Needs the Lightcast file, so it appears only in the private build.
import {h, fmt, src} from '../util.js';
import {dataTable, sortRows} from '../table.js';

export const QUADS = ['High exposure, low adoption', 'High exposure, high adoption', 'Lower exposure, high adoption', 'Lower exposure, low adoption', 'Too few MA job ads to measure'];
const SILENT = 'Silent gap';
const QLABEL = {[SILENT]: 'Silent gap: almost no employers asking', [QUADS[0]]: 'Lots of AI overlap, few employers asking', [QUADS[1]]: 'Lots of AI overlap, employers asking', [QUADS[2]]: 'Less AI overlap, employers asking',
  [QUADS[3]]: 'Less AI overlap, few employers asking', [QUADS[4]]: 'Too few job ads to tell'};
const QCLASS = {[QUADS[0]]: 'gap', [QUADS[1]]: 'ai', [QUADS[2]]: 'ai', [QUADS[3]]: 'neutral', [QUADS[4]]: 'neutral'};

export function renderBoard(root, ctx, params) {
  const {model} = ctx;
  const quad = params.quadrant === 'all' ? '' : ([SILENT, ...QUADS].includes(params.quadrant) ? params.quadrant : QUADS[0]);
  const family = model.groups.includes(params.family) ? params.family : '';
  const q = (params.q || '').toLowerCase();
  const sort = {key: params.sort || 'jobs', dir: params.dir === 'asc' ? 'asc' : 'desc'};
  const set = (patch) => ctx.go('board', {...params, ...patch});
  const withLc = model.occ.filter((o) => o.lc);
  const gap = withLc.filter((o) => o.lc.quadrant === QUADS[0]);
  const silent = withLc.filter((o) => o.lc.silent_gap), silentWorkers = silent.reduce((s, o) => s + o.jobs, 0);
  const gapWorkers = gap.reduce((s, o) => s + o.jobs, 0), allWorkers = withLc.reduce((s, o) => s + o.jobs, 0);
  const rows = withLc.filter((o) => (!quad || (quad === SILENT ? o.lc.silent_gap : o.lc.quadrant === quad)) && (!family || o.group === family) && (!q || o.title.toLowerCase().includes(q)));
  const stateRate = model.lcMeta?.state_rate_2025 ?? 6.18;

  const stat = (v, k, s) => h('div', {class: 'panel stat'}, h('span', {class: 'v'}, v), h('span', {class: 'k'}, k), s);
  const cut = model.lcMeta?.silent_cut ?? 1;
  const cols = [
    {key: 'title', label: 'Job', first: true, value: (o) => o.title, cell: (o) => [h('span', {class: 'q ' + QCLASS[o.lc.quadrant], title: QLABEL[o.lc.quadrant], 'aria-hidden': 'true'}), o.title]},
    {key: 'jobs', label: 'Massachusetts workers', num: true, value: (o) => o.jobs, cell: (o) => fmt.n(o.jobs)},
    {key: 'exposure', label: 'AI overlap', num: true, value: (o) => o.lc.exposure, cell: (o) => fmt.pct(o.lc.exposure, 1).replace('%', '')},
    {key: 'ads', label: 'Ads asking for AI skills', num: true, value: (o) => o.lc.ma_ai_2025, cell: (o) => fmt.pct(o.lc.ma_ai_2025)},
    {key: 'quad', label: 'Where it stands', opt: true, value: (o) => QLABEL[o.lc.quadrant] + (o.lc.silent_gap ? ' (silent gap)' : '')},
    {key: 'wage', label: 'Typical pay', num: true, opt: true, value: (o) => o.wage, cell: (o) => fmt.usd(o.wage)},
    {key: 'claude', label: 'Claude use (0 to 100)', num: true, opt: true, value: (o) => o.z, cell: (o) => Math.round(o.z)},
  ];
  const col = cols.find((c) => c.key === sort.key) || cols[1];
  root.replaceChildren(h('div', {class: 'boardview'},
    h('header', {class: 'viewhead'}, h('h2', {id: 'view-title', tabindex: '-1'}, 'For workforce boards'),
      h('p', {class: 'lede'}, 'See every Massachusetts job at a glance. Start with jobs where AI overlaps a lot with the work but few employers are asking for AI skills yet. Those workers may need the most help.')),
    h('div', {class: 'summary'},
      stat(fmt.n(gapWorkers), `Massachusetts workers in jobs with lots of AI overlap but few employers asking for AI skills (${gap.length} jobs)`, src('lc', 'oews')),
      stat(Math.round(100 * gapWorkers / allWorkers) + '%', 'of all the workers we looked at', src('lc', 'oews')),
      stat(fmt.n(silentWorkers), `Massachusetts workers in the “silent gap”: under ${cut}% of job ads ask for AI skills (${silent.length} jobs)`, src('lc', 'oews')),
      stat(Math.round(100 * silentWorkers / allWorkers) + '%', 'of all the workers we looked at', src('lc', 'oews')),
      stat(fmt.pct(stateRate, 2), 'of all Massachusetts job ads asked for AI skills in 2025', src('lc'))),
    h('div', {class: 'boardbar'},
      h('label', {for: 'fq'}, 'Show', h('select', {id: 'fq', onchange: (e) => set({quadrant: e.target.value})},
        [QUADS[0], SILENT, ...QUADS.slice(1), 'all'].map((v) => h('option', {value: v, selected: v === (quad || 'all')}, v === 'all' ? 'All jobs' : QLABEL[v])))),
      h('label', {for: 'fg'}, 'Kind of work', h('select', {id: 'fg', onchange: (e) => set({family: e.target.value})},
        [['', 'All kinds of work'], ...model.groups.map((g) => [g, g])].map(([v, t]) => h('option', {value: v, selected: v === family}, t)))),
      h('label', {for: 'fs'}, 'Look for a job', h('input', {id: 'fs', type: 'search', value: params.q || '', placeholder: 'Type part of a job name', onchange: (e) => set({q: e.target.value.trim()})}))),
    h('p', {class: 'foot'}, 'Sources: groups, AI overlap and job ads come from Lightcast. Workers and pay come from BLS OEWS (May 2025). Claude use comes from the Anthropic Economic Index. High overlap means a Lightcast score above 50.'),
    h('p', {class: 'foot', 'aria-live': 'polite'}, `${rows.length} jobs, ${fmt.n(rows.reduce((s, o) => s + o.jobs, 0))} Massachusetts workers. Click a job to open it.`),
    dataTable({caption: 'Massachusetts jobs by how much AI overlaps with the work and how many employers ask for AI skills. Select a column heading to sort.', columns: cols,
      rows: sortRows(rows, col, sort.dir), sort: {key: col.key, dir: sort.dir}, onSort: (key, dir) => set({sort: key, dir}), href: (o) => ctx.hrefJob(o.soc), onOpen: (o) => ctx.go('job', {}, o.soc)})));
}
