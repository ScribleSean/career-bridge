# Career Bridge: working rules

Massachusetts career tool for the Human Edge Studio challenge (SG+I, Oct 2026). Public repo.

## Data
- `data/` and `sgi_dataset/` are gitignored. Never commit Lightcast data or derived files (`careerbridge.json`, `ma_growth.json`). A few published headline aggregates (526,000; the 6.18% state rate) may stay in the public code: the challenge terms allow them (Sean, 2026-10-29).
- Public layer: `pipeline/atlas.py` → `data/atlas.json` (BLS OEWS, O*NET 31.0, Anthropic Economic Index only). Private layer: `pipeline/build.py` → `data/careerbridge.json` (Lightcast). Shapes and rules: `CONTRACT.md`.
- Lightcast leads. Exposure groups use Lightcast bands: index above 50 = high; MA ads at or above the 2025 state rate (6.18%) = employers asking; silent gap = under 1%.
- Never say "at risk" or "automatable". Exposure is overlap, not job loss.

## Survey
- The product is a short AI-at-work survey for three silent-gap jobs (`web/js/survey.js`: questions, sample responses, totals) with results published only as totals (`web/js/views/survey.js`). Groups under `MIN_CELL` (10) responses are hidden. Sample responses are made up and always labeled as samples.
- Never imply a MassHire, Lightcast or state relationship. Proposals are marked "Proposed".
- AI metrics are named "AI use (Anthropic Economic Index)", not after a product. Nearby jobs are ranked by skill match and pay, never by lower AI use.
- Static site: `./build-site.sh` → `site/` (open data only; never copies Lightcast files). Live at https://scriblesean.github.io/career-bridge/ from the `gh-pages` branch: to update, rebuild and force-push `site/` as the only commit on `gh-pages`.
- README clips: `node docs/media/record.mjs` with the app running on :8000.

## UI
- No taglines, subtitles, footnotes or helper sentences. A panel is a title, source tags (`src()`), and content. If a screen needs explaining, fix the layout; explanations and caveats live on the About page.
- Every figure shows its source tag; Lightcast tags first.
- Every chart has a labeled scale: axes with round ticks and units (`barList`, `lineChart` in `web/js/charts.js`). Bar length is always against a shared axis, never "relative to the biggest bar".
- Verdicts are short pills, results one line.

## Check before pushing
- `python -m unittest discover -s tests` and `node --test tests/`
- Load the app, open the overview, the survey, the results, a job and About; no console errors.
