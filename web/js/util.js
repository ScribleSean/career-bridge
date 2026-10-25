// Small DOM and formatting helpers shared by every view. No dependencies.

export const $ = (id) => document.getElementById(id);

/** h('div', {class: 'x', onclick: fn}, 'text', childNode, [more]) -> element. Attribute values of null/false are skipped. */
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}

export function svg(tag, attrs = {}, ...kids) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}

export const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
};

const nf = new Intl.NumberFormat('en-US');
const compactNf = new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1});
const MINUS = '−';
export const fmt = {
  n: (v) => (v == null ? '—' : nf.format(Math.round(v))),
  compact: (v) => (v == null ? '—' : compactNf.format(v)),
  usd: (v) => (v == null ? '—' : '$' + nf.format(Math.round(v))),
  usdDiff: (v) => (v == null ? '—' : (v >= 0 ? '+' : MINUS) + '$' + nf.format(Math.abs(Math.round(v / 100) * 100))),
  pct: (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d) + '%'),
  signed: (v, d = 1) => (v == null ? '—' : (v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v).toFixed(d) + '%'),
  signedN: (v) => (v == null ? '—' : (v > 0 ? '+' : v < 0 ? MINUS : '') + nf.format(Math.abs(Math.round(v)))),
  ord(n) {
    n = Math.round(n);
    const t = n % 100;
    return n + ((t > 10 && t < 14) ? 'th' : ({1: 'st', 2: 'nd', 3: 'rd'}[n % 10] || 'th'));
  },
};

/** Screen-reader announcement through the polite live region in index.html. */
let announceTimer;
export function announce(msg) {
  const el = $('live');
  if (!el) return;
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { el.textContent = ''; el.textContent = msg; }, 150);
}

/** Source tags: every figure names where it comes from. Lightcast is the core dataset, so its tag is highlighted. */
const SRC = {lc: ['Lightcast', 'lc'], oews: ['BLS OEWS May 2025', ''], oewsh: ['BLS OEWS 2019–2025', ''], onet: ['O*NET 31.0', ''], aei: ['Anthropic Economic Index', ''], sig: ['Career Bridge signals · sample', 'sgn']};
export const src = (...keys) => h('span', {class: 'srcs'}, h('span', {class: 'sr'}, 'Source: '), keys.map((k) => h('span', {class: ('src ' + SRC[k][1]).trim()}, SRC[k][0])));

/** Marks a what-if model as experimental: shown on every 2031 projection. */
export const experimental = () => h('p', {class: 'warn'}, h('b', {}, 'Experimental.'), ' A what-if, not a forecast. It hasn’t been checked against what actually happened to jobs.');
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const loading = (msg) => h('div', {class: 'status', role: 'status'}, h('div', {class: 'spinner', 'aria-hidden': 'true'}), h('span', {}, msg));
export const errorBox = (msg, retry) => h('div', {class: 'status err', role: 'alert'}, h('span', {}, msg), retry ? h('button', {type: 'button', onclick: retry}, 'Try again') : null);
