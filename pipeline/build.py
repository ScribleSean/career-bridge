"""Career Bridge data pipeline: sgi_dataset/ -> data/careerbridge.json.

Run:  python pipeline/build.py      (data folder: $SGI_DATA, else ./sgi_dataset)
Shape and rules: CONTRACT.md.

Method in short
- One record per SOC 2018 code with MA OEWS employment (May 2025) and a Lightcast exposure score.
- Lightcast, O*NET and AEI are per O*NET code. We map each O*NET code to an OEWS SOC
  (ONET[:7], else Lightcast soc_5, else ONET[:6]+"0" for combined OEWS rows), collapse to
  the SOC first, and only then attach OEWS. Every worker is counted once.
  Lightcast's soc_2018 column is Excel-mangled for 11-xxxx codes, so it is never used.
- Rates (% of postings with AI skills) collapse as postings-weighted means; a SOC's
  confidence flag comes from its summed postings (HIGH 1000+, MEDIUM 100+, LOW 30+, THIN <30).
  THIN rates are blank.
- State rate = MA 2025 AI-skill postings / MA postings with a published rate, all occupations
  including Unclassified (organizer rule: Unclassified out of rankings, in totals).
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
REPO = HERE.parent  # repo root
DATA = Path(os.environ.get("SGI_DATA", REPO / "sgi_dataset"))
OUT = HERE.parent / "data" / "careerbridge.json"

EXPOSURE_CUT = 50.0          # contract: exposure > 50 = high (Lightcast AI_EXPOSURE_BAND Medium-high or High)
SILENT_CUT = 1.0             # contract: silent gap = high exposure and MA ads asking for AI < 1% (2025, not THIN)
YEAR = 2025
TREND_YEARS = [2023, 2024, 2025, 2026]
BACHELORS_PLUS = range(6, 13)  # O*NET RL categories 6-12: bachelor's .. post-doctoral
PATH_MIN_SIM, PATH_MIN_EMP, PATH_MAX = 0.70, 1000, 10
SIM_METHOD = os.environ.get("CB_SIM", "zscore")  # "zscore" or "row"; see cosine_matrix
LABELS = {
    (True, False): "High exposure, low adoption",
    (True, True): "High exposure, high adoption",
    (False, True): "Lower exposure, high adoption",
    (False, False): "Lower exposure, low adoption",
}
THIN_LABEL = "Too few MA job ads to measure"
SOFTWARE_ONET = "15-1252.00"  # Software Developers: the reference path for "years behind software"


def confidence(postings):
    if postings >= 1000:
        return "HIGH"
    if postings >= 100:
        return "MEDIUM"
    if postings >= 30:
        return "LOW"
    return "THIN"


def num(x, nd=2):
    """Float rounded, or None for NaN/None."""
    return None if x is None or pd.isna(x) else round(float(x), nd)


# ---------------------------------------------------------------- load
def load():
    d = {}
    d["prof"] = pd.read_csv(DATA / "lightcast/lc_occupation_ai_profile.csv", dtype={"onet": str})
    d["oews"] = pd.read_csv(DATA / "oews/oews_by_area.csv", dtype={"SOC_2018": str})
    d["onet_occ"] = pd.read_csv(DATA / "onet/onet_occupations.csv", dtype={"ONET": str})
    d["edu"] = pd.read_csv(DATA / "onet/onet_education.csv", dtype={"ONET": str})
    d["onet_skills"] = pd.read_csv(DATA / "onet/onet_skills.csv", dtype={"ONET": str})
    d["tasks"] = pd.read_csv(DATA / "onet/onet_tasks.csv", dtype={"ONET": str, "TASK_ID": str})
    d["aei_occ"] = pd.read_csv(DATA / "anthropic/aei_by_occupation.csv", dtype={"ONET": str})
    d["aei_long"] = pd.read_csv(DATA / "anthropic/aei_other_metrics_long.csv",
                                dtype={"NODE_EXTERNAL_ID": str})
    d["lc_skills"] = pd.read_csv(
        DATA / "lightcast/lc_occupation_skills.csv", dtype={"onet": str},
        usecols=["year", "onet", "is_unclassified", "geography", "job_postings",
                 "skill_type", "skill_name", "job_postings_with_skill", "is_ai_skill"])
    return d


# ---------------------------------------------------------------- crosswalk
def build_crosswalk(prof, onet_occ, oews_socs):
    """O*NET code -> OEWS SOC. Uses ONET[:7], Lightcast soc_5, then ONET[:6]+'0'."""
    soc5 = prof.drop_duplicates("onet").set_index("onet").soc_5.to_dict()
    codes = set(prof.onet) | set(onet_occ.ONET)
    xw = {}
    for code in codes:
        for cand in (code[:7], soc5.get(code), code[:6] + "0"):
            if isinstance(cand, str) and cand in oews_socs:
                xw[code] = cand
                break
    return xw


def state_rate(prof):
    """MA 2025 AI-skill rate over all postings with a published rate, Unclassified included."""
    y = prof[(prof.year == YEAR) & prof.ma_pct_postings_ai_skills.notna()]
    return float((y.ma_job_postings * y.ma_pct_postings_ai_skills).sum() / y.ma_job_postings.sum())


# ---------------------------------------------------------------- Lightcast per SOC
def wrate(g, post_col, pct_col):
    m = g[pct_col].notna() & (g[post_col] > 0)
    if not m.any():
        return np.nan
    return float(np.average(g.loc[m, pct_col], weights=g.loc[m, post_col]))


def lightcast_by_soc(prof, xw):
    """Per (SOC, year): postings, rates, confidence. Plus 2025-US-weighted exposure per SOC."""
    p = prof[~prof.is_unclassified].copy()
    p["soc"] = p.onet.map(xw)
    p = p.dropna(subset=["soc"])

    rows = []
    for (soc, yr), g in p.groupby(["soc", "year"]):
        ma_post, us_post = g.ma_job_postings.sum(), g.us_job_postings.sum()
        rows.append({
            "soc": soc, "year": yr, "ma_postings": ma_post, "us_postings": us_post,
            "ma_conf": confidence(ma_post), "us_conf": confidence(us_post),
            "ma_ai": wrate(g, "ma_job_postings", "ma_pct_postings_ai_skills"),
            "us_ai": wrate(g, "us_job_postings", "us_pct_postings_ai_skills"),
            "ma_genai": wrate(g, "ma_job_postings", "ma_pct_postings_genai_skills"),
            "us_genai": wrate(g, "us_job_postings", "us_pct_postings_genai_skills"),
        })
    by_year = pd.DataFrame(rows)
    for geo in ("ma", "us"):  # THIN rates are blank
        thin = by_year[f"{geo}_conf"] == "THIN"
        cols = [c for c in (f"{geo}_ai", f"{geo}_genai") if c in by_year]
        by_year.loc[thin, cols] = np.nan

    # exposure is constant across years; weight O*NET codes by 2025 US postings (as Lightcast does)
    e = p[p.year == YEAR].dropna(subset=["ai_exposure_index"])
    exposure = e.groupby("soc").apply(
        lambda g: np.average(g.ai_exposure_index, weights=g.us_job_postings.clip(lower=1)),
        include_groups=False)
    return by_year, exposure


# ---------------------------------------------------------------- O*NET per SOC
def onet_by_soc(onet_occ, edu, xw):
    o = onet_occ.assign(soc=onet_occ.ONET.map(xw)).dropna(subset=["soc"])
    job_zone = o.groupby("soc").JOB_ZONE.mean().round()

    rl = edu[edu.SCALE_ID == "RL"].copy()
    rl["bplus"] = np.where(rl.CATEGORY.isin(BACHELORS_PLUS), rl.PERCENT, 0.0)
    per_onet = rl.groupby("ONET").bplus.sum()
    bach = per_onet.groupby(per_onet.index.map(xw)).mean()
    return job_zone, bach


def skill_vectors(onet_skills, xw):
    imp = [c for c in onet_skills.columns if c.startswith("IMP_")]
    s = onet_skills.set_index("ONET")[imp].dropna(how="all")
    vec = s.groupby(s.index.map(xw)).mean()
    vec.columns = [c[4:].replace("_", " ").capitalize() for c in imp]
    return vec.dropna()


# ---------------------------------------------------------------- AEI per SOC
def aei_share(aei_occ, xw):
    us = aei_occ[aei_occ.AREA == "US"]
    per_onet = us.groupby("ONET").AEI_PCT.mean()  # Apr-May average
    return per_onet.groupby(per_onet.index.map(xw)).sum()


def aei_tasks(aei_long, tasks, xw):
    t = aei_long[(aei_long.AREA == "US") & (aei_long.CATEGORY_NAME == "onet")
                 & (aei_long.HIERARCHY_LEVEL == 0) & (aei_long.METRIC_ID == "pct")]
    pct = t.groupby("NODE_EXTERNAL_ID").VALUE.mean()
    j = tasks.assign(soc=tasks.ONET.map(xw), pct=tasks.TASK_ID.map(pct)).dropna(subset=["soc", "pct"])
    j = j.sort_values("pct", ascending=False).drop_duplicates(["soc", "TASK"])
    return {soc: [[r.TASK, round(float(r.pct), 3)] for r in g.head(4).itertuples()]
            for soc, g in j.groupby("soc")}


# ---------------------------------------------------------------- Lightcast skills
def top_skills(lc_skills, xw, ma_conf):
    """2025 top skills per SOC: MA if the SOC's MA postings are not THIN, else US.
    Multi-O*NET SOCs: postings with skill summed over member codes / SOC postings."""
    s = lc_skills[(lc_skills.year == YEAR) & ~lc_skills.is_unclassified].copy()
    s["soc"] = s.onet.map(xw)
    s = s.dropna(subset=["soc"])
    s["geo_pick"] = np.where(s.soc.map(ma_conf).fillna("THIN") == "THIN", "US", "MA")
    s = s[s.geography == s.geo_pick]
    denom = s.drop_duplicates(["soc", "onet"]).groupby("soc").job_postings.sum()
    agg = (s.groupby(["soc", "geo_pick", "skill_type", "skill_name"])
           .agg(n=("job_postings_with_skill", "sum"), ai=("is_ai_skill", "max")).reset_index())
    agg["pct"] = 100 * agg.n / agg.soc.map(denom)
    out = {}
    for soc, g in agg.groupby("soc"):
        rows = []
        for t, code, k in (("Specialized Skill", "S", 6), ("Common Skill", "C", 6), ("Certification", "R", 4)):
            for r in g[g.skill_type == t].nlargest(k, "pct").itertuples():
                rows.append([code, r.skill_name, round(float(r.pct), 1), r.geo_pick, bool(r.ai)])
        out[soc] = rows
    return out


# ---------------------------------------------------------------- strengths + paths
def strengths(vec, emp):
    w = emp.reindex(vec.index).fillna(0)
    mean = (vec.mul(w, axis=0).sum() / w.sum())
    out = {}
    for soc, row in vec.iterrows():
        d = (row - mean).round(2).sort_values(ascending=False)
        d = d[d > 0].head(4)
        if len(d):
            out[soc] = [[k, round(float(row[k]), 2), round(float(v), 2)] for k, v in d.items()]
    return out


def cosine_matrix(vec):
    """Cosine of importance vectors after removing the profile every job shares.
    SIM_METHOD "zscore": z-score each skill across occupations (default; matches only on
    what makes a job distinctive). "row": center each occupation's own vector (Pearson; the
    prototype's choice, which scores most pairs high, e.g. medical secretary ~ IT support 0.79)."""
    if SIM_METHOD == "row":
        z = vec.sub(vec.mean(axis=1), axis=0)
    else:
        z = (vec - vec.mean()) / vec.std(ddof=0).replace(0, 1)
    x = z.values / np.linalg.norm(z.values, axis=1, keepdims=True)
    with np.errstate(all="ignore"):  # spurious Accelerate BLAS warnings on macOS
        return pd.DataFrame(x @ x.T, index=vec.index, columns=vec.index)


