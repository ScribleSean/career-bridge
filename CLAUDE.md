# Career Bridge: working rules

Massachusetts career tool for the Human Edge Studio challenge (SG+I, Oct 2026). Public repo.

## Data
- `data/` and `sgi_dataset/` are gitignored. Never commit Lightcast data or anything derived from it (`careerbridge.json`, `ma_growth.json`).
- Public layer: `pipeline/atlas.py` → `data/atlas.json` (BLS OEWS, O*NET 31.0, Anthropic Economic Index only). Private layer: `pipeline/build.py` → `data/careerbridge.json` (Lightcast). Shapes and rules: `CONTRACT.md`.
- Lightcast leads. Exposure groups use Lightcast bands: index above 50 = high; MA ads at or above the 2025 state rate (6.18%) = employers asking; silent gap = under 1%.
- Never say "at risk" or "automatable". Exposure is overlap, not job loss.

## UI
- No taglines, subtitles, footnotes or helper sentences. A panel is a title, source tags (`src()`), and content. If a screen needs explaining, fix the layout; explanations and caveats live on the About page.
- Every figure shows its source tag; Lightcast tags first.
- Every chart has a labeled scale: axes with round ticks and units (`barList`, `lineChart` in `web/js/charts.js`). Bar length is always against a shared axis, never "relative to the biggest bar".
- Verdicts are short pills, results one line.

## Check before pushing
- `python -m unittest discover -s tests` and `node --test tests/scenario.test.mjs`
- Load `./demo.sh`, open a job, the board, Compare jobs and About; no console errors.
