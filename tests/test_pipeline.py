"""Checks the built careerbridge.json against CONTRACT.md and the teammate's prototype.

Run:  python pipeline/build.py && python -m unittest tests/test_pipeline.py -v
Stdlib only. Skips the reference comparison if reference_prototype.json is missing.
"""
import json
import unittest
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
BUILT = DATA / "careerbridge.json"
REF = DATA / "reference_prototype.json"

OCC_KEYS = {"soc", "title", "major_group", "exposure", "ma_ai_2025", "us_ai_2025", "ma_genai_2025",
            "ma_confidence", "ma_employment", "ma_median_wage", "us_median_wage", "quadrant",
            "bachelors_plus_pct", "job_zone", "claude_share_us"}
QUADRANTS = {"High exposure, low adoption", "High exposure, high adoption",
             "Lower exposure, high adoption", "Lower exposure, low adoption",
             "Too few MA job ads to measure"}


class TestCareerBridge(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = json.loads(BUILT.read_text())
        cls.occ = {o["soc"]: o for o in cls.d["occ"]}
        cls.ref = json.loads(REF.read_text()) if REF.exists() else None

    def test_shape(self):
        self.assertEqual(set(self.d), {"meta", "occ", "trend", "tasks", "skills", "strengths", "paths"})
        for k in ("built_at", "state_rate_2025", "exposure_median", "sources"):
            self.assertIn(k, self.d["meta"])
        for o in self.d["occ"]:
            self.assertEqual(set(o), OCC_KEYS, o["soc"])
            self.assertIn(o["ma_confidence"], {"HIGH", "MEDIUM", "LOW", "THIN"})
            self.assertNotIn("Occupations", o["major_group"] or "")
        for soc, rows in self.d["trend"].items():
            self.assertTrue(all(len(r) == 3 and 2023 <= r[0] <= 2026 for r in rows), soc)
        for soc, rows in self.d["tasks"].items():
            self.assertTrue(1 <= len(rows) <= 4 and all(len(r) == 2 for r in rows), soc)
        for soc, rows in self.d["skills"].items():
            for t, lim in (("S", 6), ("C", 6), ("R", 4)):
                self.assertLessEqual(sum(r[0] == t for r in rows), lim, soc)
            self.assertTrue(all(len(r) == 5 and r[3] in ("MA", "US") for r in rows), soc)
        for soc, rows in self.d["strengths"].items():
            self.assertTrue(len(rows) <= 4 and all(r[2] > 0 for r in rows), soc)
        for key in ("trend", "tasks", "skills", "strengths", "paths"):
            self.assertTrue(set(self.d[key]) <= set(self.occ), key)

    def test_no_duplicate_socs(self):
        socs = [o["soc"] for o in self.d["occ"]]
        self.assertEqual(len(socs), len(set(socs)))

    def test_employment_total_not_inflated(self):
        total = sum(o["ma_employment"] for o in self.d["occ"])
        self.assertTrue(3.3e6 <= total <= 3.6e6, total)  # MA OEWS released rows total 3.58M

    def test_state_rate(self):
        self.assertAlmostEqual(self.d["meta"]["state_rate_2025"], 6.18, places=2)

    def test_quadrants(self):
        rate, cut = self.d["meta"]["state_rate_2025"], 55.7
        for o in self.d["occ"]:
            q = o["quadrant"]
            self.assertIn(q, QUADRANTS)
            if o["ma_confidence"] == "THIN" or o["ma_ai_2025"] is None:
                self.assertEqual(q, "Too few MA job ads to measure", o["soc"])
                continue
            high_exp, high_ad = o["exposure"] > cut, o["ma_ai_2025"] >= rate
            self.assertEqual(q.startswith("High exposure"), high_exp, o["soc"])
            self.assertEqual(q.endswith("high adoption"), high_ad, o["soc"])

    def test_thin_rates_blank(self):
        for o in self.d["occ"]:
            if o["ma_confidence"] == "THIN":
                self.assertIsNone(o["ma_ai_2025"], o["soc"])
                self.assertIsNone(o["ma_genai_2025"], o["soc"])

    def test_path_rules(self):
        n = 0
        for soc, rows in self.d["paths"].items():
            cur = self.occ[soc]
            self.assertLessEqual(len(rows), 10, soc)
            sims = [r[1] for r in rows]
            self.assertEqual(sims, sorted(sims, reverse=True), soc)
            for target, sim, wage_diff, bridge in rows:
                t = self.occ[target]
                n += 1
                self.assertNotEqual(target, soc)
                self.assertGreaterEqual(sim, 0.70)
                self.assertGreaterEqual(t["ma_median_wage"], cur["ma_median_wage"])
                self.assertAlmostEqual(wage_diff, t["ma_median_wage"] - cur["ma_median_wage"], delta=1)
                self.assertLessEqual(t["job_zone"], cur["job_zone"] + 1)
                self.assertGreaterEqual(t["ma_employment"], 1000)
                self.assertGreater(t["ma_ai_2025"], cur["ma_ai_2025"] or 0)
                self.assertEqual(len(bridge.split(", ")), 3)
        self.assertGreater(n, 1000)

    def test_medical_secretaries(self):
        o = self.occ["43-6013"]
        self.assertAlmostEqual(o["exposure"], 64.0, delta=0.5)
        self.assertAlmostEqual(o["ma_ai_2025"], 0.37, delta=0.5)
        self.assertEqual(o["quadrant"], "High exposure, low adoption")

    def test_close_to_reference(self):
        if self.ref is None:
            self.skipTest("no reference_prototype.json")
        ref = {o["soc"]: o for o in self.ref["occ"]}
        self.assertTrue(set(ref) <= set(self.occ), "reference SOCs missing from build")
        r = ref["43-6013"]
        o = self.occ["43-6013"]
        self.assertAlmostEqual(o["exposure"], r["exposure"], delta=0.5)
        self.assertAlmostEqual(o["ma_ai_2025"], r["ma_ai_2025"], delta=0.5)
        differ = {}
        for soc, ro in ref.items():
            mo = self.occ[soc]
            for k in ("exposure", "ma_ai_2025", "ma_employment", "quadrant", "ma_confidence"):
                a, b = mo[k], ro[k]
                bad = (a != b) if isinstance(a, str) or a is None or b is None else abs(a - b) > 0.5
                if bad:
                    differ.setdefault(k, []).append(soc)
        n = len({s for v in differ.values() for s in v})
        print(f"\n  reference: {len(ref)} occ, build: {len(self.occ)} occ, "
              f"{n} shared occ differ on core fields {({k: len(v) for k, v in differ.items()})}")
        self.assertLessEqual(n, len(ref) * 0.05)


if __name__ == "__main__":
    unittest.main(verbosity=2)
