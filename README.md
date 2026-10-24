# Career Bridge

Career Bridge shows Massachusetts workers where their job stands with AI: how much the work overlaps with what AI can do, how often local employers already ask for AI skills, which tasks people already use AI for, the skills that set the job apart, and next moves that build on skills the worker already has and pay at least as much. A second view lets workforce boards scan every occupation, filter to groups such as jobs with high exposure but little employer demand for AI skills, and sort by workers, wages or exposure.

## Quick start

1. Put the event data folder (with `anthropic/`, `lightcast/`, `oews/`, `onet/` inside) at `sgi_dataset/`, or point `SGI_DATA` at it. No data is in this repo.
2. Build the data file: `python pipeline/build.py` (writes `data/careerbridge.json`).
3. Start the app: `python server.py` (add `--port 8000` to change the port).
4. Open http://localhost:8000

Python 3.9+ standard library only; nothing to install. The page works offline (no external fonts or scripts).

Data file lookup: `CB_DATA` environment variable, else `data/careerbridge.json`, else `data/reference_prototype.json` (the teammate's prototype numbers; the page then shows a "preview data" notice and `/api/meta` returns `using_reference: true`).

Tests: `python -m unittest discover -s tests`

**No-server mode.** If the Python server isn't running, the page loads `careerbridge.json` from its own folder and answers the same requests in the browser (`web/static-api.js`). So `web/` plus a built `careerbridge.json` runs on any static host. Only host it privately: the data file holds Lightcast-derived numbers.

## Pages and API

- `#/job/43-6014` one job, `#/board` the workforce-board table (filters and sort are kept in the URL), `#/about` what the measures mean. Back and forward work.
- `GET /api/meta`, `GET /api/occupations?q=`, `GET /api/occupations/{soc}`, `GET /api/board?quadrant=&family=&q=&sort=&dir=`. See `CONTRACT.md` for the data shape and rules.
- Search understands short forms: rn, admin, cna, cs, hr, it, dev, teacher, nurse.

## Data and licensing

`data/` is gitignored. It holds numbers derived from Lightcast data, which is licensed for this challenge and must never be committed: this repository is public. Share the built app only by running it locally.

## Limits

- Job ads measure employer demand, not hires. Jobs with few Massachusetts ads get no rate ("Too few MA job ads to measure").
- AI exposure measures overlap with what AI can do. It does not predict job loss; higher exposure can mean AI helps with the work.
- AI use comes from one tool (Claude.ai) and is a share of conversations, not of workers.
- Wages are OEWS medians and exclude benefits and self-employment.
- Next moves are starting points for a conversation with a career advisor, not advice for any one person.
- No race, gender or age data yet.

## Sources

- Lightcast AI Exposure and Adoption by Occupation, 2023 to Sep 2026. Data Source: Lightcast, 2026.
- BLS Occupational Employment and Wage Statistics (OEWS), May 2025.
- O*NET 31.0.
- Anthropic Economic Index, June 2026 release.

## Credit

The design, layout and wording come from a teammate's original single-file prototype. This version ports it to a small server with search, routing and the full dataset.
