import {h} from '../util.js';
import {PULSE} from '../pulse.js';

const day = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});

export function renderPulse(root, ctx, p = PULSE) {
  const {model} = ctx;
  const card = (j) => {
    const o = model.bySoc.get(j.soc);
    return h('li', {class: 'pulsecard'},
      h('h3', {}, o ? h('a', {href: ctx.hrefJob(j.soc)}, o.title) : j.soc),
      j.items.length
        ? h('ul', {class: 'pulseitems'}, j.items.map((i) => h('li', {},
          h('p', {}, i.what),
          h('div', {class: 'srcs'}, h('span', {class: 'sr'}, 'Source: '),
            h('a', {class: 'src', href: i.url, target: '_blank', rel: 'noopener'}, `${i.product} · ${day(i.date)}`),
            (i.flags || []).map((f) => h('span', {class: 'flag'}, f))))))
        : h('p', {class: 'empty'}, 'Nothing confirmed in this issue'),
      h('div', {class: 'learn'}, h('span', {}, 'Learn next'), h('span', {class: 'tag'}, j.learn.name, h('em', {}, `${j.learn.im.toFixed(2)} of 5`)),
        h('span', {class: 'srcs'}, h('span', {class: 'src'}, 'O*NET 31.0'))));
  };
  root.replaceChildren(h('div', {class: 'pulseview'},
    h('header', {class: 'viewhead'}, h('h2', {id: 'view-title', tabindex: '-1'}, `New for AI at work · ${p.issue}`),
      h('p', {class: 'meta'}, `${day(p.from)} to ${day(p.to)} · `, h('a', {href: '#/about?at=pulse'}, 'How we check'))),
    h('ul', {class: 'pulsecards'}, p.jobs.map(card))));
}
