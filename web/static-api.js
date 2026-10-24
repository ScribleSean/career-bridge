// No-server mode: answers the same /api/* requests as server.py from a data file
// loaded in the browser (careerbridge.json next to index.html). Used when the
// Python server isn't running, e.g. on a static host. Keep in step with server.py.

const GAP = 'High exposure, low adoption';
const QUADRANTS = [GAP, 'High exposure, high adoption', 'Lower exposure, high adoption', 'Lower exposure, low adoption', 'Too few MA job ads to measure'];
const DEFAULT_META = {
  state_rate_2025: 6.18, exposure_median: 55.7, exposure_min: 31.5, exposure_max: 82.8,
  sources: ['Data Source: Lightcast, 2026 (AI Exposure and Adoption by Occupation, 2023-Sep 2026)', 'BLS OEWS May 2025', 'O*NET 31.0', 'Anthropic Economic Index, June 2026 release'],
};
const ALIASES = {rn: 'registered nurses', admin: 'administrative', cna: 'nursing assistants', cs: 'customer service', hr: 'human resources', it: 'computer', dev: 'developers', devs: 'developers', teacher: 'teachers', nurse: 'nurses', rep: 'representatives', reps: 'representatives'};
const SORT_KEYS = new Set(['title', 'ma_employment', 'exposure', 'ma_ai_2025', 'us_ai_2025', 'ma_median_wage', 'bachelors_plus_pct', 'major_group', 'claude_share_us', 'years_behind_software']);
const SUMMARY = ['soc', 'title', 'major_group', 'ma_employment', 'exposure', 'ma_ai_2025', 'quadrant'];
const BOARD = SUMMARY.concat(['us_ai_2025', 'ma_median_wage', 'bachelors_plus_pct', 'ma_confidence', 'years_behind_software', 'software_path_status']);
const pick = (o, fields) => Object.fromEntries(fields.map(k => [k, o[k] ?? null]));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function makeStaticApi(d, dataFile = 'careerbridge.json') {
  const occ = d.occ || [];
  const bySoc = new Map(occ.map(o => [o.soc, o]));
  const meta = {...DEFAULT_META, ...(d.meta || {})};
  const families = [...new Set(occ.map(o => o.major_group).filter(Boolean))].sort();
  const ranked = [...occ].sort((a, b) => (b.ma_employment || 0) - (a.ma_employment || 0));
  const lower = new Map(occ.map(o => [o.soc, (o.title || '').toLowerCase()]));
  const total = occ.reduce((s, o) => s + (o.ma_employment || 0), 0);
  const gap = occ.filter(o => o.quadrant === GAP);
  const gapW = gap.reduce((s, o) => s + (o.ma_employment || 0), 0);
  const summary = {gap_workers: gapW, gap_share: total ? Math.round(1000 * gapW / total) / 10 : 0, gap_count: gap.length, state_rate: meta.state_rate_2025, total_workers: total, total_count: occ.length};

  const words = text => (text || '').toLowerCase().split(/\s+/).map(w => w.replace(/[^\w*-]/g, '')).filter(Boolean).flatMap(w => (ALIASES[w] || w).split(' '));
  const match = (title, ws) => ws.every(w => title.includes(w) || (w.length > 4 && title.includes(w.slice(0, -1))));

  function search(q, limit = 10) {
    q = (q || '').trim();
    if (!q) return ranked.slice(0, limit).map(o => pick(o, SUMMARY));
    if (/^\d{2}-\d{4}$/.test(q) && bySoc.has(q)) return [pick(bySoc.get(q), SUMMARY)];
    const ws = words(q);
    if (!ws.length) return [];
    const scored = [];
    ranked.forEach((o, i) => {
      const title = lower.get(o.soc);
      if (!match(title, ws)) return;
      const head = title.split(' except ')[0];
      let score = 0;
      for (const w of ws) {
        const stem = w.length > 4 && !title.includes(w) ? w.slice(0, -1) : w;
        if (head.includes(stem)) score += 2;
        if (new RegExp('\\b' + esc(stem)).test(head)) score += 1;
      }
      scored.push([-score, i, o]);
    });
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return scored.slice(0, limit).map(t => pick(t[2], SUMMARY));
  }

  function detail(soc) {
    const o = bySoc.get(soc);
    if (!o) return null;
    const paths = (d.paths?.[soc] || []).map(p => {
      const t = bySoc.get(p[0]);
      if (!t) return null;
      return {soc: p[0], similarity: p[1], wage_diff: p[2], bridge_skills: String(p[3] || '').split(',').map(s => s.trim()).filter(Boolean), target: pick(t, BOARD.concat(['job_zone']))};
    }).filter(Boolean).sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    return {occ: o, trend: d.trend?.[soc] || [], genai: d.genai?.[soc] || [], growth: d.growth?.[soc] || [], tasks: d.tasks?.[soc] || [], skills: d.skills?.[soc] || [], strengths: d.strengths?.[soc] || [], paths};
  }

  function board(p) {
    const quadrant = p.get('quadrant') || '', family = p.get('family') || '';
    const ws = (p.get('q') || '').toLowerCase().split(/\s+/).filter(Boolean);
    let sort = p.get('sort') || 'ma_employment';
    if (!SORT_KEYS.has(sort)) sort = 'ma_employment';
    let dir = p.get('dir') || '';
    if (dir !== 'asc' && dir !== 'desc') dir = (sort === 'title' || sort === 'major_group') ? 'asc' : 'desc';
    const rows = occ.filter(o => (!quadrant || quadrant === 'all' || quadrant === 'All jobs' || o.quadrant === quadrant)
      && (!family || o.major_group === family) && ws.every(w => lower.get(o.soc).includes(w)));
    // "Not started" sorts as furthest behind software; "too few ads" stays blank (last). Same as server.py.
    const val = o => (sort === 'years_behind_software' && o.software_path_status === 'not_started') ? 99 : o[sort];
    const present = rows.filter(o => val(o) != null), missing = rows.filter(o => val(o) == null);
    const key = o => typeof val(o) === 'string' ? val(o).toLowerCase() : val(o);
    present.sort((a, b) => { const x = key(a), y = key(b); const c = x < y ? -1 : x > y ? 1 : 0; return dir === 'desc' ? -c : c; });
    const out = present.concat(missing);
    return {rows: out.map(o => pick(o, BOARD)), count: out.length, workers: out.reduce((s, o) => s + (o.ma_employment || 0), 0), sort, dir, summary, quadrants: QUADRANTS, families};
  }

  function metaPayload() {
    return {...meta, counts: Object.fromEntries(['occ', 'trend', 'genai', 'tasks', 'skills', 'strengths', 'paths'].map(k => [k, Array.isArray(d[k]) ? d[k].length : Object.keys(d[k] || {}).length])),
      quadrant_counts: Object.fromEntries(QUADRANTS.map(q => [q, occ.filter(o => o.quadrant === q).length])), families, aliases: ALIASES, using_reference: false, data_file: dataFile, static_mode: true};
  }

  // Returns [status, body] like the server would.
  return function handle(path) {
    const u = new URL(path, 'http://x');
    const p = u.pathname;
    if (p === '/api/meta') return [200, metaPayload()];
    if (p === '/api/occupations') return [200, search(u.searchParams.get('q'))];
    if (p.startsWith('/api/occupations/')) {
      const soc = decodeURIComponent(p.slice('/api/occupations/'.length));
      const r = detail(soc);
      return r ? [200, r] : [404, {error: `No occupation with SOC code ${soc}`}];
    }
    if (p === '/api/board') return [200, board(u.searchParams)];
    return [404, {error: 'Not found'}];
  };
}