def paths(occ, vec):
    sim = cosine_matrix(vec)
    o = occ.set_index("soc")
    out = {}
    for soc in sim.index:
        cur = o.loc[soc]
        if pd.isna(cur.ma_median_wage) or pd.isna(cur.job_zone):
            continue
        cur_ai = 0.0 if pd.isna(cur.ma_ai_2025) else cur.ma_ai_2025
        cand = o.loc[sim.columns.drop(soc)].assign(sim=sim.loc[soc].drop(soc))
        ok = cand[(cand.sim >= PATH_MIN_SIM) & (cand.ma_median_wage >= cur.ma_median_wage)
                  & (cand.job_zone <= cur.job_zone + 1) & (cand.ma_employment >= PATH_MIN_EMP)
                  & (cand.ma_ai_2025 > cur_ai)]
        rows = []
        for t, r in ok.sort_values("sim", ascending=False).head(PATH_MAX).iterrows():
            gap = (vec.loc[t] - vec.loc[soc]).sort_values(ascending=False).head(3)
            rows.append([t, round(float(r.sim), 3), round(float(r.ma_median_wage - cur.ma_median_wage), 0),
                         ", ".join(gap.index)])
        if rows:
            out[soc] = rows
    return out


# ---------------------------------------------------------------- software's path
def software_curve(prof):
    """US % of Software Developers postings asking for GenAI skills, by year."""
    s = prof[prof.onet == SOFTWARE_ONET].sort_values("year")
    return [[int(r.year), round(float(r.us_pct_postings_genai_skills), 2)]
            for r in s.itertuples() if int(r.year) in TREND_YEARS]


