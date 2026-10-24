// Charts. Every chart returns plain DOM, has a text alternative, and never relies on color alone:
// series differ by dash and end-marker shape, and each line is labeled at its end.
import {h, svg} from './util.js';

function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

function marker(shape, x, y, color) {
  if (shape === 'square') return svg('rect', {x: x - 4, y: y - 4, width: 8, height: 8, fill: color});
  if (shape === 'diamond') return svg('path', {d: `M${x} ${y - 5.5}L${x + 5.5} ${y}L${x} ${y + 5.5}L${x - 5.5} ${y}Z`, fill: color});
  return svg('circle', {cx: x, cy: y, r: 4, fill: color});
}

/**
 * One line chart for every time series in the app.
 * series: [{name, color, dash, shape, points: [[x, y|null], ...]}]   xTicks: [[x, label], ...]
 * Options: yMin, yMax, yTicks, yFmt, endFmt, desc (text alternative), guide: {x1, x2, y} dotted reference.
 */
export function lineChart({series, xTicks, yMin = 0, yMax, yTicks, yFmt = (v) => v, endFmt = yFmt, desc, guide, W = Math.min(640, Math.max(300, document.documentElement.clientWidth - 110)), H = 200, right = 64}) {  // W tracks the screen so chart text stays readable on phones
  const L = 46, T = 14, B = 28;
  const pts = series.flatMap((s) => s.points.filter((p) => p[1] != null));
  const xs = pts.map((p) => p[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const hi = yMax ?? Math.max(1, ...pts.map((p) => p[1])) * 1.15;
  const x = (v) => L + (v - x0) * (W - L - right) / Math.max(1e-9, x1 - x0);
  const y = (v) => T + (H - T - B) * (1 - (v - yMin) / (hi - yMin));
  const root = svg('svg', {viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': desc, style: `max-width:${W}px`});
  for (const v of yTicks || [yMin, (yMin + hi) / 2]) {
    root.append(svg('line', {x1: L, x2: W - right, y1: y(v), y2: y(v), class: 'grid'}),
      svg('text', {x: L - 6, y: y(v) + 4, 'text-anchor': 'end'}, yFmt(v)));
  }
  for (const [v, label] of xTicks) root.append(svg('text', {x: x(v), y: H - 8, 'text-anchor': 'middle'}, label));
  if (guide) root.append(svg('line', {x1: x(guide.x1), x2: x(guide.x2), y1: y(guide.y), y2: y(guide.y), class: 'guide'}));
  // End labels: nudge apart so two lines that finish close together stay readable.
  const ends = series.map((s) => {
    const last = s.points.filter((p) => p[1] != null).slice(-1)[0];
    return last && {s, last, ly: y(last[1])};
  }).filter(Boolean).sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < ends.length; i++) if (ends[i].ly - ends[i - 1].ly < 18) ends[i].ly = ends[i - 1].ly + 18;
  for (const s of series) {
    const runs = [];
    let run = [];
    for (const [px, py] of s.points) { if (py == null) { if (run.length) runs.push(run); run = []; } else run.push([x(px), y(py)]); }
    if (run.length) runs.push(run);
    for (const r of runs) if (r.length > 1) root.append(svg('polyline', {points: r.map((p) => p.join(',')).join(' '), fill: 'none', stroke: s.color, 'stroke-width': 2.25, 'stroke-dasharray': s.dash || null, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'}));
  }
  for (const e of ends) {
    root.append(marker(e.s.shape, x(e.last[0]), y(e.last[1]), e.s.color),
      svg('text', {x: x(e.last[0]) + 10, y: e.ly + 4, class: 'endlabel', fill: 'currentColor'}, endFmt(e.last[1])));
  }
  const legend = h('div', {class: 'legend'}, series.map((s) => h('span', {style: `--c:${s.color}`, class: 'key ' + (s.dash ? 'dashed' : '')}, s.name)));
  return h('div', {class: 'spark'}, legend, root);
}

/**
 * Scatter of occupations. points: [{id, x, y, r, fill, title, lines: [text], selected}]
 * Pointer users get hover tooltips and click-to-open. Keyboard users get the same data in the table below the chart.
 */
export function scatter({points, xDomain = [0, 100], yDomain, xLabel, yLabel, xFmt = (v) => v, yFmt = (v) => v, onPick, desc, W = 760, H = 420, rMax = 20}) {
  const m = {t: 14, r: 16, b: 48, l: 54};
  const [y0, y1] = yDomain;
  const x = (v) => m.l + (v - xDomain[0]) / (xDomain[1] - xDomain[0]) * (W - m.l - m.r);
  const y = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const rmax = Math.max(1, ...points.map((p) => p.r));
  const rad = (v) => 2.5 + (rMax - 2.5) * Math.sqrt(v / rmax);
  const root = svg('svg', {viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': desc});
  for (const v of niceTicks(y0, y1, 6)) {
    root.append(svg('line', {x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: v === 0 ? 'zero' : 'grid'}),
      svg('text', {x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end'}, yFmt(v)));
  }
  for (const v of niceTicks(xDomain[0], xDomain[1], 5)) root.append(svg('text', {x: x(v), y: H - m.b + 18, 'text-anchor': 'middle'}, xFmt(v)));
  root.append(svg('text', {x: (m.l + W - m.r) / 2, y: H - 8, 'text-anchor': 'middle', class: 'axlabel'}, xLabel),
    svg('text', {transform: `translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`, 'text-anchor': 'middle', class: 'axlabel'}, yLabel));
  const tip = h('div', {class: 'tip', role: 'presentation', hidden: true});
  const wrap = h('div', {class: 'plot'}, root, tip);
  const g = svg('g');
  [...points].sort((a, b) => b.r - a.r).forEach((p) => {
    const c = svg('circle', {cx: x(p.x), cy: y(p.y), r: rad(p.r), fill: p.fill, class: 'dot' + (p.selected ? ' sel' : '')});
    c.addEventListener('pointermove', (ev) => {
      const b = wrap.getBoundingClientRect();
      tip.hidden = false;
      tip.replaceChildren(h('b', {}, p.title), ...p.lines.map((t) => h('div', {}, t)));
      const left = Math.min(Math.max(0, ev.clientX - b.left + 14), b.width - tip.offsetWidth);
      tip.style.left = left + 'px'; tip.style.top = Math.max(0, ev.clientY - b.top - tip.offsetHeight - 10) + 'px';
    });
    c.addEventListener('pointerleave', () => { tip.hidden = true; });
    c.addEventListener('click', () => onPick(p.id));
    g.append(c);
  });
  root.append(g);
  const sel = points.find((p) => p.selected);
  if (sel) { const flip = x(sel.x) > W * 0.6; root.append(svg('text', {x: x(sel.x) + (flip ? -1 : 1) * (rad(sel.r) + 6), y: y(sel.y) + 4, class: 'selabel', 'text-anchor': flip ? 'end' : 'start'}, sel.title)); }
  return wrap;
}
