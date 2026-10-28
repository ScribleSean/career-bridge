"""Open-data layer: sgi_analysis outputs + OEWS + AEI -> data/atlas.json and data/titles.json.

Run:  python pipeline/atlas.py
Inputs: occupation_risk.csv, career_plans.json and job_title_index.csv. They are committed in pipeline/atlas_src/
(see the README there for how they were made). To use freshly regenerated ones, set
  ATLAS_SRC   folder holding those three files (default pipeline/atlas_src)
  SGI_DATA    event data folder with oews/ and anthropic/ (default ./sgi_dataset, else ../sgi_analysis/sgi_dataset)

Everything here comes from BLS OEWS, O*NET and the Anthropic Economic Index, so atlas.json can be hosted
publicly. Lightcast numbers never enter this file; they stay in careerbridge.json (private).
Exposure here means where Claude.ai is used today. It is not a forecast of job loss.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parent.parent
SIB = REPO.parent / "sgi_analysis"
SRC = Path(os.environ.get("ATLAS_SRC", REPO / "pipeline" / "atlas_src"))
DATA = Path(os.environ.get("SGI_DATA", REPO / "sgi_dataset" if (REPO / "sgi_dataset").exists() else SIB / "sgi_dataset"))
OUT = REPO / "data"

# Scenario defaults. A = share of Claude-exposed, handed-off work adopted by 2031; P = share of that adopted work that removes headcount.
# These are illustrative assumptions, set in sgi_analysis/analysis/occupation_risk.py, not estimates from data.
SCENARIOS = {"slow": {"A": 0.10, "P": 0.5}, "base": {"A": 0.25, "P": 0.5}, "fast": {"A": 0.50, "P": 0.5}}
HORIZON = 6  # May 2025 -> May 2031


def nn(x, nd=2):
    return None if pd.isna(x) else round(float(x), nd)


def build():
    risk = pd.read_csv(SRC / "occupation_risk.csv", dtype={"SOC_2018": str}).set_index("SOC_2018")
    plans = {p["soc"]: p for p in json.load(open(SRC / "career_plans.json"))}
    oews = pd.read_csv(DATA / "oews/oews_by_area.csv", dtype={"SOC_2018": str})
    ma = oews[oews.AREA == "MA"].set_index("SOC_2018")

    occ = []
    for soc, r in risk.iterrows():
        p = plans.get(soc, {})
        m = ma.loc[soc] if soc in ma.index else None
        occ.append({
            "soc": soc, "title": r.title, "group": r.major_group,
            "us_jobs": int(r.emp2025), "ma_jobs": None if m is None else nn(m.EMPLOYMENT, 0),
            "us_wage": nn(r.wage2025, 0), "ma_wage": None if m is None else nn(m.A_MEDIAN, 0),
            "g": nn(r.g * 100),          # % a year, 2019-2025 (US OEWS, winsorized)
            "growth_pct": nn(r.get("cagr_19_25", float("nan")) * 100),  # uncapped US yearly change
            "z": nn(r.z * 100, 1),       # Claude exposure percentile, 0-100
            "basis": r.z_basis, "auto": nn(r.auto_share * 100, 1), "tier": r.tier, "posture": p.get("posture"),
            "edu": p.get("education"), "prep": p.get("preparation"),
        })

    plan = {}
    for soc, p in plans.items():
        lean = json.loads(p["lean_into"]); use = json.loads(p["use_claude_for"]); moves = json.loads(p["moves"])
        plan[soc] = {
            "why": p["why"],
            "lean": [a["activity"] for a in lean], "use": [a["activity"] for a in use],
            "moves": [{"soc": m["soc"], "sim": m["similarity"], "loose": m["looser_match"], "skills": m["skills_to_build"]} for m in moves],
            "timeline": json.loads(p["timeline"]),
        }

    # Claude.ai usage, US, April and May 2026 (AEI June 2026 release)
    o = pd.read_csv(DATA / "anthropic/aei_other_metrics_long.csv", dtype={"NODE_EXTERNAL_ID": str})
    us = o[o.AREA == "US"]
    ov = us[us.CATEGORY_NAME == "overall"].pivot(index="METRIC_ID", columns="DATE_START", values="VALUE")
    pair = lambda k: {"apr": round(ov.loc[k, "2026-04-01"], 2), "may": round(ov.loc[k, "2026-05-01"], 2)}
    topics = us[(us.CATEGORY_NAME == "request") & (us.HIERARCHY_LEVEL == 2) & (us.METRIC_ID == "pct")].pivot_table(index="NODE_NAME", columns="DATE_START", values="VALUE")
    usage = {
        "use_case": [{"name": n, **pair(k)} for n, k in [("Work", "use_case_work_pct"), ("Personal", "use_case_personal_pct"), ("Coursework", "use_case_coursework_pct")]],
        "automation": pair("collaboration_bucket_automation_pct"),
        "topics": sorted(({"name": n, "apr": round(r["2026-04-01"], 2), "may": round(r["2026-05-01"], 2)} for n, r in topics.iterrows()), key=lambda t: -t["may"]),
    }
    return {
        "meta": {"built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "horizon": HORIZON, "scenarios": SCENARIOS,
                 "usage_period": "April and May 2026", "oews_year": 2025,
                 "sources": ["BLS OEWS, May 2019 to May 2025", "O*NET 31.0", "Anthropic Economic Index, June 2026 release (Claude.ai, US)"]},
        "occ": occ, "plans": plan, "usage": usage,
    }


def titles():
    t = pd.read_csv(SRC / "job_title_index.csv", dtype=str).dropna()
    return [[a.strip(), b] for a, b in t.itertuples(index=False)]


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    d = build()
    json.dump(d, open(OUT / "atlas.json", "w"), separators=(",", ":"))
    json.dump(titles(), open(OUT / "titles.json", "w"), separators=(",", ":"))
    print(f"atlas.json: {len(d['occ'])} occupations, {len(d['plans'])} plans, {os.path.getsize(OUT / 'atlas.json') // 1024} KB; "
          f"titles.json: {os.path.getsize(OUT / 'titles.json') // 1024} KB")