def years_behind(us_2026, curve):
    """Shared method: the year t* when software had this job's 2026 US GenAI %, by linear
    interpolation; years_behind = 2026 - t*, rounded to 0.5. Returns (value, status)."""
    if us_2026 is None or pd.isna(us_2026):
        return None, "too_few_ads"
    yrs = [c[0] for c in curve]
    vals = [c[1] for c in curve]
    if us_2026 >= vals[-1]:
        return 0.0, "level"
    if us_2026 < vals[0]:
        return None, "not_started"
    t = float(np.interp(us_2026, vals, yrs))  # software's curve rises every year
    return round((yrs[-1] - t) * 2) / 2, "behind"


# ---------------------------------------------------------------- assemble
def quadrant(exposure, ma_ai, conf, rate):
    if conf == "THIN" or ma_ai is None or pd.isna(ma_ai):
        return THIN_LABEL
    return LABELS[(exposure > EXPOSURE_CUT, ma_ai >= rate)]


def silent_gap(exposure, ma_ai, conf):
    if conf == "THIN" or ma_ai is None or pd.isna(ma_ai):
        return False
    return bool(exposure > EXPOSURE_CUT and ma_ai < SILENT_CUT)


def wmedian(v, w):
    order = np.argsort(v)
    v, w = np.asarray(v)[order], np.asarray(w)[order]
    return float(v[np.searchsorted(np.cumsum(w), w.sum() / 2)])


