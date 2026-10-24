// Scenario math. Pure functions, no DOM, so they can be tested with `node --test`.
//
// jobs in 2031 = jobs now x (1 + past yearly growth)^6 x (1 - A x P x automation lean x exposure)
//   A  share of Claude-exposed, handed-off work that gets adopted by 2031
//   P  share of that adopted work that removes headcount (the rest frees up time)
// Exposure (0 to 1) is the job's percentile rank for where Claude.ai is used. These are illustrative
// assumptions to explore, not estimates fitted to data.

export const HORIZON = 6; // May 2025 -> May 2031

/** Share of jobs removed by 2031 relative to the past-trend path. */
export const loss = (o, A, P) => A * P * (o.auto / 100) * (o.z / 100);

export const trendJobs = (o, jobs, t = HORIZON) => jobs * Math.pow(1 + o.g / 100, t);

/** Jobs t years after May 2025. Adoption builds evenly, so the loss grows in a straight line. */
export const pathJobs = (o, jobs, A, P, t) => trendJobs(o, jobs, t) * (1 - (t / HORIZON) * loss(o, A, P));

export const jobs2031 = (o, jobs, A, P) => pathJobs(o, jobs, A, P, HORIZON);

/** Totals for a list of occupations. jobsOf(o) gives the job count in the chosen geography. */
export function totals(list, jobsOf, A, P) {
  let now = 0, trend = 0, ai = 0;
  for (const o of list) {
    const j = jobsOf(o);
    if (j == null) continue;
    now += j; trend += trendJobs(o, j); ai += jobs2031(o, j, A, P);
  }
  return {now, trend, ai, vsTrendPct: trend ? (ai / trend - 1) * 100 : 0, vsNowPct: now ? (ai / now - 1) * 100 : 0};
}

/** One row per major group with the outlook under the current setting and the slow/fast presets. */
export function byGroup(list, jobsOf, current, presets) {
  const groups = new Map();
  for (const o of list) {
    if (jobsOf(o) == null) continue;
    if (!groups.has(o.group)) groups.set(o.group, []);
    groups.get(o.group).push(o);
  }
  return [...groups].map(([group, os]) => {
    const t = (s) => totals(os, jobsOf, s.A, s.P);
    const cur = t(current);
    return {group, jobs: cur.now, vsTrendPct: cur.vsTrendPct, vsNowPct: cur.vsNowPct,
      slowPct: t(presets.slow).vsTrendPct, fastPct: t(presets.fast).vsTrendPct,
      z: os.reduce((s, o) => s + o.z * jobsOf(o), 0) / cur.now, auto: os[0].auto};
  });
}

export const presetOf = (A, P, presets) => Object.keys(presets).find((k) => Math.abs(presets[k].A - A) < 1e-9 && Math.abs(presets[k].P - P) < 1e-9) || 'custom';
