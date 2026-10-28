// The AI-at-work survey (#/survey) and its results (#/results). Results are totals only, with small groups hidden.
import {h, announce, fmt, src} from '../util.js';
import {JOBS, jobShort, ACT, actsFor, REGIONS, AI_LEVELS, WORKER_Q, EMPLOYER_Q, submit, totals, MIN_CELL, myCount, resetMine} from '../survey.js';

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const sampleNote = () => h('p', {class: 'warn'}, h('b', {}, 'Sample results. '), 'These responses are made up to show how the totals would read. They are not real survey data.');

/* ------------------------------------------------------------------ the survey */
export function renderSurvey(root, ctx, params) {
  const job = JOBS.find((j) => j.soc === params.job);
  const as = ['worker', 'employer'].includes(params.as) ? params.as : '';
  if (!job || !as) return renderPick(root, ctx);
  const {model} = ctx;
  const acts = actsFor(job.soc, model.plans);
  const radios = (name, opts, required = true) => h('div', {class: 'opts'}, opts.map(([v, label], i) =>
    h('label', {}, h('input', {type: 'radio', name, value: v, required: required && i === 0}), label)));
  const checks = (name, opts) => h('div', {class: 'opts'}, opts.map(([v, label]) => h('label', {}, h('input', {type: 'checkbox', name, value: v}), label)));
  const q = (n, text, body) => h('fieldset', {class: 'q'}, h('legend', {}, h('span', {class: 'qn'}, n), text), body);
  const region = h('select', {name: 'region', required: true}, h('option', {value: ''}, 'Choose a region'), REGIONS.map((x) => h('option', {value: x}, x)));
  const msg = h('p', {class: 'formmsg', role: 'alert'});

  const actGrid = as === 'worker'
    ? h('table', {class: 'qtable'}, h('thead', {}, h('tr', {}, h('th', {scope: 'col'}, 'In a typical week'), h('th', {scope: 'col'}, 'I don’t do this'), AI_LEVELS.map(([, l]) => h('th', {scope: 'col'}, l === 'Not at all' ? 'I do it, AI doesn’t help' : `I do it, AI helps ${l.toLowerCase()}`)))),
        h('tbody', {}, acts.map((id) => h('tr', {class: ACT[id].onet ? null : 'newrow'}, h('th', {scope: 'row'}, ACT[id].label, ACT[id].onet ? null : h('span', {class: 'newtag'}, 'not in O*NET')),
          h('td', {'data-label': 'I don’t do this'}, h('input', {type: 'radio', name: 'a-' + id, value: '', 'aria-label': `${ACT[id].label}: I don’t do this`, checked: true})),
          AI_LEVELS.map(([v, l]) => h('td', {'data-label': l === 'Not at all' ? 'I do it, AI doesn’t help' : `AI helps ${l.toLowerCase()}`}, h('input', {type: 'radio', name: 'a-' + id, value: v, 'aria-label': `${ACT[id].label}: ${l}`})))))))
    : h('table', {class: 'qtable'}, h('thead', {}, h('tr', {}, h('th', {scope: 'col'}, 'This role'), h('th', {scope: 'col'}, 'Needs it now'), h('th', {scope: 'col'}, 'Becoming more important'))),
        h('tbody', {}, acts.map((id) => h('tr', {class: ACT[id].onet ? null : 'newrow'}, h('th', {scope: 'row'}, ACT[id].label, ACT[id].onet ? null : h('span', {class: 'newtag'}, 'not in O*NET')),
          h('td', {'data-label': 'Needs it now'}, h('input', {type: 'checkbox', name: 'need', value: id, 'aria-label': `${ACT[id].label}: needs it now`})),
          h('td', {'data-label': 'Becoming more important'}, h('input', {type: 'checkbox', name: 'grow', value: id, 'aria-label': `${ACT[id].label}: becoming more important`}))))));

  const form = h('form', {class: 'panel survey', onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!f.get('region')) { msg.textContent = 'Choose a region.'; return; }
    let resp;
    if (as === 'worker') {
      const a = {};
      for (const id of acts) { const v = f.get('a-' + id); if (v) a[id] = v; }
      if (Object.keys(a).length < 2) { msg.textContent = 'Tell us about at least two activities you do.'; return; }
      resp = {side: 'worker', soc: job.soc, region: f.get('region'), acts: a, tools: f.getAll('tools').length ? f.getAll('tools') : ['none'], trained: f.get('trained'), help: f.getAll('help'), years: f.get('years')};
    } else {
      const need = Object.fromEntries(f.getAll('need').map((id) => [id, true]));
      if (Object.keys(need).length < 2) { msg.textContent = 'Mark at least two activities the role needs.'; return; }
      resp = {side: 'employer', soc: job.soc, region: f.get('region'), need, growing: f.getAll('grow'), ads: f.get('ads'), train: f.get('train'), size: f.get('size')};
    }
    if (!submit(resp)) { msg.textContent = 'Could not save your answers. Try again.'; return; }
    announce('Thank you. Your answers were saved.');
    root.replaceChildren(h('div', {class: 'surveyview'}, h('header', {class: 'viewhead'}, h('h2', {id: 'view-title', tabindex: '-1'}, 'Thank you')),
      h('section', {class: 'panel'},
        h('div', {class: 'actions'}, h('a', {class: 'btn primary', href: `#/results?job=${job.soc}&source=mine`}, 'See the results'), h('a', {class: 'btn', href: '#/survey'}, 'Answer for another job')))));
    document.getElementById('view-title').focus();
  }},
    q(1, 'Where do you work?', h('label', {class: 'sel'}, h('span', {class: 'sr'}, 'Region'), region)),
    q(2, as === 'worker' ? 'Which of these do you do, and does AI help?' : 'Which of these does the role need?', h('div', {class: 'tablewrap'}, actGrid)),
    ...(as === 'worker'
      ? [q(3, WORKER_Q.tools.q, checks('tools', WORKER_Q.tools.opts.filter(([v]) => v !== 'none'))), q(4, WORKER_Q.trained.q, radios('trained', WORKER_Q.trained.opts)),
         q(5, WORKER_Q.help.q, checks('help', WORKER_Q.help.opts)), q(6, WORKER_Q.years.q, radios('years', WORKER_Q.years.opts))]
      : [q(3, EMPLOYER_Q.ads.q, radios('ads', EMPLOYER_Q.ads.opts)), q(4, EMPLOYER_Q.train.q, radios('train', EMPLOYER_Q.train.opts)), q(5, EMPLOYER_Q.size.q, radios('size', EMPLOYER_Q.size.opts))]),
    msg,
    h('div', {class: 'actions'}, h('button', {type: 'submit', class: 'btn primary'}, 'Submit'), h('a', {class: 'btn', href: '#/survey'}, 'Back')));

  root.replaceChildren(h('div', {class: 'surveyview'},
    h('header', {class: 'viewhead'}, h('h2', {id: 'view-title', tabindex: '-1'}, `${jobShort(job.soc)}: ${as === 'worker' ? 'how you work' : 'what the role needs'}`),
      h('p', {class: 'lede'}, `${as === 'worker' ? 'About five minutes' : 'About three minutes'}. Stored as-is in this browser until you choose “Clear my answers”.`)),
    form));
}

