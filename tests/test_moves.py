"""Nearby jobs (pipeline/moves.py): O*NET-related only, skill match then pay, never AI use.

Run: python -m unittest discover -s tests
"""
import json
import unittest
from pathlib import Path

from pipeline import moves

ROOT = Path(__file__).resolve().parent.parent
MINI = ROOT / "tests" / "fixtures" / "onet_mini"


class RankingRulesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = moves.build(MINI, MINI / "occupation_risk.csv")

    def test_only_jobs_onet_lists_as_related(self):
        socs = [x["soc"] for x in self.m["11-0001"]]
        self.assertNotIn("11-0004", socs, "an identical job O*NET doesn't list as related stays out")
        self.assertNotIn("11-0001", socs)
        self.assertEqual(self.m["11-0002"], [], "Supplemental-tier links don't count")

    def test_ranked_by_skill_match_and_big_pay_cuts_dropped(self):
        mv = self.m["11-0001"]
        self.assertEqual([x["soc"] for x in mv], ["11-0003", "11-0002"], "close match first, then the looser one; 11-0005 pays too little")
        self.assertEqual([x["looser_match"] for x in mv], [False, True])
        self.assertTrue(all(x["similarity"] > 0 for x in mv), "dissimilar related jobs are dropped")

    def test_skills_to_build_are_important_to_the_target(self):
        self.assertEqual(self.m["11-0001"][1]["skills_to_build"], ["Skills: Speaking", "Skills: Writing"])
        self.assertTrue(self.m["11-0001"][1]["looser_match"], "Primary-Long links are marked looser")

    def test_low_ai_use_jobs_keep_no_moves(self):
        self.assertEqual(self.m["11-0006"], [])

    def test_apply_keeps_the_timeline_in_step(self):
        atlas = {"occ": [{"soc": "a", "title": "Job A"}, {"soc": "b", "title": "Job B", "prep": "a year of training", "ma_jobs": 10}],
                 "plans": {"a": {"moves": [], "timeline": [
                     {"when": "Next 90 days", "text": "Keep a record of results. Start building physics."},
                     {"when": "Within 12 months", "text": "Decide whether to move toward Old Job (x). Talk to people in that role first."}]}}}
        moves.apply(atlas, {"a": [{"soc": "b", "similarity": 0.8, "looser_match": False, "skills_to_build": ["Knowledge: Law and Government"]}]})
        tl = atlas["plans"]["a"]["timeline"]
        self.assertEqual(tl[0]["text"], "Keep a record of results. Start building law and government.")
        self.assertEqual(tl[1]["text"], "Decide whether to move toward Job B (typically needs a year of training). Talk to people in that role first.")
        moves.apply(atlas, {"a": []})
        self.assertEqual(tl[0]["text"], "Keep a record of results.")
        self.assertEqual(tl[1]["text"], moves.NO_MOVE)

    def test_plan_names_the_first_move_the_page_shows(self):
        atlas = {"occ": [{"soc": "a", "title": "A"}, {"soc": "b", "title": "B", "ma_jobs": None}, {"soc": "c", "title": "C", "ma_jobs": 5, "prep": "x"}],
                 "plans": {"a": {"moves": [], "timeline": [{"when": "Within 12 months", "text": "Decide whether to move toward Old (x). Talk to people in that role first."}]}}}
        mv = lambda s: {"soc": s, "similarity": 0.8, "looser_match": False, "skills_to_build": []}
        moves.apply(atlas, {"a": [mv("b"), mv("c")]})
        self.assertIn("toward C (", atlas["plans"]["a"]["timeline"][0]["text"])

    def test_apply_leaves_plans_that_are_not_about_moving(self):
        steps = [{"when": "Next 90 days", "text": "Keep a record of results."}, {"when": "Within 12 months", "text": moves.NO_MOVE}]
        atlas = {"occ": [{"soc": "a", "title": "A"}, {"soc": "b", "title": "B"}], "plans": {"a": {"moves": [], "timeline": [dict(s) for s in steps]}}}
        moves.apply(atlas, {"a": [{"soc": "b", "similarity": 0.8, "looser_match": False, "skills_to_build": ["Skills: Writing"]}]})
        self.assertEqual(atlas["plans"]["a"]["timeline"], steps)
        self.assertEqual(atlas["plans"]["a"]["moves"][0]["soc"], "b")


class PublishedMovesTest(unittest.TestCase):
    """The committed moves.json, built from O*NET 31.0. These failed on the old analysis output."""

    @classmethod
    def setUpClass(cls):
        cls.m = json.load(open(ROOT / "pipeline" / "atlas_src" / "moves.json"))

    def test_top_move_stays_in_the_same_line_of_work(self):
        for soc, family in [("15-1252", "15-"), ("29-1141", "29-"), ("43-6014", "43-"), ("43-4051", "43-")]:
            self.assertTrue(self.m[soc][0]["soc"].startswith(family), (soc, self.m[soc][0]))

    def test_shape(self):
        for soc, mv in self.m.items():
            self.assertLessEqual(len(mv), moves.MAX_MOVES)
            self.assertNotIn(soc, [x["soc"] for x in mv])
            for x in mv:
                self.assertTrue(0 <= x["similarity"] <= 1)
                self.assertLessEqual(len(x["skills_to_build"]), 3)


if __name__ == "__main__":
    unittest.main()
