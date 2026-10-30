# Career Bridge: data contract

The pipeline writes `data/careerbridge.json`. The server reads it and serves the API. The web app does not call the API. It reads `atlas.json` and `titles.json` directly, plus `careerbridge.json` when the page has a `<meta name="cb-lightcast">` tag. The server serves `atlas.json` and `titles.json` from `data/`, and `careerbridge.json` from the data file it loaded.

`data/` is gitignored because it holds Lightcast-derived numbers and this repo is public.

`tests/test_pipeline.py` compares against `data/reference_prototype.json` when that file exists. It is earlier prototype data in the same shape and is not in the repo.

## careerbridge.json
```
{
  "meta": {"built_at": ISO time, "state_rate_2025": 6.18, "exposure_cut": 50.0, "silent_cut": 1.0, "sources": [...],
           "software_genai_us": [[year, us_pct_genai], ...]},   // Software Developers (O*NET 15-1252.00), 2023..2026
  "occ": [ {                       // one per SOC 2018 code with MA OEWS employment
     "soc": "43-6014", "title": str, "major_group": str,   // major_group = SOC 2-digit name without "Occupations"
     "exposure": float,            // Lightcast index, collapsed ONET->SOC weighted by 2025 US postings
     "ma_ai_2025": float|null, "us_ai_2025": float|null, "ma_genai_2025": float|null,   // % of postings, null if THIN
     "ma_confidence": "HIGH"|"MEDIUM"|"LOW"|"THIN",
     "ma_employment": float, "ma_median_wage": float|null, "us_median_wage": float|null,  // BLS OEWS May 2025
     "quadrant": one of the 5 labels below,
     "silent_gap": bool,                  // high exposure AND ma_ai_2025 < 1 (2025, MA not THIN); see rules
     "bachelors_plus_pct": float|null,    // O*NET education: % of respondents with bachelor's or higher (RL scale)
     "job_zone": float|null,
     "claude_share_us": float|null,       // AEI US % of conversations, Apr-May 2026 avg
     "years_behind_software": float|null, // see "Following software's path" below
     "software_path_status": "level"|"behind"|"not_started"|"too_few_ads"
  } ],
  "trend":     { soc: [[year, ma_pct_ai, us_pct_ai], ...] },          // 2023..2026, 2026 = Jan-Sep
  "genai":     { soc: [[year, ma_pct_genai, us_pct_genai], ...] },    // same years; % of postings asking for GenAI skills, null if THIN
  "tasks":     { soc: [[task_text, pct_of_conversations], ...] },     // top 4 AEI tasks (US), O*NET TASK_ID join
  "skills":    { soc: [[type, name, pct_postings, geo, is_ai], ...] },// type S=specialized(top 6) C=common(top 6) R=certification(top 4); 2025; geo MA if MA not THIN else US
  "strengths": { soc: [[skill, importance, diff_vs_ma_avg], ...] },   // top 4 O*NET skills where importance minus MA-employment-weighted mean importance > 0
  "paths":     { soc: [[target_soc, cosine_sim, wage_diff, "Skill A, Skill B, Skill C"], ...] }
}
```

## Rules
- **Quadrants.** Exposure above 50 counts as high. That is where Lightcast's `AI_EXPOSURE_BAND` Medium-high and High bands start. (`reference_prototype.json` used the 55.7 median instead.) A `ma_ai_2025` at or above 6.18, the 2025 MA state rate, counts as high demand. Use these labels exactly:
  `High exposure, low adoption`, `High exposure, high adoption`, `Lower exposure, high adoption`, `Lower exposure, low adoption`, and `Too few MA job ads to measure` (MA is THIN or the rate is null).
- **Silent gap.** A job is in the silent gap when exposure is above 50 and `ma_ai_2025` is below 1.0, MA is not THIN, and the rate is not null. Every silent-gap job is also in `High exposure, low adoption`.
- **Paths (next moves).** A target job qualifies when all of these hold:
  - The cosine similarity of the two jobs' O*NET skill importance vectors is 0.70 or more.
  - The target's MA median wage is at least the current job's.
  - The target's `job_zone` is at most the current job's plus 1.
  - The target's MA employment is at least 1,000.
  - The target's `ma_ai_2025` is above the current job's. A null current rate counts as 0.

  Keep up to 10 targets, sorted by similarity. The bridge skills are the 3 O*NET skills where the target's importance exceeds the current job's by the most.