function renderPick(root, ctx) {
  root.replaceChildren(h('div', {class: 'surveyview'},
    h('header', {class: 'viewhead'}, h('h2', {id: 'view-title', tabindex: '-1'}, 'AI at work: a short survey'),
      h('p', {class: 'lede'}, 'Stored as-is in this browser until you choose “Clear my answers”.')),
    h('ul', {class: 'jobcards'}, JOBS.map((j) => {
      const o = ctx.model.bySoc.get(j.soc);
      return h('li', {class: 'jobcard'}, h('h3', {}, j.short),
        h('p', {class: 'fine'}, o?.jobs == null ? 'Not enough data' : `${fmt.n(o.jobs)} ${ctx.model.geo === 'US' ? 'US' : 'Massachusetts'} workers`), src('oews'),
        h('div', {class: 'actions'}, h('a', {class: 'btn primary', href: `#/survey?job=${j.soc}&as=worker`}, 'I do this job'), h('a', {class: 'btn', href: `#/survey?job=${j.soc}&as=employer`}, 'I hire for this job')));
    })),
    myCount() ? h('p', {class: 'fine'}, `You've answered ${myCount()} time${myCount() === 1 ? '' : 's'} in this browser. `, h('button', {type: 'button', class: 'linkbtn', onclick: () => { if (resetMine()) { renderPick(root, ctx); announce('Your answers were cleared.'); } else { announce('Could not clear your answers. Try again.'); } }}, 'Clear my answers')) : null));
}

