// Skill signals: the two-sided part of Career Bridge. Workers and employers post which skills a job uses
// and where AI helps; coworkers, employers and career centers confirm. Feed, post form, profile, and the job-page panel.
import {h, fmt, announce, src} from '../util.js';
import {SKILLS, SKILL, REGIONS, ROLES, DEMO_JOBS, STATUS, COMMUNITY_MIN, role, status, allSignals, post, removePost,
  confirm, unconfirm, confirmKind, confirmedByMe, summarize, myActivity, badges, resetDemo, onetIds} from '../signals.js';

const MASSHIRE_URL = 'https://www.mass.gov/orgs/masshire-department-of-career-services';
const titleOf = (model, soc) => model.bySoc.get(soc)?.title || soc;
const shortDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', {month: 'short', day: 'numeric'});

function badge(sig) {
  const [label, cls] = STATUS[status(sig)];
  return h('span', {class: 'vbadge ' + cls}, label);
}

function skillChips(sig) {
  return h('ul', {class: 'schips', 'aria-label': 'Skills used'}, sig.skills.map((k) => h('li', {class: k.ai ? 'ai' : null},
    SKILL[k.id]?.label || k.id, k.ai ? h('span', {class: 'aimark', title: 'AI helps with this'}, 'AI') : null)));
}

function confirmLine(sig) {
  const c = sig.confirms || [];
  const co = c.filter((x) => x.kind === 'coworker').length, emp = c.filter((x) => x.kind === 'employer'), mh = c.filter((x) => x.kind === 'masshire');
  const parts = [];
  if (co) parts.push(`${co} coworker${co === 1 ? '' : 's'} confirmed`);
  if (emp.length) parts.push(`verified by ${emp.map((x) => x.name).join(', ')}`);
  if (mh.length) parts.push(`verified by ${mh.map((x) => x.name).join(', ')}`);
  if (!co && status(sig) === 'posted') parts.push(`${COMMUNITY_MIN} coworker confirmations make it community-confirmed`);
  return parts.join(' · ');
}

/** One signal card. onChange re-renders the view after a confirm. */
export function card(ctx, sig, onChange, {showJob = true} = {}) {
  const kind = confirmKind(sig), mine = confirmedByMe(sig);
  const verb = {coworker: 'I do this job too: confirm', employer: 'Verify as employer', masshire: 'Verify as career center'}[kind];
  const btn = kind ? h('button', {type: 'button', class: 'btn sm' + (mine ? ' on' : ''), 'aria-pressed': String(mine), onclick: () => {
    if (mine) { unconfirm(sig); announce('Confirmation removed.'); } else { confirm(sig); announce('Confirmed. Thanks for vouching.'); }
    onChange();
  }}, mine ? 'Confirmed ✓' : verb) : null;
  const who = sig.side === 'worker'
    ? [h('b', {}, sig.author.name), sig.author.years ? ` · ${sig.author.years} yr${sig.author.years === 1 ? '' : 's'} in the job` : '']
    : [h('b', {}, sig.author.name), ' · employer'];
  return h('article', {class: 'sig ' + sig.side},
    h('header', {class: 'sighead'},
      h('span', {class: 'side ' + sig.side}, sig.side === 'worker' ? 'Worker' : 'Employer'),
      h('span', {class: 'who'}, who, ` · ${sig.region} · ${shortDate(sig.posted)}`),
      sig.sample ? h('span', {class: 'sample', title: 'Sample signal for the demo'}, 'Sample') : null,
      sig.mine ? h('span', {class: 'sample mine'}, 'Yours') : null,
      badge(sig)),
    showJob ? h('a', {class: 'sigjob', href: ctx.hrefJob(sig.soc)}, titleOf(ctx.model, sig.soc)) : null,
    sig.note ? h('p', {class: 'signote'}, sig.note) : null,
    skillChips(sig),
    sig.growing?.length ? h('p', {class: 'growing'}, h('b', {}, 'Becoming more important here: '), sig.growing.map((g) => SKILL[g]?.label).join(', ')) : null,
    h('footer', {class: 'sigfoot'}, h('span', {class: 'conf'}, confirmLine(sig)), btn,
      sig.mine ? h('button', {type: 'button', class: 'btn sm ghost', onclick: () => { removePost(sig.id); announce('Signal deleted.'); onChange(); }}, 'Delete') : null));
}

