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
            "ma_confidence", "ma_employment", "ma_median_wage", "us_median_wage", "quadrant", "silent_gap",
            "bachelors_plus_pct", "job_zone", "claude_share_us",
            "years_behind_software", "software_path_status",
            "ma_growth_pct", "ma_growth_since", "ma_growth_vs_all", "ma_growth_status"}
QUADRANTS = {"High exposure, low adoption", "High exposure, high adoption",
             "Lower exposure, high adoption", "Lower exposure, low adoption",
             "Too few MA job ads to measure"}


@unittest.skipUnless(BUILT.exists(), "data/careerbridge.json not built (needs the Lightcast files; see README)")
class TestCareerBridge(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = json.loads(BUILT.read_text())
        cls.occ = {o["soc"]: o for o in cls.d["occ"]}
        cls.ref = json.loads(REF.read_text()) if REF.exists() else None

    def test_shape(self):
        self.assertTrue({"meta", "occ", "trend", "genai", "tasks", "skills", "strengths", "paths"} <= set(self.d))
        self.assertTrue(set(self.d) <= {"meta", "occ", "trend", "genai", "growth", "tasks", "skills", "strengths", "paths"})

    def test_growth(self):
        """MA growth 2019-2025 (present when OEWS history files were available at build time)."""
        if "growth" not in self.d:
            self.skipTest("built without OEWS history")
        g = self.d["meta"]["ma_growth"]
        self.assertEqual((g["first_year"], g["last_year"]), (2019, 2025))
        self.assertAlmostEqual(g["all_growth_pct"], 0.5, delta=0.2)
        occ = {o["soc"]: o for o in self.d["occ"]}
        rn = occ["29-1141"]
        self.assertEqual(rn["ma_growth_status"], "faster")
        series = dict(self.d["growth"]["29-1141"])
        self.assertAlmostEqual(rn["ma_growth_pct"], 100 * (series[2025] / series[2019] - 1), delta=0.1)
        self.assertEqual(series[2025], rn["ma_employment"])  # 2025 matches the OEWS May 2025 file
        for o in self.d["occ"]:
            self.assertIn(o["ma_growth_status"], {"faster", "slower", "similar", "too_little_data"})
        for k in ("built_at", "state_rate_2025", "exposure_cut", "silent_cut", "sources"):
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
        for key in ("trend", "genai", "tasks", "skills", "strengths", "paths"):
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
        rate, cut = self.d["meta"]["state_rate_2025"], 50
        self.assertEqual(self.d["meta"]["exposure_cut"], 50)
        for o in self.d["occ"]:
            q = o["quadrant"]
            self.assertIn(q, QUADRANTS)
            if o["ma_confidence"] == "THIN" or o["ma_ai_2025"] is None:
                self.assertEqual(q, "Too few MA job ads to measure", o["soc"])
                continue
            high_exp, high_ad = o["exposure"] > cut, o["ma_ai_2025"] >= rate
            self.assertEqual(q.startswith("High exposure"), high_exp, o["soc"])
            self.assertEqual(q.endswith("high adoption"), high_ad, o["soc"])

    def test_silent_gap(self):
        self.assertEqual(self.d["meta"]["silent_cut"], 1)
        for o in self.d["occ"]:
            want = (o["ma_confidence"] != "THIN" and o["ma_ai_2025"] is not None
                    and o["exposure"] > 50 and o["ma_ai_2025"] < 1)
            self.assertIs(o["silent_gap"], want, o["soc"])
            if want:
                self.assertEqual(o["quadrant"], "High exposure, low adoption", o["soc"])

    def test_group_counts(self):
        occ = self.d["occ"]
        total = sum(o["ma_employment"] for o in occ)
        gap = [o for o in occ if o["quadrant"] == "High exposure, low adoption"]
        silent = [o for o in occ if o["silent_gap"]]
        self.assertEqual(len(occ), 659)
        self.assertEqual(total, 3568980)
        self.assertEqual(len(gap), 256)
        self.assertEqual(sum(o["ma_employment"] for o in gap), 1515420)
        self.assertEqual(len(silent), 99)
        self.assertEqual(sum(o["ma_employment"] for o in silent), 525540)
        self.assertAlmostEqual(100 * 525540 / total, 14.7, places=1)

    def test_nurses_silent_gap(self):
        o = self.occ["29-1141"]
        self.assertGreater(o["exposure"], 50)
        self.assertEqual(o["quadrant"], "High exposure, low adoption")
        self.assertTrue(o["silent_gap"])

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

    # ---- following software's path ----
    def software_years_behind(self, us26):
        c = self.d["meta"]["software_genai_us"]
        if us26 is None:
            return None, "too_few_ads"
        if us26 >= c[-1][1]:
            return 0.0, "level"
        if us26 < c[0][1]:
            return None, "not_started"
        for (y0, v0), (y1, v1) in zip(c, c[1:]):
            if v0 <= us26 <= v1:
                t = y0 + (us26 - v0) / (v1 - v0) * (y1 - y0)
                return round((2026 - t) * 2) / 2, "behind"

    def test_software_curve(self):
        known = {2023: 0.47, 2024: 2.25, 2025: 5.92, 2026: 13.91}
        c = dict(map(tuple, self.d["meta"]["software_genai_us"]))
        self.assertEqual(set(c), set(known))
        for yr, v in known.items():
            self.assertAlmostEqual(c[yr], v, delta=0.05, msg=yr)

    def test_genai_shape(self):
        for soc, rows in self.d["genai"].items():
            self.assertTrue(all(len(r) == 3 and 2023 <= r[0] <= 2026 for r in rows), soc)

    def test_years_behind_rule(self):
        self.assertEqual(self.occ["15-1252"]["software_path_status"], "level")
        self.assertEqual(self.occ["15-1252"]["years_behind_software"], 0)
        statuses = set()
        for o in self.d["occ"]:
            us26 = {r[0]: r[2] for r in self.d["genai"].get(o["soc"], [])}.get(2026)
            yb, st = self.software_years_behind(us26)
            self.assertEqual(o["software_path_status"], st, o["soc"])
            self.assertEqual(o["years_behind_software"], yb, o["soc"])
            statuses.add(st)
        self.assertEqual(statuses, {"level", "behind", "not_started", "too_few_ads"})
        self.assertIn(self.occ["27-1011"]["years_behind_software"], (0.5, 1.0))  # Art Directors

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
                if k == "quadrant" and b.startswith("Lower exposure") and 50 < ro["exposure"] <= 55.7:
                    b = b.replace("Lower exposure", "High exposure")  # reference used the old 55.7 cut
                bad = (a != b) if isinstance(a, str) or a is None or b is None else abs(a - b) > 0.5
                if bad:
                    differ.setdefault(k, []).append(soc)
        n = len({s for v in differ.values() for s in v})
        print(f"\n  reference: {len(ref)} occ, build: {len(self.occ)} occ, "
              f"{n} shared occ differ on core fields {({k: len(v) for k, v in differ.items()})}")
        self.assertLessEqual(n, len(ref) * 0.05)


if __name__ == "__main__":
    unittest.main(verbosity=2)
