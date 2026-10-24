"""Writes tests/fixtures/careerbridge_synthetic.json: MADE-UP numbers in the real file's shape (see CONTRACT.md).

Lets the Lightcast panels and the workforce board be tested and demoed without the licensed data.
The file says meta.synthetic = true and the page shows a banner. Never present these numbers as real.
Run: python tests/make_fixture.py   (needs data/atlas.json from pipeline/atlas.py)
"""
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
rnd = random.Random(7)
atlas = json.load(open(ROOT / "data" / "atlas.json"))
occ = [o for o in atlas["occ"] if o["ma_jobs"]][:90]
SOFT = [[2023, 0.5], [2024, 2.0], [2025, 7.0], [2026, 14.0]]
QUADS = ["High exposure, low adoption", "High exposure, high adoption", "Lower exposure, high adoption", "Lower exposure, low adoption"]

out = {"meta": {"synthetic": True, "built_at": "2000-01-01T00:00:00Z", "state_rate_2025": 6.18, "exposure_cut": 50.0, "silent_cut": 1.0,
                "software_genai_us": SOFT, "ma_growth": {"all_jobs": [[y, 3.4e6 + (y - 2019) * 3e4] for y in range(2019, 2026)], "all_growth_pct": 5.3}},
       "occ": [], "trend": {}, "genai": {}, "growth": {}, "tasks": {}, "skills": {}, "strengths": {}, "paths": {}}
for o in occ:
    exp = round(rnd.uniform(35, 80), 1)
    ads = None if rnd.random() < 0.1 else round(rnd.uniform(0.1, 20), 2)
    quad = "Too few MA job ads to measure" if ads is None else {(True, False): QUADS[0], (True, True): QUADS[1], (False, True): QUADS[2], (False, False): QUADS[3]}[(exp > 50, ads >= 6.18)]
    gen = round(rnd.uniform(0, 12), 2)
    out["occ"].append({"soc": o["soc"], "title": o["title"], "major_group": o["group"], "exposure": exp, "ma_ai_2025": ads, "us_ai_2025": round(rnd.uniform(0.2, 15), 2),
        "ma_genai_2025": None, "ma_confidence": "THIN" if ads is None else "HIGH", "ma_employment": o["ma_jobs"], "ma_median_wage": o["ma_wage"], "us_median_wage": o["us_wage"],
        "quadrant": quad, "bachelors_plus_pct": round(rnd.uniform(5, 95)), "job_zone": rnd.randint(1, 5), "claude_share_us": round(rnd.uniform(0, 3), 2),
        "years_behind_software": rnd.choice([0, 0.5, 1, 1.5, 2]), "software_path_status": rnd.choice(["behind", "level", "not_started", "too_few_ads"]),
        "ma_growth_pct": round(rnd.uniform(-20, 30), 1), "ma_growth_since": 2019, "ma_growth_status": rnd.choice(["faster", "slower", "similar"]), "ma_growth_vs_all": 3.0})
    out["trend"][o["soc"]] = [[y, round(rnd.uniform(0, 10), 2), round(rnd.uniform(0, 10), 2)] for y in (2023, 2024, 2025, 2026)]
    out["genai"][o["soc"]] = [[y, round(rnd.uniform(0, 5), 2), round(rnd.uniform(0, 8), 2)] for y in (2023, 2024, 2025, 2026)]
    out["growth"][o["soc"]] = [[y, int(o["ma_jobs"] * (0.9 + 0.03 * (y - 2019)))] for y in range(2019, 2026)]
    out["tasks"][o["soc"]] = [["Example task statement %d for this job." % i, round(rnd.uniform(0, 1), 2)] for i in range(1, 5)]
    out["skills"][o["soc"]] = [["S", "Example skill %d" % i, round(rnd.uniform(1, 30), 1), "MA", i == 1] for i in range(1, 4)] + [["C", "Communication", 40.0, "MA", False]]
    out["strengths"][o["soc"]] = [["Active listening", 4.2, 0.31], ["Critical thinking", 4.0, 0.22]]
sel = [o["soc"] for o in occ]
for i, s in enumerate(sel):
    out["paths"][s] = [[sel[(i + k) % len(sel)], round(0.8 - 0.03 * k, 2), 4000 * k, "Skill A, Skill B, Skill C"] for k in (1, 2, 3)]
dest = ROOT / "tests" / "fixtures" / "careerbridge_synthetic.json"
json.dump(out, open(dest, "w"), separators=(",", ":"))
print(f"wrote {dest.name}: {len(out['occ'])} made-up occupations")