/* ------------------------------------------------------------------ feed */
export function renderSignals(root, ctx, params) {
  const {model} = ctx;
  const all = allSignals(model);
  const soc = params.soc || '', side = ['worker', 'employer'].includes(params.side) ? params.side : '', region = REGIONS.includes(params.region) ? params.region : '';
  const verified = params.verified === '1';
  const list = all.filter((s) => (!soc || s.soc === soc) && (!side || s.side === side) && (!region || s.region === region) && (!verified || status(s) !== 'posted'));
  const set = (patch) => ctx.go('signals', {...params, ...patch});
  const jobs = [...new Set([...DEMO_JOBS, ...all.map((s) => s.soc)])].filter((s) => model.bySoc.has(s)).sort((a, b) => titleOf(model, a).localeCompare(titleOf(model, b)));
  const sum = summarize(list);
  const stat = (v, k) => h('div', {class: 'stat'}, h('span', {class: 'v'}, v), h('span', {class: 'k'}, k));
  const r = role();
  root.replaceChildren(h('div', {class: 'sigview'},
    h('header', {class: 'viewhead row'}, h('h2', {id: 'view-title', tabindex: '-1'}, 'Skill signals'),
      r === 'masshire' ? null : h('a', {class: 'btn primary', href: '#/post' + (soc ? '?soc=' + soc : '')}, 'Post a signal')),
    h('div', {class: 'summary four'},
      stat(fmt.n(sum.total), 'signals'), stat(fmt.n(sum.verified), 'verified'),
      stat(fmt.n(sum.employers), 'from employers'), stat(sum.workers ? `${Math.round(100 * sum.usesAI / sum.workers)}%` : '—', 'of workers say AI helps')),
    h('div', {class: 'boardbar'},
      h('label', {for: 'sj'}, 'Job', h('select', {id: 'sj', onchange: (e) => set({soc: e.target.value})},
        h('option', {value: ''}, 'All jobs'), jobs.map((s) => h('option', {value: s, selected: s === soc}, titleOf(model, s))))),
      h('label', {for: 'ss'}, 'From', h('select', {id: 'ss', onchange: (e) => set({side: e.target.value})},
        [['', 'Workers and employers'], ['worker', 'Workers'], ['employer', 'Employers']].map(([v, t]) => h('option', {value: v, selected: v === side}, t)))),
      h('label', {for: 'sr'}, 'Region', h('select', {id: 'sr', onchange: (e) => set({region: e.target.value})},
        h('option', {value: ''}, 'All of Massachusetts'), REGIONS.map((x) => h('option', {value: x, selected: x === region}, x)))),
      h('label', {class: 'check', for: 'sv'}, h('input', {id: 'sv', type: 'checkbox', checked: verified, onchange: (e) => set({verified: e.target.checked ? '1' : ''})}), 'Verified only')),
    h('p', {class: 'count', 'aria-live': 'polite'}, `${list.length} signal${list.length === 1 ? '' : 's'}`),
    h('div', {class: 'feed'}, list.length ? list.map((s) => card(ctx, s, () => renderSignals(root, ctx, params))) : h('p', {class: 'empty'}, 'No signals match these filters.')),
    masshireNote()));
}

const masshireNote = () => h('aside', {class: 'mhnote'},
  h('b', {}, 'Proposed: '), 'MassHire career centers could verify signals after talking with the person, and point training at the skills employers say are growing. ',
  h('a', {href: MASSHIRE_URL, target: '_blank', rel: 'noopener'}, 'Find a MassHire career center'));

