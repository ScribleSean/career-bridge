// Sortable table used by Explore and the workforce board. The first column is a real link, so keyboard and
// screen-reader users reach every job without the chart. Clicking anywhere else in a row opens it too.
import {h} from './util.js';

/** Sort rows by a column; empty values always go last. */
export function sortRows(rows, col, dir) {
  const val = (r) => { const v = col.value(r); return typeof v === 'string' ? v.toLowerCase() : v; };
  const present = rows.filter((r) => val(r) != null), missing = rows.filter((r) => val(r) == null);
  present.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'desc' ? -1 : 1); });
  return present.concat(missing);
}

/** columns: [{key, label, num, opt, value(row), cell(row) -> node|string, first}]  sort: {key, dir} */
export function dataTable({caption, columns, rows, sort, onSort, href, onOpen}) {
  const head = h('tr', {}, columns.map((c) => h('th', {scope: 'col', class: [c.num ? 'n' : '', c.opt ? 'opt' : ''].join(' ').trim() || null,
    'aria-sort': sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'},
    h('button', {type: 'button', id: 'sort-' + c.key, onclick: () => onSort(c.key, sort.key === c.key ? (sort.dir === 'asc' ? 'desc' : 'asc') : (c.num ? 'desc' : 'asc'))},
      c.label, h('span', {class: 'arr', 'aria-hidden': 'true'}, sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '')))));
  const body = rows.map((r) => h('tr', {onclick: (e) => { if (!e.target.closest('a,button')) onOpen(r); }},
    columns.map((c) => {
      const content = c.cell ? c.cell(r) : c.value(r);
      return h('td', {class: [c.num ? 'n' : '', c.opt ? 'opt' : '', c.first ? 'title' : ''].join(' ').trim() || null},
        c.first ? h('a', {href: href(r)}, content) : content);
    })));
  return h('div', {class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': caption + ' (scrollable)'},
    h('table', {}, h('caption', {class: 'sr'}, caption), h('thead', {}, head), h('tbody', {}, body.length ? body : h('tr', {}, h('td', {colspan: columns.length, class: 'empty'}, 'No jobs match these filters.')))));
}
