// Skills market: what employers say they need (demand) against what verified workers report (supply),
// for each skill, by region and kind of work. Built from skill signals; sample data in this demo.
import {h, src} from '../util.js';
import {SKILL, REGIONS, allSignals, market, SHORT, SURPLUS} from '../signals.js';

const MASSHIRE_URL = 'https://www.mass.gov/orgs/masshire-department-of-career-services';
const FLAG = {shortage: ['Shortage', 'f-short'], balanced: ['Balanced', 'f-bal'], surplus: ['Surplus', 'f-surp'], thin: ['Too few signals', 'f-bal']};
const pct = (v) => `${Math.round(v * 100)}%`;
const times = (v) => (v === Infinity ? 'no verified workers yet' : `${v.toFixed(1)}×`);
const gapText = (r) => (r.index === Infinity ? 'Employers want it; no verified worker reports it yet' : `Employers want it ${r.index.toFixed(1)}× more than verified workers report it`);

export function renderMarket(root, ctx, params) {
  const {model} = ctx;
  const region = REGIONS.includes(params.region) ? params.region : '';
  const all = allSignals(model);
  const groupOf = (soc) => model.bySoc.get(soc)?.group;
  const groups = [...new Set(all.map((s) => groupOf(s.soc)).filter(Boolean))].sort();
  const family = groups.includes(params.family) ? params.family : '';
  const list = all.filter((s) => (!region || s.region === region) && (!family || groupOf(s.soc) === family));
  const m = market(list);
  const set = (patch) => ctx.go('market', {...params, ...patch});
  const short = m.rows.filter((r) => r.flag === 'shortage'), surplus = m.rows.filter((r) => r.flag === 'surplus');
  const top = Math.max(0.05, ...m.rows.map((r) => Math.max(r.ds, r.ss)));
  const axisMax = Math.ceil(top * 20) / 20;  // round up to the next 5%
  const ticks = [0, axisMax / 2, axisMax];
  const pos = (v) => `${(100 * v) / axisMax}%`;
  const stat = (v, k) => h('div', {class: 'stat'}, h('span', {class: 'v'}, v), h('span', {class: 'k'}, k));

  const bars = h('ul', {class: 'mkt'}, m.rows.map((r) => {
    const [flag, cls] = FLAG[r.flag];
    return h('li', {},
      h('div', {class: 'mkthead'}, h('b', {}, SKILL[r.id].label), h('span', {class: 'flag ' + cls}, flag), h('span', {class: 'idx'}, times(r.index))),
      h('div', {class: 'mktbars', role: 'img', 'aria-label': `${SKILL[r.id].label}: ${pct(r.ds)} of employer demand, ${pct(r.ss)} of verified worker supply. ${flag}.`},
        h('span', {class: 'mrow'}, h('span', {class: 'mtrack'}, ticks.map((t) => h('i', {class: 'bgrid', style: `left:${pos(t)}`})), h('span', {class: 'mfill d', style: `width:${pos(r.ds)}`})), h('span', {class: 'mval'}, pct(r.ds))),
        h('span', {class: 'mrow'}, h('span', {class: 'mtrack'}, ticks.map((t) => h('i', {class: 'bgrid', style: `left:${pos(t)}`})), h('span', {class: 'mfill s', style: `width:${pos(r.ss)}`})), h('span', {class: 'mval'}, pct(r.ss)))));
  }));

  const jobsNaming = (id) => {
    const c = {};
    for (const s of list) if (s.side === 'employer' && (s.skills.some((k) => k.id === id) || (s.growing || []).includes(id))) c[s.soc] = (c[s.soc] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([soc]) => model.bySoc.get(soc)?.title).filter(Boolean);
  };

  root.replaceChildren(h('div', {class: 'mktview'},
    h('header', {class: 'viewhead'}, h('h2', {id: 'view-title', tabindex: '-1'}, 'Skills market'), src('sig')),
    h('div', {class: 'boardbar'},
      h('label', {for: 'mr'}, 'Region', h('select', {id: 'mr', onchange: (e) => set({region: e.target.value})},
        h('option', {value: ''}, 'All of Massachusetts'), REGIONS.map((x) => h('option', {value: x, selected: x === region}, x)))),
      h('label', {for: 'mf'}, 'Kind of work', h('select', {id: 'mf', onchange: (e) => set({family: e.target.value})},
        h('option', {value: ''}, 'All kinds of work'), groups.map((g) => h('option', {value: g, selected: g === family}, g))))),
    h('div', {class: 'summary four'},
      stat(m.employers, 'employer signals'), stat(m.verifiedWorkers, 'verified worker signals'),
      stat(short.length, 'skills in shortage'), stat(surplus.length, 'skills in surplus')),
    short.length ? h('section', {class: 'panel act'}, h('h3', {}, 'Where training money would go furthest'),
      h('ol', {class: 'actlist'}, short.slice(0, 3).map((r) => h('li', {},
        h('b', {}, SKILL[r.id].label), h('span', {class: 'idx'}, gapText(r)),
        h('span', {class: 'jobs'}, 'Named by employers of: ', jobsNaming(r.id).join(', ') || '—')))),
      h('p', {}, h('a', {href: MASSHIRE_URL, target: '_blank', rel: 'noopener'}, 'MassHire career centers'), ' can point training funds and workers at these skills.')) : null,
    h('section', {class: 'panel'}, h('h3', {}, 'Employer demand vs verified worker supply'),
      h('div', {class: 'legend'}, h('span', {class: 'key', style: '--c:var(--brand)'}, 'Share of employer demand'), h('span', {class: 'key', style: '--c:var(--ok)'}, 'Share of verified worker supply')),
      h('div', {class: 'mktaxis', 'aria-hidden': 'true'}, ticks.map((t) => h('span', {style: `left:${pos(t)}`}, pct(t)))),
      m.rows.length ? bars : h('p', {class: 'empty'}, 'Not enough signals here yet.'),
      h('p', {class: 'fine'}, `Shortage: employers' share is at least ${SHORT}× the verified supply share. Surplus: ${SURPLUS}× or less. Demand counts each employer signal naming a skill, twice when they say it is becoming more important.`))));
}
