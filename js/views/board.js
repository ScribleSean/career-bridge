// Workforce-board view: jobs where exposure is high but employer demand for AI skills is low.
// Needs the Lightcast file, so it appears only in the private build.
import {h, fmt, src} from '../util.js';
import {dataTable, sortRows} from '../table.js';

export const QUADS = ['High exposure, low adoption', 'High exposure, high adoption', 'Lower exposure, high adoption', 'Lower exposure, low adoption', 'Too few MA job ads to measure'];
const SILENT = 'Silent gap';
// The deck's group names (slide 3), so the demo and the slides use the same words.
const QLABEL = {[SILENT]: 'Silent gap', [QUADS[0]]: 'Broad gap', [QUADS[1]]: 'Employers ask', [QUADS[2]]: 'Lower overlap, higher signal',
  [QUADS[3]]: 'Lower overlap, low signal', [QUADS[4]]: 'Too few job ads to tell'};
const QCLASS = {[QUADS[0]]: 'gap', [QUADS[1]]: 'ai', [QUADS[2]]: 'ai', [QUADS[3]]: 'neutral', [QUADS[4]]: 'neutral'};

/** Worker-weighted median of job median pay (how slide 3's pay figures are computed). */
function medianPay(list) {
  const xs = list.filter((o) => o.wage).sort((a, b) => a.wage - b.wage);
  const half = xs.reduce((s, o) => s + o.jobs, 0) / 2;
  let c = 0;
  for (const o of xs) { c += o.jobs; if (c >= half) return o.wage; }
  return null;
}

