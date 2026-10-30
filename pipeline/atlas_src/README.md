# Analysis outputs used by `pipeline/atlas.py`

These files are precomputed from open data only: BLS OEWS, O*NET 31.0 and the Anthropic Economic Index (June 2026). They contain no Lightcast data.

| File | What it holds |
|---|---|
| `occupation_risk.csv` | one row per occupation: AI use score (Anthropic Economic Index), past growth, the group's handoff share, tier, and 2031 scenario numbers |
| `career_plans.json` | one plan per occupation: suggested approach, activities to do more of, activities AI can speed up, similar roles with skills to build, and a timeline |
| `job_title_index.csv` | reported job titles mapped to occupation codes, for search |

A separate analysis step generated them from the same open data. To use newly generated copies without overwriting these, run `ATLAS_SRC=/path/to/analysis python pipeline/atlas.py`.
