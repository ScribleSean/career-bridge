// Overview: the case for Career Bridge as shared public infrastructure, written for state and workforce leaders.
import {h} from '../util.js';
import {SKILL, allSignals, market} from '../signals.js';

const MASSHIRE_URL = 'https://www.mass.gov/orgs/masshire-department-of-career-services';

export function renderOverview(root, ctx) {
  const m = market(allSignals(ctx.model));
  const short = m.rows.filter((r) => r.flag === 'shortage').slice(0, 3);
  const step = (n, title, body) => h('li', {class: 'step'}, h('span', {class: 'num', 'aria-hidden': 'true'}, n), h('div', {}, h('h3', {}, title), h('p', {}, body)));
  const stat = (v, k, s) => h('div', {class: 'bigstat'}, h('span', {class: 'v'}, v), h('span', {class: 'k'}, k), s ? h('span', {class: 's'}, s) : null);

  root.replaceChildren(h('div', {class: 'overview'},
    h('section', {class: 'hero'},
      h('h2', {id: 'view-title', tabindex: '-1'}, 'A public skills signal for Massachusetts'),
      h('p', {class: 'herolede'}, 'Workers and employers say which skills jobs really use. People who know the work confirm it. Career centers and training providers could see where the gaps are, by skill and region.'),
      h('div', {class: 'actions'}, h('a', {class: 'btn primary', href: '#/market'}, 'See the skills market'), h('a', {class: 'btn', href: '#/signals'}, 'Browse skill signals'))),

    h('section', {class: 'band'}, h('h2', {}, 'The signal is missing'),
      h('div', {class: 'stats3'},
        stat('526,000', 'Massachusetts workers in the silent gap', 'Jobs with high AI overlap where under 1% of job ads ask for AI skills (Lightcast, 2025; BLS OEWS)'),
        stat('6.18%', 'of Massachusetts job ads ask for any AI skill', 'Lightcast, 2025'),
        stat('Years', 'for official skill lists to update', 'O*NET surveys refresh job by job over several years')),
      h('p', {class: 'bandtext'}, 'Employers aren’t telling workers what they need, and job ads are a slow, noisy proxy. Workers can’t tell what to learn, and training money can’t tell where to go.')),

    h('section', {}, h('h2', {class: 'sech'}, 'How it works'),
      h('ol', {class: 'steps'},
        step('1', 'Workers signal', 'Say which skills your job really uses, and where AI helps. From a shared list built on O*NET, plus new skills it doesn’t track yet.'),
        step('2', 'Employers signal', 'Say what a role needs and which skills are becoming more important. A direct signal, not a job ad.'),
        step('3', 'People verify', 'Coworkers vouch. Employers and career centers verify. Nobody confirms their own.'),
        step('4', 'The market adds it up', 'Demand from employers against verified supply from workers, by skill and region. Shortages show where training should go.'))),

    short.length ? h('section', {class: 'panel'}, h('h3', {}, 'Shortages in the demo market (sample data)'),
      h('ul', {class: 'shortlist'}, short.map((r) => h('li', {}, h('b', {}, SKILL[r.id].label), ` · employers want it ${r.index === Infinity ? 'with no verified supply yet' : r.index.toFixed(1) + '× more than verified workers report it'}`))),
      h('p', {}, h('a', {href: '#/market'}, 'Open the skills market'), ' · sample data')) : null,

    h('section', {class: 'two'},
      h('div', {class: 'panel'}, h('h3', {}, 'Proposed: why public infrastructure'),
        h('ul', {class: 'ticks'},
          h('li', {}, 'Free for workers and employers. No ads, no selling data.'),
          h('li', {}, 'Neutral ground: no single employer or vendor owns the signal.'),
          h('li', {}, 'Plugs into what exists: MassHire career centers could verify and route training funds.'),
          h('li', {}, 'One open skills vocabulary built on O*NET, so the data works with federal and state systems.'))),
      h('div', {class: 'panel'}, h('h3', {}, 'Proposed: privacy and governance'),
        h('ul', {class: 'ticks'},
          h('li', {}, 'Workers would choose what to share, with names private unless they opt in.'),
          h('li', {}, 'Employers would be verified, for example through MassHire, before their signals count.'),
          h('li', {}, 'Only totals by skill and region would be published, never individual records.'),
          h('li', {}, 'AI overlap is shown as overlap, never as a prediction of job loss.')))),

    h('section', {class: 'panel pilot'}, h('h3', {}, 'Proposed: a 90-day pilot'),
      h('dl', {class: 'pilotgrid'},
        h('div', {}, h('dt', {}, 'Where'), h('dd', {}, 'One MassHire region, such as Central Massachusetts')),
        h('div', {}, h('dt', {}, 'Jobs'), h('dd', {}, 'Three silent-gap jobs: administrative assistants, customer service representatives, retail salespeople')),
        h('div', {}, h('dt', {}, 'Partners'), h('dd', {}, 'The regional MassHire career center and workforce board, a community college, 20 to 30 employers')),
        h('div', {}, h('dt', {}, 'Goal'), h('dd', {}, '500 worker signals, 60% verified, and one training cohort aimed at a verified shortage'))),
      h('p', {}, h('a', {href: MASSHIRE_URL, target: '_blank', rel: 'noopener'}, 'About MassHire'), ' · Career Bridge is an independent student project, not affiliated with MassHire.')),

    h('section', {class: 'band light'}, h('h2', {}, 'For workers today'),
      h('p', {class: 'bandtext'}, 'Look up any job for pay, growth, how much people already use AI on the work, and a plan with nearby jobs and the skills to build.'),
      h('div', {class: 'actions'}, h('a', {class: 'btn primary', href: ctx.hrefJob('43-6014')}, 'Look up a job'), h('a', {class: 'btn', href: '#/post'}, 'Post a skill signal')))));
}
