// Loads the two data files and joins them into one model.
//   atlas.json         open data (BLS OEWS, O*NET, Anthropic Economic Index). Required. Safe to host publicly.
//   careerbridge.json  adds Lightcast job-ad numbers. Optional and licensed: private builds only.
// Without the second file the app runs in "open data" mode and hides the Lightcast panels.

async function getJSON(name, optional = false) {
  try {
    const r = await fetch(new URL(name, document.baseURI), {headers: {Accept: 'application/json'}});
    if (!r.ok) throw new Error(`${name}: ${r.status}`);
    return await r.json();
  } catch (e) {
    if (optional) return null;
    throw e;
  }
}

export async function loadData() {
  // The licensed Lightcast layer is only requested when the page opts in with <meta name="cb-lightcast">.
  const wantLc = !!document.querySelector('meta[name="cb-lightcast"]');
  const [atlas, cb] = await Promise.all([getJSON('atlas.json'), wantLc ? getJSON('careerbridge.json', true) : null]);
  return {atlas, cb: cb && Array.isArray(cb.occ) ? cb : null};
}

/** Percent of values strictly below v, counting ties as half. */
function percentile(values) {
  const s = values.filter((v) => v != null).sort((a, b) => a - b);
  return (v) => {
    if (v == null || !s.length) return null;
    let lo = 0, hi = s.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < v) lo = m + 1; else hi = m; }
    let eq = lo;
    while (eq < s.length && s[eq] === v) eq++;
    return Math.round(100 * (lo + (eq - lo) / 2) / s.length);
  };
}

/** Values at the lowest, median and highest job, for labeling a ranked ruler at 0, 50 and 100. */
function anchors(values) {
  const s = values.filter((v) => v != null).sort((a, b) => a - b);
  return s.length ? [[0, s[0]], [50, s[Math.floor((s.length - 1) / 2)]], [100, s[s.length - 1]]] : [];
}

/** geo is 'MA' or 'US'. Occupations without a job count in that geography are left out. */
export function makeModel({atlas, cb}, geo) {
  const cbBy = new Map((cb?.occ || []).map((o) => [o.soc, o]));
  const jobsKey = geo === 'MA' ? 'ma_jobs' : 'us_jobs', wageKey = geo === 'MA' ? 'ma_wage' : 'us_wage';
  // Older data files lack silent_gap: derive it with the contract rule (same as server.py).
  const m = cb?.meta || {}, cut = m.exposure_cut ?? 50, silentCut = m.silent_cut ?? 1;
  for (const o of cb?.occ || []) if (!('silent_gap' in o)) o.silent_gap = o.ma_confidence !== 'THIN' && o.ma_ai_2025 != null && (o.exposure || 0) > cut && o.ma_ai_2025 < silentCut;
  const all = atlas.occ.map((a) => ({...a, jobs: a[jobsKey], wage: a[wageKey], lc: cbBy.get(a.soc) || null}));
  const occ = all.filter((o) => o.jobs != null);
  const capRank = percentile(all.map((o) => o.lc?.exposure));
  const demandRank = percentile(all.map((o) => o.lc?.ma_ai_2025));
  for (const o of all) {
    o.capPct = capRank(o.lc?.exposure);
    o.demandPct = demandRank(o.lc?.ma_ai_2025);
  }
  const capAnchors = anchors(all.map((o) => o.lc?.exposure)), demandAnchors = anchors(all.map((o) => o.lc?.ma_ai_2025));
  return {
    geo, full: !!cb, meta: atlas.meta, lcMeta: cb?.meta || null, cb, usage: atlas.usage, plans: atlas.plans,
    capAnchors, demandAnchors, demandRank,
    occ, all, bySoc: new Map(all.map((o) => [o.soc, o])),
    groups: [...new Set(occ.map((o) => o.group))].sort(),
    presets: Object.fromEntries(Object.entries(atlas.meta.scenarios).map(([k, v]) => [k, {A: v.A, P: v.P}])),
  };
}

export const jobsOf = (o) => o.jobs;
