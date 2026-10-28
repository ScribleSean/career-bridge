"""Checks data/atlas.json (built by pipeline/atlas.py) and the synthetic fixture.

Run: python -m unittest discover -s tests
"""
import json
import unittest
from io import StringIO
from unittest.mock import patch

try:
    import pandas as pd
    from pipeline import atlas
except ImportError:  # the pipeline needs pandas; the data checks below don't
    pd = None
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ATLAS = ROOT / "data" / "atlas.json"
FIXTURE = ROOT / "tests" / "fixtures" / "careerbridge_synthetic.json"
POSTURES = {"Stay the course", "Upskill in place", "Stay and reposition", "Prepare to move"}


@unittest.skipUnless(ATLAS.exists(), "data/atlas.json not built (python pipeline/atlas.py)")
class AtlasTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = json.load(open(ATLAS))
        cls.by = {o["soc"]: o for o in cls.d["occ"]}

    def test_shape(self):
        self.assertGreater(len(self.d["occ"]), 800)
        self.assertEqual(set(self.d["plans"]), set(self.by))
        self.assertEqual(set(self.d["meta"]["scenarios"]), {"slow", "base", "fast"})

    def test_values_in_range(self):
        for o in self.d["occ"]:
            self.assertTrue(0 <= o["z"] <= 100 and 0 <= o["auto"] <= 100, o["soc"])
            self.assertIn(o["posture"], POSTURES)
            self.assertGreater(o["us_jobs"], 0)

    def test_moves_point_at_real_jobs(self):
        for soc, p in self.d["plans"].items():
            self.assertLessEqual(len(p["moves"]), 4)
            for m in p["moves"]:
                self.assertIn(m["soc"], self.by)
                self.assertNotEqual(m["soc"], soc)
            if self.by[soc]["tier"] == "Low":
                self.assertEqual(p["moves"], [], "low-exposure jobs show no moves")

    def test_no_lightcast_numbers(self):
        """atlas.json is public-safe: nothing from Lightcast may enter it."""
        text = json.dumps(self.d).lower()
        for banned in ("lightcast", "ai_exposure_index", "ma_ai_2025", "pct_postings"):
            self.assertNotIn(banned, text)

    def test_usage_shares(self):
        uc = {u["name"]: u for u in self.d["usage"]["use_case"]}
        self.assertAlmostEqual(sum(u["may"] for u in uc.values()), 100, delta=1.5)


@unittest.skipIf(pd is None, "pandas not installed")
class AtlasBuildTest(unittest.TestCase):
    """Runs pipeline/atlas.py on fake inputs."""
    @classmethod
    def setUpClass(cls):
        risk = pd.DataFrame([{
            "SOC_2018": "11-0001", "title": "Example job", "major_group": "Example",
            "emp2025": 100, "wage2025": 50000, "g": .05, "cagr_19_25": .12,
            "z": .5, "z_basis": "usage+content", "auto_share": .2, "tier": "Low",
        }])
        oews = pd.DataFrame([{"AREA": "MA", "SOC_2018": "11-0001", "EMPLOYMENT": 10, "A_MEDIAN": 60000}])
        metrics = pd.DataFrame([
            {"AREA": "US", "CATEGORY_NAME": "overall", "METRIC_ID": k, "DATE_START": month, "VALUE": v}
            for month in ("2026-04-01", "2026-05-01")
            for k, v in [("use_case_work_pct", 60), ("use_case_personal_pct", 30), ("use_case_coursework_pct", 10), ("collaboration_bucket_automation_pct", 20)]
        ] + [{"AREA": "US", "CATEGORY_NAME": "request", "HIERARCHY_LEVEL": 2, "METRIC_ID": "pct", "NODE_NAME": "Example", "DATE_START": month, "VALUE": 10}
             for month in ("2026-04-01", "2026-05-01")])
        plans = [{"soc": "11-0001", "posture": "Stay the course", "why": "Example", "lean_into": "[]", "use_claude_for": "[]", "moves": "[]", "timeline": "[]"}]
        def build(frame):
            with patch.object(atlas.pd, "read_csv", side_effect=[frame, oews, metrics]), patch("builtins.open", return_value=StringIO(json.dumps(plans))):
                return atlas.build()
        cls.d = build(risk)
        cls.without_growth = build(risk.drop(columns=["cagr_19_25"]))
        cls.null_growth = build(risk.assign(cagr_19_25=float("nan")))

    def test_uncapped_growth_keeps_scenario_growth(self):
        self.assertEqual(self.d["occ"][0]["growth_pct"], 12)
        self.assertEqual(self.d["occ"][0]["g"], 5)
        for d in (self.without_growth, self.null_growth):
            self.assertIsNone(d["occ"][0]["growth_pct"])
            self.assertEqual(d["occ"][0]["g"], 5)


@unittest.skipUnless(FIXTURE.exists(), "fixture not built (python tests/make_fixture.py)")
class FixtureTest(unittest.TestCase):
    def test_marked_synthetic(self):
        self.assertTrue(json.load(open(FIXTURE))["meta"]["synthetic"])


if __name__ == "__main__":
    unittest.main()
