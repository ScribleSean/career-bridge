"""Checks data/atlas.json (built by pipeline/atlas.py) and the synthetic fixture.

Run: python -m unittest discover -s tests
"""
import json
import unittest
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


@unittest.skipUnless(FIXTURE.exists(), "fixture not built (python tests/make_fixture.py)")
class FixtureTest(unittest.TestCase):
    def test_marked_synthetic(self):
        self.assertTrue(json.load(open(FIXTURE))["meta"]["synthetic"])


if __name__ == "__main__":
    unittest.main()
