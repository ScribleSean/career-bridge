import {h, fmt, src} from '../util.js';
import {JOBS} from '../survey.js';

export function renderOverview(root, ctx) {
  const {model} = ctx;
  const step = (n, title, body) => h('li', {class: 'step'}, h('span', {class: 'num', 'aria-hidden': 'true'}, n), h('div', {}, h('h3', {}, title), h('p', {}, body)));

  root.replaceChildren(h('div', {class: 'overview'},
    h('section', {class: 'hero'},
      h('h2', {id: 'view-title', tabindex: '-1'}, 'How are people in these jobs actually using AI?'),
      h('p', {class: 'herolede'}, 'Career Bridge is a short, repeatable survey that asks workers and employers directly, published only as totals.'),
      h('div', {class: 'actions'}, h('a', {class: 'btn primary', href: '#/results'}, 'See sample results'), h('a', {class: 'btn', href: '#/survey'}, 'Try the survey'))),

    h('section', {class: 'band'}, h('h2', {}, 'What we found'),
      h('div', {class: 'finding'},
        h('div', {class: 'fig'}, h('span', {class: 'v'}, '526,000'), h('a', {class: 'srclink', href: '#/about?at=workers526', 'aria-label': 'Sources: Lightcast, BLS OEWS May 2025. Opens the sources and definition on About'}, src('lc', 'oews'))),
        h('p', {}, h('b', {}, 'Massachusetts workers are in jobs where AI overlaps with much of the work, yet under 1% of job ads for those jobs mention AI skills.'))),
      h('p', {class: 'bandtext'}, 'Employers aren’t asking for AI skills in ads. That could mean these jobs don’t need AI skills, or that people are already using AI and no one is asking. Ads can’t tell the difference. Asking people can.')),

    h('section', {}, h('h2', {class: 'sech'}, 'The survey'),
      h('ol', {class: 'steps'},
        step('1', 'Ask', 'It takes about five minutes. Workers say which work activities they do and where AI helps. Employers say what the role needs and what is becoming more important.'),
        step('2', 'Line it up', 'Questions use the work activities O*NET lists for each job, so answers compare with O*NET and Lightcast data for the same job. The survey adds three AI activities O*NET doesn’t track yet, such as checking AI output.'),
        step('3', 'Publish totals', 'Results show only totals by job and region, and any group under 10 responses stays hidden. The survey doesn’t ask for names or company names.'),
        step('4', 'Act', 'A workforce board can see who is already using AI, what employers want next, and who should get AI training.'))),

    h('section', {class: 'panel'}, h('h3', {}, 'Three jobs to start'),
      h('ul', {class: 'jobcards'}, JOBS.map((j) => {
        const o = model.bySoc.get(j.soc);
        return h('li', {class: 'jobcard'}, h('h3', {}, j.short),
          h('p', {}, o?.jobs == null ? 'Not enough data' : [h('b', {}, fmt.n(o.jobs)), ` ${model.geo === 'US' ? 'US' : 'Massachusetts'} workers · median pay `, h('b', {}, o.wage == null ? 'Not enough data' : fmt.usd(o.wage))]),
          src('oews'),
          h('div', {class: 'actions'}, h('a', {class: 'btn', href: ctx.hrefJob(j.soc)}, 'Job details'), h('a', {class: 'btn', href: `#/results?job=${j.soc}`}, 'Sample results')));
      }))),

    h('section', {class: 'panel pilot'}, h('h3', {}, 'Proposed: a one-quarter pilot'),
      h('dl', {class: 'pilotgrid'},
        h('div', {}, h('dt', {}, 'Where'), h('dd', {}, 'One region, run with its MassHire workforce board, for example Central Massachusetts')),
        h('div', {}, h('dt', {}, 'How'), h('dd', {}, 'Through channels people already use: career center intake and workforce board employer meetings. No new site to join.')),
        h('div', {}, h('dt', {}, 'Size'), h('dd', {}, 'About 100 worker responses and 25 employer responses for each of the three jobs')),
        h('div', {}, h('dt', {}, 'Result'), h('dd', {}, 'A short report the board can use to target AI training, such as the state’s free AI courses, and a question set it can repeat each year')))),

    h('section', {class: 'band light'}, h('h2', {}, 'For career counselors'),
      h('p', {class: 'bandtext'}, 'Look up any job for pay, growth, training, how much AI is already used on the work, and jobs with similar skills and the skills to build. Every number names its source.'),
      h('div', {class: 'actions'}, h('a', {class: 'btn primary', href: ctx.hrefJob('43-6014')}, 'Look up a job')))));
}