def build():
    d = load()
    oews = d["oews"]
    ma = oews[(oews.AREA == "MA") & oews.EMPLOYMENT.notna()].set_index("SOC_2018")
    us = oews[oews.AREA == "US"].set_index("SOC_2018")
    xw = build_crosswalk(d["prof"], d["onet_occ"], set(us.index))
    rate = round(state_rate(d["prof"]), 2)

    by_year, exposure = lightcast_by_soc(d["prof"], xw)
    y25 = by_year[by_year.year == YEAR].set_index("soc")
    job_zone, bach = onet_by_soc(d["onet_occ"], d["edu"], xw)
    claude = aei_share(d["aei_occ"], xw)
    groups = (d["prof"].drop_duplicates("soc_2").set_index("soc_2").soc_2_name
              .str.replace(" Occupations", "", regex=False))

    socs = [s for s in ma.index if s in exposure.index]
    occ = pd.DataFrame({
        "soc": socs,
        "title": [ma.OEWS_TITLE[s] for s in socs],
        "major_group": [groups.get(s[:2] + "-0000") for s in socs],
        "exposure": [round(float(exposure[s]), 1) for s in socs],
        "ma_ai_2025": [y25.ma_ai.get(s) for s in socs],
        "us_ai_2025": [y25.us_ai.get(s) for s in socs],
        "ma_genai_2025": [y25.ma_genai.get(s) for s in socs],
        "ma_confidence": [y25.ma_conf.get(s, "THIN") for s in socs],
        "ma_employment": [float(ma.EMPLOYMENT[s]) for s in socs],
        "ma_median_wage": [ma.A_MEDIAN[s] for s in socs],
        "us_median_wage": [us.A_MEDIAN.get(s) for s in socs],
        "bachelors_plus_pct": [bach.get(s) for s in socs],
        "job_zone": [job_zone.get(s) for s in socs],
        "claude_share_us": [claude.get(s) for s in socs],
    })
    rates = ["ma_ai_2025", "us_ai_2025", "ma_genai_2025"]
    occ[rates] = occ[rates].astype(float).round(2)  # rules compare the published (rounded) values
    occ["quadrant"] = [quadrant(r.exposure, r.ma_ai_2025, r.ma_confidence, rate) for r in occ.itertuples()]
    occ["silent_gap"] = [silent_gap(r.exposure, r.ma_ai_2025, r.ma_confidence) for r in occ.itertuples()]

    vec = skill_vectors(d["onet_skills"], xw)
    vec = vec[vec.index.isin(socs)]
    emp = occ.set_index("soc").ma_employment

    trend = {}
    for soc, g in by_year[by_year.soc.isin(socs)].groupby("soc"):
        g = g.set_index("year")
        trend[soc] = [[yr, num(g.ma_ai.get(yr)), num(g.us_ai.get(yr))] for yr in TREND_YEARS if yr in g.index]

    soft = software_curve(d["prof"])
    genai = {}
    for soc, g in by_year[by_year.soc.isin(socs)].groupby("soc"):
        g = g.set_index("year")
        genai[soc] = [[yr, num(g.ma_genai.get(yr)), num(g.us_genai.get(yr))] for yr in TREND_YEARS if yr in g.index]

    growth = load_growth()
    gocc = growth.get("occ", {})
    out_occ = []
    for r in occ.to_dict("records"):
        rec = {k: r[k] for k in ("soc", "title", "major_group", "exposure")}
        rec.update(ma_ai_2025=num(r["ma_ai_2025"]), us_ai_2025=num(r["us_ai_2025"]),
                   ma_genai_2025=num(r["ma_genai_2025"]), ma_confidence=r["ma_confidence"],
                   ma_employment=r["ma_employment"], ma_median_wage=num(r["ma_median_wage"], 0),
                   us_median_wage=num(r["us_median_wage"], 0), quadrant=r["quadrant"], silent_gap=bool(r["silent_gap"]),
                   bachelors_plus_pct=num(r["bachelors_plus_pct"], 1), job_zone=num(r["job_zone"], 0),
                   claude_share_us=num(r["claude_share_us"], 3))
        us26 = {row[0]: row[2] for row in genai.get(r["soc"], [])}.get(TREND_YEARS[-1])
        rec["years_behind_software"], rec["software_path_status"] = years_behind(us26, soft)
        g = gocc.get(r["soc"], {})
        rec["ma_growth_pct"] = g.get("growth_pct")
        rec["ma_growth_since"] = g.get("since")
        rec["ma_growth_vs_all"] = g.get("vs_all_pts")
        rec["ma_growth_status"] = g.get("status", "too_little_data")
        out_occ.append(rec)

    # MA job change 2019 -> 2025 for each group (and the silent gap), summed over jobs with both years.
    sums = {}
    for rec in out_occ:
        series = dict((y, v) for y, v in gocc.get(rec["soc"], {}).get("emp", []))
        if 2019 in series and 2025 in series:
            for k in [rec["quadrant"]] + (["Silent gap"] if rec["silent_gap"] else []):
                tot = sums.setdefault(k, [0.0, 0.0]); tot[0] += series[2019]; tot[1] += series[2025]
    group_growth = {k: round(100 * (end / start - 1), 1) for k, (start, end) in sums.items() if start}

    result = {
        "meta": {
            "group_growth": group_growth,
            "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "state_rate_2025": rate,
            "exposure_cut": EXPOSURE_CUT,      # Lightcast band: Medium-high starts at 50
            "silent_cut": SILENT_CUT,
            "software_genai_us": soft,
            "ma_growth": growth.get("meta", {}),
            "sources": [
                "Lightcast AI Exposure & Augmentation Index (October 2026) and job postings 2023-2026 (2026 = Jan-Sep). Data Source: Lightcast, 2026.",
                "BLS OEWS May 2025, Massachusetts and US",
                "O*NET 31.0 (August 2026): skills, education (RL), job zones, tasks",
                "Anthropic Economic Index, June 2026 release (Claude.ai usage, Apr-May 2026, US)",
            ],
        },
        "occ": out_occ,
        "trend": trend,
        "genai": genai,
        "growth": {s: gocc[s]["emp"] for s in socs if s in gocc},
        "tasks": {s: v for s, v in aei_tasks(d["aei_long"], d["tasks"], xw).items() if s in set(socs)},
        "skills": top_skills(d["lc_skills"], xw, occ.set_index("soc").ma_confidence),
        "strengths": strengths(vec, emp),
        "paths": paths(occ, vec),
    }
    result["skills"] = {s: v for s, v in result["skills"].items() if s in set(socs)}
    return result