/* ------------------------------------------------------------------ post */
export function renderPost(root, ctx, params) {
  const {model} = ctx;
  const r = role();
  if (r === 'masshire') {
    root.replaceChildren(h('div', {class: 'sigview'}, h('header', {class: 'viewhead'}, h('h2', {id: 'view-title', tabindex: '-1'}, 'Post a signal')),
      h('p', {class: 'panel'}, 'Career centers verify signals instead of posting them. Switch to Worker or Employer at the top to post.')));
    return;
  }
  const side = r === 'worker' ? 'worker' : 'employer';
  const titles = model.occ.map((o) => o.title).sort();
  const start = model.bySoc.get(params.soc);
  const picked = new Map();   // skill id -> AI helps?
  const growing = new Set();
  const jobIn = h('input', {id: 'pj', list: 'pjl', value: start?.title || '', autocomplete: 'off', required: true});
  const suggestBox = h('div', {class: 'suggest'});
  const skillBox = h('div', {class: 'skillgrid', role: 'group', 'aria-label': 'Skills this job uses'});
  const msg = h('p', {class: 'formmsg', role: 'alert'});
  const socFor = (t) => model.occ.find((o) => o.title === t)?.soc;
  const drawSkills = () => {
    const soc = socFor(jobIn.value), plan = soc && model.plans?.[soc];
    const sug = plan ? onetIds([...plan.lean, ...plan.use]) : [];
    suggestBox.replaceChildren(sug.length ? h('p', {}, h('b', {}, 'O*NET lists these for this job: '), sug.map((k) => SKILL[k].label).join(', '), '. Pick what you actually use.') : '');
    const order = [...sug, ...SKILLS.map((s) => s.id).filter((k) => !sug.includes(k))];
    skillBox.replaceChildren(...order.map((k) => {
      const on = picked.has(k);
      return h('div', {class: 'skillopt' + (on ? ' on' : '')},
        h('label', {}, h('input', {type: 'checkbox', checked: on, onchange: (e) => { e.target.checked ? picked.set(k, false) : picked.delete(k); drawSkills(); }}), SKILL[k].label,
          SKILL[k].onet ? null : h('span', {class: 'newtag'}, 'new')),
        on ? h('label', {class: 'aiopt'}, h('input', {type: 'checkbox', checked: picked.get(k), onchange: (e) => picked.set(k, e.target.checked)}), 'AI helps') : null);
    }));
  };
  jobIn.addEventListener('change', drawSkills);
  const regionSel = h('select', {id: 'pr'}, REGIONS.map((x) => h('option', {value: x}, x)));
  const extra = side === 'worker'
    ? h('label', {for: 'py'}, 'Years in this job', h('input', {id: 'py', type: 'number', min: 0, max: 50, value: 2}))
    : h('label', {for: 'po'}, 'Your organization (shown publicly)', h('input', {id: 'po', placeholder: 'e.g. Community health center', maxlength: 60}));
  const growBox = side === 'employer' ? h('fieldset', {class: 'grow'}, h('legend', {}, 'Skills becoming more important in this role'),
    h('div', {class: 'chips'}, SKILLS.map((s) => h('button', {type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: (e) => {
      const b = e.currentTarget; growing.has(s.id) ? growing.delete(s.id) : growing.add(s.id); b.setAttribute('aria-pressed', String(growing.has(s.id)));
    }}, s.label)))) : null;
  const note = h('textarea', {id: 'pn', rows: 3, maxlength: 280, placeholder: side === 'worker' ? 'What do you actually spend time on? Where does AI help, or not?' : 'What does this role need from people? What are you training for?'});
  const submit = (e) => {
    e.preventDefault();
    const soc = socFor(jobIn.value);
    if (!soc) { msg.textContent = 'Pick a job from the list.'; jobIn.focus(); return; }
    if (picked.size < 2) { msg.textContent = 'Pick at least two skills.'; return; }
    const author = side === 'worker' ? {id: 'me-worker', name: 'You', years: +document.getElementById('py').value || null}
      : {id: 'me-employer', name: (document.getElementById('po').value || 'Your organization').trim()};
    post({soc, side, role: r, author, region: regionSel.value, skills: [...picked].map(([id, ai]) => ({id, ai})), growing: [...growing], note: note.value.trim()});
    announce('Signal posted.');
    ctx.go('signals', {soc});
  };
  root.replaceChildren(h('div', {class: 'sigview'},
    h('header', {class: 'viewhead'}, h('h2', {id: 'view-title', tabindex: '-1'}, side === 'worker' ? 'What does your job really use?' : 'What does this role need?')),
    h('form', {class: 'panel postform', onsubmit: submit},
      h('label', {for: 'pj'}, side === 'worker' ? 'Your job' : 'The job you hire for', jobIn, h('datalist', {id: 'pjl'}, titles.map((t) => h('option', {value: t})))),
      h('div', {class: 'two'}, h('label', {for: 'pr'}, 'Region', regionSel), extra),
      h('fieldset', {}, h('legend', {}, side === 'worker' ? 'Skills you use' : 'Skills people in this role use'), suggestBox, skillBox),
      growBox,
      h('label', {for: 'pn'}, 'In your own words (optional)', note),
      msg,
      h('div', {class: 'actions'}, h('button', {type: 'submit', class: 'btn primary'}, 'Post signal'), h('a', {class: 'btn', href: '#/signals'}, 'Cancel')),
      h('p', {class: 'fine'}, 'Demo: your signal is saved in this browser only.'))));
  drawSkills();
}