export function renderBoard(root, ctx, params) {
  const {model} = ctx;
  const quad = params.quadrant === 'all' ? '' : ([SILENT, ...QUADS].includes(params.quadrant) ? params.quadrant : QUADS[0]);
  const family = model.groups.includes(params.family) ? params.family : '';
  const q = (params.q || '').toLowerCase();
  const sort = {key: params.sort || 'jobs', dir: params.dir === 'asc' ? 'asc' : 'desc'};
  const set = (patch) => ctx.go('board', {...params, ...patch});
  const withLc = model.all.filter((o) => o.lc && o.ma_jobs != null)
    .map((o) => ({...o, jobs: o.ma_jobs, wage: o.ma_wage}));
  const allWorkers = withLc.reduce((s, o) => s + o.jobs, 0);
  const rows = withLc.filter((o) => (!quad || (quad === SILENT ? o.lc.silent_gap : o.lc.quadrant === quad)) && (!family || o.group === family) && (!q || o.title.toLowerCase().includes(q)));
  const stateRate = model.lcMeta?.state_rate_2025 ?? 6.18;

  const cut = model.lcMeta?.silent_cut ?? 1, growth = model.lcMeta?.group_growth || {};
  const short = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1e3)}K`;
  const groupOf = (k) => withLc.filter((o) => (k === SILENT ? o.lc.silent_gap : o.lc.quadrant === k));
  const facts = (k) => {
    const list = groupOf(k), n = list.reduce((s, o) => s + o.jobs, 0);
    return {n, share: Math.round(100 * n / allWorkers), pay: medianPay(list), g: growth[k]};
  };
  const line = (f) => [h('span', {}, `${f.share}% of workers · median ${fmt.usd(f.pay)}`), f.g == null ? null : h('span', {}, `Jobs 2019–25: ${fmt.signed(f.g)}`)];
  // Slide 3 as a grid: rows are AI overlap, columns are how many MA job ads ask for AI. A cell filters the table.
  const cell = (k, tone) => {
    const f = facts(k), on = quad === k;
    const sil = k === QUADS[0] ? facts(SILENT) : null;
    return h('div', {class: `qcell ${tone}` + (on || (sil && quad === SILENT) ? ' on' : '')},
      h('button', {type: 'button', class: 'qmain', 'aria-pressed': String(on), onclick: () => set({quadrant: k})},
        h('span', {class: 'qn'}, QLABEL[k]), h('span', {class: 'qv'}, short(f.n)), h('span', {class: 'qf'}, line(f))),
      sil ? h('button', {type: 'button', class: 'qsil', 'aria-pressed': String(quad === SILENT), onclick: () => set({quadrant: SILENT})},
        h('span', {}, `Includes the silent gap (<${cut}% of ads)`), h('span', {}, `${short(sil.n)} · ${sil.share}% · median ${fmt.usd(sil.pay)}` + (sil.g == null ? '' : ` · jobs ${fmt.signed(sil.g)}`))) : null);
  };
  const grid = h('div', {class: 'qgrid', role: 'group', 'aria-label': 'Four groups of Massachusetts workers'},
    h('span', {class: 'qcol', style: 'grid-area:c1'}, `Under ${stateRate}% of MA job ads ask for AI`),
    h('span', {class: 'qcol', style: 'grid-area:c2'}, `${stateRate}% or more ask for AI`),
    h('span', {class: 'qrow', style: 'grid-area:r1'}, h('b', {}, 'More AI overlap'), h('small', {}, 'Lightcast exposure above 50')),
    h('span', {class: 'qrow', style: 'grid-area:r2'}, h('b', {}, 'Less AI overlap'), h('small', {}, '50 or below')),
    h('div', {style: 'grid-area:a'}, cell(QUADS[0], 'gap')), h('div', {style: 'grid-area:b'}, cell(QUADS[1], 'ai')),
    h('div', {style: 'grid-area:c'}, cell(QUADS[3], 'plain')), h('div', {style: 'grid-area:d'}, cell(QUADS[2], 'plain')));
  const cols = [
    {key: 'title', label: 'Job', first: true, value: (o) => o.title, cell: (o) => [h('span', {class: 'q ' + QCLASS[o.lc.quadrant], title: QLABEL[o.lc.quadrant], 'aria-hidden': 'true'}), o.title]},
    {key: 'jobs', label: 'MA workers', num: true, src: 'oews', value: (o) => o.jobs, cell: (o) => fmt.n(o.jobs)},
    {key: 'exposure', label: 'AI overlap (0–100)', num: true, src: 'lc', value: (o) => o.lc.exposure, cell: (o) => fmt.pct(o.lc.exposure, 1).replace('%', '')},
    {key: 'ads', label: 'MA ads asking for AI', num: true, src: 'lc', value: (o) => o.lc.ma_ai_2025, cell: (o) => fmt.pct(o.lc.ma_ai_2025)},
    {key: 'quad', label: 'Where it stands', opt: true, value: (o) => QLABEL[o.lc.quadrant] + (o.lc.silent_gap ? ' · silent gap' : '')},
    {key: 'wage', label: 'Median pay', num: true, opt: true, src: 'oews', value: (o) => o.wage, cell: (o) => fmt.usd(o.wage)},
    {key: 'claude', label: 'Claude use (0–100)', num: true, opt: true, src: 'aei', value: (o) => o.z, cell: (o) => o.z == null ? 'Not enough data' : Math.round(o.z)},
  ];
  const col = cols.find((c) => c.key === sort.key) || cols[1];
  root.replaceChildren(h('div', {class: 'boardview'},
    h('header', {class: 'viewhead'}, h('h2', {id: 'view-title', tabindex: '-1'}, 'For workforce boards')),
    h('section', {class: 'panel'}, h('h3', {}, 'Four groups of Massachusetts workers'), src('lc', 'oews', 'oewsh'), grid),
    h('div', {class: 'boardbar'},
      h('label', {for: 'fq'}, 'Show', h('select', {id: 'fq', onchange: (e) => set({quadrant: e.target.value})},
        [QUADS[0], SILENT, ...QUADS.slice(1), 'all'].map((v) => h('option', {value: v, selected: v === (quad || 'all')}, v === 'all' ? 'All jobs' : QLABEL[v])))),
      h('label', {for: 'fg'}, 'Kind of work', h('select', {id: 'fg', onchange: (e) => set({family: e.target.value})},
        [['', 'All kinds of work'], ...model.groups.map((g) => [g, g])].map(([v, t]) => h('option', {value: v, selected: v === family}, t)))),
      h('label', {for: 'fs'}, 'Job', h('input', {id: 'fs', type: 'search', value: params.q || '', onchange: (e) => set({q: e.target.value.trim()})}))),
    h('p', {class: 'count', 'aria-live': 'polite'}, `${rows.length} jobs · ${fmt.n(rows.reduce((s, o) => s + o.jobs, 0))} MA workers`),
    dataTable({caption: 'Massachusetts jobs by how much AI overlaps with the work and how many employers ask for AI skills. Select a column heading to sort.', columns: cols,
      rows: sortRows(rows, col, sort.dir), sort: {key: col.key, dir: sort.dir}, onSort: (key, dir) => set({sort: key, dir}), href: (o) => ctx.hrefJob(o.soc), onOpen: (o) => ctx.go('job', {}, o.soc)})));
}
