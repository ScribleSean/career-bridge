# Career Bridge: data contract

The pipeline writes `data/careerbridge.json`. The server reads it and serves the API. The web app only talks to the API.
`data/` is gitignored: it holds Lightcast-derived numbers and this repo is public.
`data/reference_prototype.json` is the teammate's prototype data in the same shape: a reference to compare against, and a stand-in while the pipeline is built.

## careerbridge.json
```
{
  "meta": {"built_at": ISO time, "state_rate_2025": 6.18, "exposure_median": 55.7, "sources": [...]},
  "occ": [ {                       // one per SOC 2018 code with MA OEWS employment
     "soc": "43-6014", "title": str, "major_group": str,   // major_group = SOC 2-digit name without "Occupations"
     "exposure": float,            // Lightcast index, collapsed ONET->SOC weighted by 2025 US postings
     "ma_ai_2025": float|null, "us_ai_2025": float|null, "ma_genai_2025": float|null,   // % of postings, null if THIN
     "ma_confidence": "HIGH"|"MEDIUM"|"LOW"|"THIN",
     "ma_employment": float, "ma_median_wage": float|null, "us_median_wage": float|null,  // BLS OEWS May 2025
     "quadrant": one of the 5 labels below,
     "bachelors_plus_pct": float|null,    // O*NET education: % of respondents with bachelor's or higher (RL scale)
     "job_zone": float|null,
     "claude_share_us": float|null        // AEI US % of conversations, Apr-May 2026 avg
  } ],
  "trend":     { soc: [[year, ma_pct_ai, us_pct_ai], ...] },          // 2023..2026, 2026 = Jan-Sep
  "tasks":     { soc: [[task_text, pct_of_conversations], ...] },     // top 4 AEI tasks (US), O*NET TASK_ID join
  "skills":    { soc: [[type, name, pct_postings, geo, is_ai], ...] },// type S=specialized(top 6) C=common(top 6) R=certification(top 4); 2025; geo MA if MA not THIN else US
  "strengths": { soc: [[skill, importance, diff_vs_ma_avg], ...] },   // top 4 O*NET skills where importance minus MA-employment-weighted mean importance > 0
  "paths":     { soc: [[target_soc, cosine_sim, wage_diff, "Skill A, Skill B, Skill C"], ...] }
}
```

## Rules
- Quadrants: exposure > 55.7 = high; ma_ai_2025 >= 6.18 = high demand. Labels exactly:
  `High exposure, low adoption`, `High exposure, high adoption`, `Lower exposure, high adoption`, `Lower exposure, low adoption`, `Too few MA job ads to measure` (MA THIN or null rate).
- Paths (next moves): cosine similarity >= 0.70 on O*NET skill importance vectors; target MA median wage >= current; target job_zone <= current + 1; target MA employment >= 1000; target ma_ai_2025 > current ma_ai_2025 (null current counts as 0). Keep up to 10, sorted by similarity. Bridge skills = top 3 O*NET skills where target importance exceeds current most.
- Lightcast organizer rules (docs: human-edge-studio/docs/lightcast-ai-context.md): Unclassified out of rankings, in totals; THIN rates are blank; rate changes in points; never "at risk".
- Join Lightcast/O*NET/AEI on ONET; OEWS on SOC_2018 = ONET[:7]; collapse ONET->SOC before attaching OEWS (no double counting). Lightcast `soc_2018` column is Excel-mangled for 11-xxxx codes: derive SOC from ONET[:7].

## API (server.py, Python stdlib only)
- `GET /api/meta` -> meta + counts
- `GET /api/occupations?q=` -> [{soc,title,major_group,ma_employment,exposure,ma_ai_2025,quadrant}] (search; aliases like rn, admin, cna)
- `GET /api/occupations/{soc}` -> occ + trend + tasks + skills + strengths + paths (each path expanded with target occ summary)
- `GET /api/board?quadrant=&family=&q=&sort=&dir=` -> rows + summary {gap_workers, gap_share, gap_count, state_rate}
- Static files from `web/`. Data file path: env CB_DATA, else data/careerbridge.json, else data/reference_prototype.json (with a warning in /api/meta).