/* ------------------------------------------------------------------ profile */
export function renderMe(root, ctx) {
  const {model} = ctx;
  const r = role(), act = myActivity(model);
  const redraw = () => renderMe(root, ctx);
  root.replaceChildren(h('div', {class: 'sigview'},
    h('header', {class: 'viewhead'}, h('h2', {id: 'view-title', tabindex: '-1'}, ROLES[r].you)),
    h('p', {class: 'lede'}, ROLES[r].can),
    h('section', {class: 'panel'}, h('h3', {}, 'Badges'),
      h('ul', {class: 'badges'}, badges(act).map(([name, how, got]) => h('li', {class: got ? 'got' : null}, h('b', {}, name), h('span', {}, got ? 'Earned' : how))))),
    r === 'masshire' ? null : h('section', {class: 'panel'}, h('h3', {}, 'Your signals'),
      act.posts.length ? h('div', {class: 'feed'}, act.posts.map((s) => card(ctx, s, redraw))) : h('p', {}, 'None yet. ', h('a', {href: '#/post'}, 'Post your first signal'), '.')),
    h('section', {class: 'panel'}, h('h3', {}, r === 'worker' ? 'Signals you vouched for' : 'Signals you verified'),
      act.confirmed.length ? h('div', {class: 'feed'}, act.confirmed.map((s) => card(ctx, s, redraw))) : h('p', {}, 'None yet. ', h('a', {href: '#/signals'}, 'Browse signals'), '.')),
    h('p', {}, h('button', {type: 'button', class: 'btn ghost', onclick: () => { resetDemo(); announce('Demo reset.'); redraw(); }}, 'Reset demo'))));
}

/* ------------------------------------------------------------------ job page panel */
export function jobSignals(ctx, o, panel) {
  const list = allSignals(ctx.model).filter((s) => s.soc === o.soc);
  const postBtn = role() === 'masshire' ? null : h('a', {class: 'btn', href: '#/post?soc=' + o.soc}, 'Post about this job');
  if (!list.length) return panel('What people in this job report', h('p', {}, 'No signals for this job yet.'), h('div', {class: 'actions'}, postBtn));
  const sum = summarize(list, ctx.model.plans?.[o.soc]);
  const top = sum.skills.filter((x) => x.worker + x.employer > 0).slice(0, 8);
  const max = Math.max(...top.map((x) => x.worker + x.employer), 1);
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];
  const pos = (v) => `${(100 * v) / max}%`;
  const growing = sum.skills.filter((x) => x.growing).sort((a, b) => b.growing - a.growing).slice(0, 4);
  return panel('What people in this job report',
    h('p', {class: 'sigsum'}, `${sum.total} signals · ${sum.verified} verified · ${sum.workers ? `${sum.usesAI} of ${sum.workers}` : '0'} workers say AI helps with some of their work`),
    h('div', {class: 'blist sigbars'},
      h('p', {class: 'bunit'}, 'Signals naming the skill'),
      h('div', {class: 'baxis', 'aria-hidden': 'true'}, ticks.map((t) => h('span', {style: `left:${pos(t)}`}, t))),
      h('ul', {}, top.map((x) => h('li', {},
        h('span', {class: 'bl'}, SKILL[x.id].label, x.ai ? h('span', {class: 'aimark', title: `${x.ai} say AI helps with this`}, `AI helps · ${x.ai}`) : null,
          x.official ? null : h('span', {class: 'newtag', title: 'Not in O*NET’s top activities for this job'}, 'not in O*NET')),
        h('span', {class: 'btrack', role: 'img', 'aria-label': `${SKILL[x.id].label}: ${x.worker} workers, ${x.employer} employers, AI helps in ${x.ai}`},
          ticks.map((t) => h('i', {class: 'bgrid', style: `left:${pos(t)}`})),
          h('span', {class: 'bfill w', style: `width:${pos(x.worker)}`}),
          h('span', {class: 'bfill e', style: `left:${pos(x.worker)};width:${pos(x.employer)}`}),
          h('b', {class: 'bval'}, x.worker + x.employer)))))),
    h('div', {class: 'legend'}, h('span', {class: 'key', style: '--c:var(--c-ads)'}, 'Workers'), h('span', {class: 'key', style: '--c:var(--gap)'}, 'Employers')),
    growing.length ? h('p', {class: 'growing'}, h('b', {}, 'Employers say these are becoming more important: '), growing.map((x) => SKILL[x.id].label).join(', ')) : null,
    h('div', {class: 'actions'}, h('a', {class: 'btn primary', href: '#/signals?soc=' + o.soc}, `See all ${sum.total} signals`), postBtn));
}
