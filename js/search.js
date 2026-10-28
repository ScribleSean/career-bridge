// Job-title search. About 52,000 reported titles (O*NET) map to 830 occupations, so "software engineer"
// finds Software Developers. Titles load on first use; until then the 830 official titles answer.

const ALIASES = {rn: 'registered nurses', admin: 'administrative', cna: 'nursing assistants', cs: 'customer service', hr: 'human resources',
  it: 'computer', dev: 'developers', devs: 'developers', rep: 'representatives', reps: 'representatives', swe: 'software engineer', pm: 'project manager'};

const fold = (text) => (text || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

let titles = null, pending = null;
export const useTitles = (rows) => { titles = rows.map(([t, soc]) => [fold(t), soc, t]); };  // for tests
export function loadTitles() {
  if (titles) return Promise.resolve(titles);
  pending ||= fetch(new URL('titles.json', document.baseURI)).then((r) => r.json())
    .then((rows) => (titles = rows.map(([t, soc]) => [fold(t), soc, t])))
    .catch(() => (titles = []));
  return pending;
}

const stem = (w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
const escapeRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = (text) => fold(text).split(/\s+/).map((w) => w.replace(/[^\w*-]/g, '')).filter(Boolean)
  .flatMap((w) => (ALIASES[w] || w).split(' ')).map(stem);

/** Best matches first. `known` is a Map of soc -> occupation for the current geography. */
export function search(query, occs, limit = 8) {
  const q = fold(query).trim();
  if (!q) return [];
  const bySoc = new Map(occs.map((o) => [o.soc, o]));
  if (/^\d{2}-\d{4}$/.test(q)) return bySoc.has(q) ? [{o: bySoc.get(q), via: null}] : [];
  const ws = words(q);
  if (!ws.length) return [];
  const best = new Map();
  const consider = (soc, title, kind) => {
    const low = fold(title);
    if (!ws.every((w) => low.includes(w))) return;
    const phrase = ws.join(' ');
    const score = low === q ? 6 : low.startsWith(q) ? 5 : low.includes(q) ? 4 : low.startsWith(phrase) ? 3.5 : new RegExp('\\b' + escapeRe(ws[0])).test(low) ? 3 : 2;
    const cur = best.get(soc);
    if (!cur || score + kind > cur.score) best.set(soc, {score: score + kind, via: title});
  };
  for (const o of occs) consider(o.soc, o.title, 3);         // an official title containing the phrase beats an exact alternate title
  if (titles) for (const [, soc, orig] of titles) if (bySoc.has(soc)) consider(soc, orig, 0);
  return [...best].map(([soc, b]) => ({o: bySoc.get(soc), via: b.via, score: b.score}))
    .sort((a, b) => b.score - a.score || (b.o.jobs || 0) - (a.o.jobs || 0)).slice(0, limit)
    .map(({o, via}) => ({o, via: fold(via) === fold(o.title) ? null : via}));
}
