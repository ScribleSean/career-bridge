// Every chart has a text alternative and never relies on color alone:
// series differ by dash and end-marker shape, and each line is labeled at its end.
import {h, svg} from './util.js';

function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

export function barList(rows, {fmt = (v) => String(v), unit = ''} = {}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  const ticks = niceTicks(0, max || 1, 4);
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : (max || 1);
  while (ticks[ticks.length - 1] < max) ticks.push(+(ticks[ticks.length - 1] + step).toPrecision(12));
  const top = ticks[ticks.length - 1] || 1;
  const pos = (v) => `${(100 * v) / top}%`;
  const axis = h('div', {class: 'baxis', 'aria-hidden': 'true'}, ticks.map((t) => h('span', {style: `left:${pos(t)}`}, fmt(t))));
  return h('div', {class: 'blist'}, unit ? h('p', {class: 'bunit'}, unit) : null, axis,
    h('ul', {}, rows.map((r) => h('li', {},
      h('span', {class: 'bl'}, r.label),
      h('span', {class: 'btrack', role: 'img', 'aria-label': `${r.label}: ${fmt(r.value)}${unit ? ' ' + unit : ''}`},
        ticks.map((t) => h('i', {class: 'bgrid', style: `left:${pos(t)}`})),
        h('span', {class: 'bfill', style: `width:${pos(r.value)}`}),
        h('b', {class: 'bval'}, fmt(r.value)))))));
}

function marker(shape, x, y, color) {
  if (shape === 'square') return svg('rect', {x: x - 4, y: y - 4, width: 8, height: 8, fill: color});
  if (shape === 'diamond') return svg('path', {d: `M${x} ${y - 5.5}L${x + 5.5} ${y}L${x} ${y + 5.5}L${x - 5.5} ${y}Z`, fill: color});
  return svg('circle', {cx: x, cy: y, r: 4, fill: color});
}

const chartWidth = () => Math.min(640, Math.max(300, document.documentElement.clientWidth - 110));

export function lineChart({series, xTicks, yMin = 0, yMax, yTicks, yFmt = (v) => v, endFmt = yFmt, desc, guide, W = chartWidth(), H = 200, right = 64}) {
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