def load_growth():
    """MA job growth 2019-2025 from pipeline/growth.py (data/ma_growth.json). Built here if the
    OEWS history files are present; empty if not (the page then hides the growth panel)."""
    path = HERE.parent / "data" / "ma_growth.json"
    if not path.exists():
        try:
            import growth as growth_mod  # pipeline/growth.py
            if list(growth_mod.SRC.glob("state_*.xlsx")):
                return growth_mod.build()
        except Exception as e:  # missing history files should not stop the main build
            print(f"growth step skipped: {e}")
        return {}
    return json.loads(path.read_text())


def summarize(res):
    occ = pd.DataFrame(res["occ"])
    print(f"occupations: {len(occ)}  MA workers: {occ.ma_employment.sum():,.0f}")
    print(f"state rate 2025: {res['meta']['state_rate_2025']}  exposure cut: {EXPOSURE_CUT} "
          f"(MA-employment median, not used: {wmedian(occ.exposure, occ.ma_employment):.1f})")
    q = occ.groupby("quadrant").agg(occupations=("soc", "size"), ma_workers=("ma_employment", "sum"))
    print(q.to_string())
    total = occ.ma_employment.sum()
    for name, m in (("broad gap", occ.quadrant == LABELS[(True, False)]), ("silent gap", occ.silent_gap)):
        w = occ.ma_employment[m].sum()
        print(f"{name}: {int(m.sum())} jobs, {w:,.0f} MA workers ({100 * w / total:.1f}%)")
    print({k: len(res[k]) for k in ("trend", "genai", "tasks", "skills", "strengths", "paths")})
    print("software GenAI US:", res["meta"]["software_genai_us"])
    print(occ.software_path_status.value_counts().to_dict())


def main():
    if not DATA.exists():
        sys.exit(f"data folder not found: {DATA} (set SGI_DATA)")
    res = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(res, separators=(",", ":"), allow_nan=False))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.2f} MB)")
    summarize(res)


if __name__ == "__main__":
    main()
