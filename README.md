# Career Bridge

Career Bridge shows workers where their job stands with AI, what could change by 2031, and what to do about it. Search a job title and get:

- **Three rulers** that rank the job from lowest to highest: overlap with what AI can do, where Claude is used today, and how often employers ask for AI skills.
- **Live scenario sliders** for how fast AI gets adopted, with the job's 2031 headcount and a chart that updates as you move them.
- **A career plan**: work to lean into, work to let Claude help with, roles worth exploring with the skills to build, and a 30-day, 90-day and 12-month timeline you can copy as text.
- **Explore**: every job on one chart, an outlook for each occupation group, and a sortable table with the same data.
- **For workforce boards** (private build): scan every Massachusetts job and filter to high exposure with little employer demand.

Written in plain language for people who aren't data experts: light colors, large text, square-cornered buttons, one theme, and the numbers behind each answer folded away until you open them. Pick Massachusetts or the United States at the top. Slider settings are saved in the link.

## Two builds

| | Open-data build | Private build |
|---|---|---|
| Data | BLS OEWS, O*NET 31.0, Anthropic Economic Index | the same, plus Lightcast job ads and exposure index |
| File | `data/atlas.json` | adds `data/careerbridge.json` |
| Panels | Claude use ruler, scenarios, career plan, Explore | adds the two Lightcast rulers, job-ad trends, software's path, MA growth, board |
| Can be hosted publicly | yes | **no**: Lightcast is licensed for the challenge |

**How the groups work (private build).** High exposure means a Lightcast exposure index above 50, where Lightcast's Medium-high and High bands start. High employer demand means at least 6.18% of Massachusetts job ads ask for AI skills (the 2025 state rate). The broad gap is high exposure with demand below that rate. The silent gap is the stricter part of it, where under 1% of MA job ads ask for AI skills.

The page works with `atlas.json` alone. If `careerbridge.json` is present it adds the Lightcast panels. `data/` is gitignored; never commit Lightcast-derived files, because this repository is public.

## Quick start (open-data build)

1. In the `sgi_analysis` repo, produce the analysis outputs: `python -I analysis/career_plan.py` (writes `occupation_risk.csv` and `career_plans.json`; also needs `job_title_index.csv` from `occupation_risk.py`).
2. Here: `python pipeline/atlas.py` writes `data/atlas.json` and `data/titles.json`. Needs pandas. Defaults: `ATLAS_SRC=../sgi_analysis/analysis`, `SGI_DATA` = `./sgi_dataset` or `../sgi_analysis/sgi_dataset`.
3. `python server.py` and open http://localhost:8000 (`./demo.sh` does steps 2 to 3 and opens the browser).

**Private build:** put the event data folder (with `anthropic/`, `lightcast/`, `oews/`, `onet/`) at `sgi_dataset/` or set `SGI_DATA`, then `python pipeline/build.py` (and optionally `python pipeline/growth.py`). It writes `data/careerbridge.json`; see `CONTRACT.md`.

**Static hosting (open-data build only):** serve `web/` with `data/atlas.json` and `data/titles.json` beside `index.html`. No server code is needed.

## How the numbers work

- **Where Claude is used today** ranks each job by two signals: how much Claude.ai is used on it compared with how many people hold it, and how closely its work activities match the activities Claude is used for. Jobs where usage was not published use the second signal alone and are marked rougher.
- **2031 outlook:** jobs in 2031 = jobs now × (1 + past yearly growth)⁶ × (1 − adoption × headcount share × exposure × automation lean). Adoption and headcount share are the sliders; the base case is 25% and 50%. These are assumptions to explore, not estimates fitted to data. The math is in `web/js/scenario.js` and is tested against the Python version.
- **Suggested approach** (stay the course, upskill in place, reposition, prepare a move) comes from exposure and whether headcount would fall even in the fast case.
- **Roles worth exploring** match on O*NET skill profile, then require lower Claude use, growth, and at least about 90% of the pay. If nothing matches closely, the page says so and shows looser matches labeled as research leads.

## Pages

`#/job/<soc>` one job · `#/explore?x=&y=&group=&posture=&sort=&dir=` all jobs · `#/board` workforce board (private build) · `#/about` what the measures mean. Add `a=<adoption %>&p=<headcount %>` to any link to set the sliders.

## Accessibility

Built for WCAG 2.2 AA and checked with axe on both builds and every page, with the fold-outs open, with no violations.

- Keyboard: skip link, labelled search combobox with arrow keys, native range sliders with spoken values, focus kept on the control you used when the page redraws.
- Screen readers: landmarks, one heading per page that receives focus on navigation, results and scenario changes announced politely, every chart has a text alternative.
- Color is never the only cue: lines differ by dash and end-marker shape, rulers by marker shape, and charts are labeled at the line ends. Chart colors were checked for color-blind separation on the light background.
- Every chart has the same data in a sortable table with real links.
- Reflows to 320px without horizontal scrolling, reduced-motion and forced-colors styles.

## Code

```
web/index.html, styles.css, app.js     shell, router, search box
web/js/scenario.js                     scenario math (pure, tested)
web/js/data.js, search.js              data loading and join; job-title search
web/js/charts.js, table.js, util.js    one line chart, scatter, sortable table, helpers
web/js/views/                          job, explore, board, about
pipeline/atlas.py                      open-data file     pipeline/build.py, growth.py   Lightcast file
server.py                              static file server (its /api is no longer used by the page)
tests/                                 node --test tests/scenario.test.mjs · python -m unittest discover -s tests
```

`python tests/make_fixture.py` writes a **made-up** Lightcast-shaped file at `tests/fixtures/` so the private-build panels can be tested without licensed data. Run the server with `CB_DATA=tests/fixtures/careerbridge_synthetic.json` to see them; the page shows a "test data" banner.

## Limits

- Exposure shows where Claude is used. It does not predict job loss; high exposure can mean AI helps with the work.
- Claude.ai is one tool. Usage is a share of conversations, not of workers, and includes personal and school use. Only April and May 2026 are published.
- Past growth is national (OEWS 2019 to 2025) and capped at the 5th and 95th percentile of jobs. OEWS counts jobs, not people, and excludes the self-employed.
- Roles worth exploring are starting points for a conversation with a career advisor. Licensing, local demand and personal experience are not in the data.
- Job ads (Lightcast) measure employer demand, not hires. No race, gender or age data yet.

## Sources

BLS OEWS, May 2019 to May 2025 · O*NET 31.0 · Anthropic Economic Index, June 2026 release · Lightcast AI Exposure and Adoption by Occupation, 2023 to Sep 2026 (Data Source: Lightcast, 2026; private build only).

## Credit

The first design, layout and wording came from a teammate's prototype. This version splits the data by license, adds the scenario sliders, career plan and Explore view, and rebuilds the front end as small modules.