- **Following software's path.** Take the job's 2026 US GenAI share. Find the year t* when software had that share, by linear interpolation on `software_genai_us`. Then `years_behind_software` is 2026 minus t*, rounded to the nearest 0.5, and the status is `behind`. If the job is at or above software's 2026 share, the value is 0 and the status is `level`. If it is below software's 2023 share, the value is null and the status is `not_started`. If its 2026 US rate is THIN, the value is null and the status is `too_few_ads`. The measure shows a pattern in employer demand, not a forecast of jobs.
- **Lightcast data rules.** Leave Unclassified out of rankings but keep it in totals. Show THIN rates as blank. Report rate changes in percentage points. Never describe a job as "at risk".
- **Joins.** Join Lightcast, O*NET and AEI on the O*NET code (`ONET`). Join OEWS on `SOC_2018`, which is `ONET[:7]`. Collapse O*NET codes to SOC before attaching OEWS, so no job is counted twice. Excel garbled the Lightcast `soc_2018` column for 11-xxxx codes, so derive SOC from `ONET[:7]` instead.

## API (server.py, Python stdlib only)
- `GET /api/meta` returns `meta` plus `counts`, `quadrant_counts`, `families`, `aliases`, `using_reference`, `lite` and `data_file`. It adds `warning` when the server uses the reference data.
- `GET /api/occupations?q=` searches job titles and returns `[{soc, title, major_group, ma_employment, exposure, ma_ai_2025, quadrant, silent_gap}]`. Search expands aliases such as `rn`, `admin` and `cna`. `limit` sets the number of results (1 to 50, default 10).
- `GET /api/occupations/{soc}` returns `occ`, `trend`, `genai`, `growth`, `tasks`, `skills`, `strengths` and `paths` for one job. Each path includes a summary of the target job. An unknown SOC returns 404.
- `GET /api/board?quadrant=&family=&q=&sort=&dir=` returns `rows` and `summary`. Rows include `years_behind_software` and `software_path_status`. With `sort=years_behind_software`, `not_started` rows come after `behind` rows in ascending order and before them in descending order. `too_few_ads` rows always come last. `summary` holds `gap_workers`, `gap_share`, `gap_count`, `silent_workers`, `silent_share`, `silent_count` and `state_rate`. `quadrant=Silent gap` returns only silent-gap rows.
- The server serves static files from `web/`. It reads the data file from `CB_DATA` if set, else `data/careerbridge.json`, else `data/reference_prototype.json`, and in the last case adds a warning to `/api/meta`. If the file it picks does not exist, it sets `lite` and serves only the open-data app.


## atlas.json (open data, `pipeline/atlas.py`)
`pipeline/atlas.py` builds it from BLS OEWS, O*NET and the Anthropic Economic Index only, so it can be hosted publicly. The page reads it directly. `careerbridge.json` is an optional overlay that the page joins on `soc`.
```
{ "meta":  {"built_at", "horizon": 6, "scenarios": {"slow"|"base"|"fast": {"A", "P"}}, "usage_period", "oews_year", "sources": [...]},
  "occ":    [{"soc", "title", "group", "us_jobs", "ma_jobs"|null, "us_wage", "ma_wage"|null,
              "g",      // past growth, % a year, US 2019-2025, capped at the 5th/95th percentile
              "growth_pct"|null, // uncapped yearly change, % a year, US 2019-2025; null if unavailable
              "z",      // where Claude is used today, percentile 0-100
              "basis",  // "usage+content" | "content only (AEI withheld)" | "usage only"
              "auto",   // % of the group's Claude conversations where work was handed off
              "tier", "posture", "edu", "prep"}],
  "plans":  {soc: {"why", "lean": [activity], "use": [activity], "moves": [{"soc", "sim", "loose", "skills": [..]}], "timeline": [{"when", "text"}]}},
  "usage":  {"use_case": [{"name", "apr", "may"}], "automation": {"apr", "may"}, "topics": [{"name", "apr", "may"}]} }
```
Search uses `titles.json`, a list of `[reported job title, soc]` pairs. The scenario rule is `jobs2031 = jobs x (1 + g/100)^6 x (1 - A x P x auto/100 x z/100)`.
