// What the measures mean, where the data comes from, and what it cannot tell you.
import {h, fmt} from '../util.js';
import {barList} from '../charts.js';

export function renderAbout(root, ctx) {
  const {model} = ctx;
  const u = model.usage, work = u.use_case.find((c) => c.name === 'Work');
  const sec = (title, ...kids) => h('section', {class: 'about-sec'}, h('h3', {}, title), ...kids);
  root.replaceChildren(h('div', {class: 'aboutview'},
    h('header', {class: 'viewhead'}, h('h2', {id: 'view-title', tabindex: '-1'}, 'About the numbers')),
    h('div', {class: 'panel about'},
      sec('What “how much Claude is used” means',
        h('p', {}, 'Claude is an AI assistant. Anthropic, the company that makes it, publishes what people ask it to do. We put each job on a scale from the lowest to the highest of all jobs, using two clues: how often people ask Claude about that job’s work (compared with how many people have the job), and how closely the job’s day-to-day tasks match what people use Claude for.'),
        h('p', {}, 'For some jobs, Anthropic didn’t publish usage, so we used the tasks alone. Those are marked as a rougher guess.'),
        model.full ? h('p', {}, h('b', {}, 'The four groups.'), ' “More AI overlap” means a Lightcast score above 50, where Lightcast’s Medium-high and High bands start. “Employers ask” means at least 6.18% of Massachusetts job ads ask for AI skills, the statewide rate in 2025. The broad gap is more overlap with fewer employers asking. The silent gap is the stricter part of the broad gap: under 1% of the job’s ads ask for AI skills. The two lower-overlap groups split the same way: low signal (under 6.18%) and higher signal.') : null,
        model.full ? h('p', {}, h('b', {}, 'What AI could do in the job'), ' comes from Lightcast, a labor-market data company. It scores how much of a job’s skills and tasks overlap with what AI can do today. ', h('b', {}, 'Employers asking for AI skills'), ' is the share of Massachusetts job ads that name at least one AI skill.')
          : h('p', {}, 'Some measures from Lightcast, a labor-market data company, and the view for workforce boards are left out of this version. That data is licensed and can’t be shared publicly.')),
      sec('How the 2031 “what if” works',
        h('p', {}, 'We start with how fast each job grew from 2019 to 2025 and keep that going to 2031. Then we ask: what if AI took on some of the work? The what-if then lowers that count using four things: how much of the work AI takes on, how much of that means fewer jobs instead of saved time, how much Claude is used on this job, and how often people hand work off to Claude instead of working with it. You pick the first two with the sliders. The “medium” setting is ', fmt.pct(model.meta.scenarios.base.A * 100, 0), ' of the work taken on, with ', fmt.pct(model.meta.scenarios.base.P * 100, 0), ' of that meaning fewer jobs.'),
        h('p', {}, 'These are guesses to explore, not forecasts. Nothing here has been checked against what actually happened to jobs after Claude came out. The data can’t show that yet. The 2026 jobs numbers will be the first that could.'),
        h('details', {class: 'more'}, h('summary', {}, 'The exact math'), h('div', {class: 'morebody'},
          h('p', {}, 'Jobs in 2031 = jobs today × (1 + yearly growth)', h('sup', {}, '6'), ' × (1 − adoption × share that means fewer jobs × Claude-use score × handoff share).'),
          h('p', {}, 'Yearly growth is the US average from 2019 to 2025, capped at the 5th and 95th percentile of jobs so a few odd cases don’t skew the picture.')))),
      sec('How people use Claude',
        h('p', {}, `In ${model.meta.usage_period}, ${fmt.pct(work.may, 0)} of US Claude.ai conversations were about work, ${fmt.pct(u.use_case.find((c) => c.name === 'Personal').may, 0)} were personal and ${fmt.pct(u.use_case.find((c) => c.name === 'Coursework').may, 0)} were for school. Work use held steady between the two months. Personal use went up and school use went down, which looks like the end of a school term, not a lasting change. Only two months have been published, so we can’t say where things are heading.`),
        h('div', {class: 'topics'}, h('h4', {}, 'What people ask Claude for, May 2026'),
          barList(u.topics.slice(0, 8).map((t) => ({label: t.name, value: t.may})), {fmt: (v) => (v === 0 ? '0' : v.toFixed(v < 1 ? 1 : 0)) + '%', unit: 'of US Claude conversations, May 2026'}))),
      sec('What this can’t tell you',
        h('ul', {class: 'notes'},
          h('li', {}, 'It shows where Claude is used. It doesn’t predict that jobs will disappear. Often AI just helps people do the work.'),
          h('li', {}, 'Claude is one AI tool. The numbers count conversations, not workers, and they include personal and school use.'),
          h('li', {}, 'Pay is the typical (median) yearly pay. It leaves out benefits and self-employed people. The job counts are jobs, not people, so someone with two jobs counts twice.'),
          h('li', {}, 'Recent growth is a national number. The pandemic, interest rates and tech layoffs all overlap 2019 to 2025.'),
          h('li', {}, 'The other jobs we suggest are ideas to talk through with a career advisor. Licenses, what’s hiring near you, and your own experience aren’t in the data.'),
          h('li', {}, '“Is this job following software?” places a job’s job-ad demand for generative-AI skills on the path software took (Lightcast). It is a position, not a timeline: since 2024 other jobs have moved at about half to four-fifths of software’s speed.'),
          h('li', {}, 'Job growth in Massachusetts shows what happened from 2019 to 2025 (BLS OEWS), not why.'),
          h('li', {}, 'We don’t have race, gender or age numbers yet.'))),
      sec('Where the numbers come from', h('ul', {class: 'notes'}, [...model.meta.sources, ...(model.full ? ['Lightcast AI Exposure and Adoption by Occupation, 2023 to Sep 2026. Data Source: Lightcast, 2026.'] : [])].map((s) => h('li', {}, s)))),
      h('p', {class: 'foot'}, `${model.all.length} jobs · built ${(model.meta.built_at || '').slice(0, 10)} · ${model.full ? 'private version with Lightcast data' : 'public version'}`))));
}