/* ------------------------------------------------------------------ results */
export function renderResults(root, ctx, params) {
  const {model} = ctx;
  const job = JOBS.find((j) => j.soc === params.job) || JOBS[0];
  const region = REGIONS.includes(params.region) ? params.region : '';
  const source = params.source === 'mine' ? 'mine' : 'sample';
  const t = totals(job.soc, model.plans, region, source);
  const set = (patch) => ctx.go('results', {...params, ...patch});
  const tile = (v, k, n) => h('div', {class: 'stat'}, h('span', {class: 'v'}, v), h('span', {class: 'k'}, k), h('span', {class: 'n'}, n));
  const hidden = (who, n) => h('p', {class: 'empty'}, `Fewer than ${MIN_CELL} ${who} answered here (${n}), so these totals are hidden.`);

  const rows = t.okW || t.okE ? h('ul', {class: 'res'}, t.acts.map((a) => h('li', {},
    h('div', {class: 'reshead'}, h('b', {}, ACT[a.id].label), ACT[a.id].onet ? null : h('span', {class: 'newtag'}, 'not in O*NET')),
    h('div', {class: 'resbars', role: 'img', 'aria-label': `${ACT[a.id].label}: ${pct(a.doPct)} of workers do it, ${pct(a.aiOften)} with AI most of the time and ${pct(a.aiSome)} sometimes. ${pct(a.needPct)} of employers say the role needs it, ${pct(a.growPct)} say it is becoming more important.`},
      t.okW ? h('span', {class: 'srow'}, h('span', {class: 'strack'}, h('span', {class: 'sfill do', style: `width:${a.doPct * 100}%`}),
        h('span', {class: 'sfill often', style: `width:${a.aiOften * 100}%`}), h('span', {class: 'sfill some', style: `left:${a.aiOften * 100}%;width:${a.aiSome * 100}%`})), h('span', {class: 'sval'}, pct(a.doPct))) : null,
      t.okE ? h('span', {class: 'srow'}, h('span', {class: 'strack'}, h('span', {class: 'sfill need', style: `width:${a.needPct * 100}%`}), h('span', {class: 'stick', style: `left:${a.growPct * 100}%`, title: 'Becoming more important'})), h('span', {class: 'sval'}, pct(a.needPct))) : null)))) : hidden('people', t.nW + t.nE);

  // Where what workers do and what employers say differ most: plain sentences from the totals.
  const gaps = t.okW && t.okE ? t.acts.map((a) => ({a, d: a.growPct - (a.aiOften + a.aiSome)})).filter((x) => !ACT[x.a.id].onet && x.d > 0.05).sort((x, y) => y.d - x.d).slice(0, 3) : [];

  root.replaceChildren(h('div', {class: 'resultsview'},
    h('header', {class: 'viewhead'}, h('h2', {id: 'view-title', tabindex: '-1'}, 'Survey results')),
    h('div', {class: 'segs', role: 'group', 'aria-label': 'Responses'}, [['sample', 'Sample'], ['mine', 'Your answers']].map(([value, label]) =>
      h('button', {type: 'button', class: 'seg', 'aria-pressed': String(source === value), onclick: () => set({source: value})}, label))),
    source === 'sample' ? sampleNote() : h('span', {class: 'src'}, 'Your answers · this browser'),
    h('div', {class: 'boardbar'},
      h('div', {}, h('span', {class: 'lbl', id: 'jl'}, 'Job'), h('div', {class: 'segs', role: 'group', 'aria-labelledby': 'jl'}, JOBS.map((j) => h('button', {type: 'button', class: 'seg', 'aria-pressed': String(j.soc === job.soc), onclick: () => set({job: j.soc})}, j.short)))),
      h('label', {for: 'rr'}, 'Region', h('select', {id: 'rr', onchange: (e) => set({region: e.target.value})}, h('option', {value: ''}, 'All of Massachusetts'), REGIONS.map((x) => h('option', {value: x, selected: x === region}, x))))),
    h('div', {class: 'summary four'},
      tile(pct(t.useAnyAI), 'of workers use an AI tool for work', `${t.nW} workers`),
      tile(pct(t.trainedByEmployer), 'of workers were trained on AI by their employer', `${t.nW} workers`),
      tile(pct(t.adsMentionAI), 'of employers mention AI skills in job ads', `${t.nE} employers`),
      tile(pct(t.employersTrain), 'of employers train this role on AI', `${t.nE} employers`)),
    gaps.length ? h('section', {class: 'panel act'}, h('h3', {}, 'Where workers and employers differ'),
      h('ul', {class: 'ticks plain'}, gaps.map(({a}) => h('li', {}, h('b', {}, ACT[a.id].label), `: ${pct(a.aiOften + a.aiSome)} of workers do it with AI; ${pct(a.growPct)} of employers say it is becoming more important.`)))) : null,
    h('section', {class: 'panel'}, h('h3', {}, 'What the work involves'),
      h('div', {class: 'legend sq'}, h('span', {style: '--c:#B9CDE3'}, 'Workers who do it'), h('span', {style: '--c:#1F6E43'}, 'with AI most of the time'), h('span', {style: '--c:#8CC5A3'}, 'with AI sometimes'), h('span', {style: '--c:#A9441A'}, 'Employers: role needs it'), h('span', {class: 'tk'}, 'Employers: becoming more important')),
      h('div', {class: 'saxis', 'aria-hidden': 'true'}, ['0%', '25%', '50%', '75%', '100%'].map((x, i) => h('span', {style: `left:${i * 25}%`}, x))),
      rows),
    t.okW ? h('section', {class: 'panel'}, h('h3', {}, 'What would help workers most'),
      h('ul', {class: 'res'}, t.help.map((x) => h('li', {}, h('div', {class: 'reshead'}, h('b', {}, x.label)),
        h('span', {class: 'srow'}, h('span', {class: 'strack'}, h('span', {class: 'sfill do', style: `width:${x.pct * 100}%`})), h('span', {class: 'sval'}, pct(x.pct))))))) : null,
    h('p', {class: 'fine'}, `${t.nW} workers and ${t.nE} employers. Totals only; any group with fewer than ${MIN_CELL} responses is hidden. Activities come from O*NET 31.0 for this job, plus three AI activities O*NET doesn’t track.`),
    h('div', {class: 'actions'}, h('a', {class: 'btn primary', href: `#/survey?job=${job.soc}&as=worker`}, 'Take the survey'), h('a', {class: 'btn', href: ctx.hrefJob(job.soc)}, `Look up ${job.short.toLowerCase()}`))));
}

/** Job page: for the three survey jobs, a short summary that links to the results. */
export function jobSurvey(ctx, o, panel) {
  const job = JOBS.find((j) => j.soc === o.soc);
  if (!job) return null;
  const t = totals(o.soc, ctx.model.plans);
  return panel('AI at work survey',
    sampleNote(),
    h('div', {class: 'summary'},
      h('div', {class: 'stat'}, h('span', {class: 'v'}, pct(t.useAnyAI)), h('span', {class: 'k'}, 'of workers use an AI tool for work')),
      h('div', {class: 'stat'}, h('span', {class: 'v'}, pct(t.adsMentionAI)), h('span', {class: 'k'}, 'of employers mention AI skills in job ads'))),
    h('div', {class: 'actions'}, h('a', {class: 'btn primary', href: `#/results?job=${o.soc}`}, 'See all results'), h('a', {class: 'btn', href: `#/survey?job=${o.soc}&as=worker`}, 'Take the survey')));
}
