"""Tests for server.py against data/reference_prototype.json.

Run: python -m unittest discover -s tests
"""
import json
import os
import sys
import threading
import unittest
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import urlopen

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
os.environ["CB_QUIET"] = "1"

import server  # noqa: E402

REF = os.path.join(ROOT, "data", "reference_prototype.json")


@unittest.skipUnless(os.path.exists(REF), "reference_prototype.json not present")
class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.make_server(port=0, data_path=REF)
        cls.base = "http://127.0.0.1:%d" % cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def get(self, path):
        try:
            with urlopen(self.base + path, timeout=5) as r:
                return r.status, r.headers.get("Content-Type", ""), r.read()
        except HTTPError as e:
            return e.code, e.headers.get("Content-Type", ""), e.read()

    def json(self, path, status=200):
        code, ctype, body = self.get(path)
        self.assertEqual(code, status, path)
        self.assertIn("application/json", ctype)
        return json.loads(body)

    def titles(self, q):
        return [o["title"] for o in self.json("/api/occupations?q=" + quote(q))]

    # ---- meta ----
    def test_meta(self):
        m = self.json("/api/meta")
        self.assertTrue(m["using_reference"])
        self.assertIn("warning", m)
        self.assertEqual(m["state_rate_2025"], 6.18)
        self.assertEqual(m["exposure_median"], 55.7)
        self.assertGreater(m["counts"]["occ"], 500)
        self.assertIn("Office and Administrative Support", m["families"])

    # ---- search ----
    def test_search_shape(self):
        rows = self.json("/api/occupations?q=secretar")
        self.assertTrue(rows)
        self.assertEqual(set(rows[0]), {"soc", "title", "major_group", "ma_employment", "exposure", "ma_ai_2025", "quadrant"})
        emp = [r["ma_employment"] for r in rows]
        self.assertEqual(emp, sorted(emp, reverse=True))

    def test_search_aliases(self):
        cases = {
            "rn": "Registered Nurses",
            "admin": "Administrative",
            "cna": "Nursing Assistants",
            "cs": "Customer Service",
            "hr": "Human Resources",
            "it": "Computer",
            "dev": "Developers",
            "teacher": "Teachers",
            "nurse": "Nurse",
        }
        for alias, expect in cases.items():
            with self.subTest(alias=alias):
                t = self.titles(alias)
                self.assertTrue(t, alias)
                self.assertTrue(any(expect.lower() in x.lower() for x in t), (alias, t))

    def test_search_multiword_and_empty(self):
        self.assertIn("Medical Secretaries and Administrative Assistants", self.titles("medical admin"))
        self.assertEqual(self.titles("zzzqqq"), [])
        self.assertTrue(self.json("/api/occupations?q="))  # empty query: top jobs
        self.assertEqual(self.json("/api/occupations?q=43-6013")[0]["soc"], "43-6013")

    def test_search_bad_params(self):
        self.json("/api/occupations?q=%ZZ&limit=abc")
        self.json("/api/occupations?q=" + quote("<script>'\"%;"))

    # ---- detail ----
    def test_detail(self):
        d = self.json("/api/occupations/43-6013")
        self.assertEqual(d["occ"]["title"], "Medical Secretaries and Administrative Assistants")
        for k in ("trend", "tasks", "skills", "strengths", "paths"):
            self.assertIn(k, d)
        self.assertTrue(d["paths"])
        p = d["paths"][0]
        self.assertIn("title", p["target"])
        self.assertIsInstance(p["bridge_skills"], list)
        sims = [x["similarity"] for x in d["paths"]]
        self.assertEqual(sims, sorted(sims, reverse=True))

    def test_detail_404(self):
        for soc in ("99-9999", "nope", "43-6013x", "%2e%2e"):
            with self.subTest(soc=soc):
                body = self.json("/api/occupations/" + soc, status=404)
                self.assertIn("error", body)
        self.json("/api/nothing", status=404)

    # ---- board ----
    def test_board_default(self):
        b = self.json("/api/board")
        self.assertEqual(b["count"], len(b["rows"]))
        s = b["summary"]
        for k in ("gap_workers", "gap_share", "gap_count", "state_rate"):
            self.assertIn(k, s)
        self.assertGreater(s["gap_count"], 0)
        emp = [r["ma_employment"] for r in b["rows"]]
        self.assertEqual(emp, sorted(emp, reverse=True))

    def test_board_filters(self):
        q = "High exposure, low adoption"
        b = self.json("/api/board?quadrant=" + quote(q))
        self.assertTrue(b["rows"])
        self.assertTrue(all(r["quadrant"] == q for r in b["rows"]))
        self.assertEqual(b["count"], b["summary"]["gap_count"])
        fam = "Office and Administrative Support"
        b = self.json("/api/board?family=" + quote(fam) + "&q=clerk")
        self.assertTrue(b["rows"])
        self.assertTrue(all("clerk" in r["title"].lower() for r in b["rows"]))
        b = self.json("/api/board?quadrant=" + quote("No such group"))
        self.assertEqual(b["rows"], [])

    def test_board_sort(self):
        b = self.json("/api/board?sort=title&dir=asc")
        t = [r["title"].lower() for r in b["rows"]]
        self.assertEqual(t, sorted(t))
        b = self.json("/api/board?sort=ma_median_wage&dir=desc")
        w = [r["ma_median_wage"] for r in b["rows"]]
        present = [x for x in w if x is not None]
        self.assertEqual(present, sorted(present, reverse=True))
        self.assertTrue(all(x is None for x in w[len(present):]))  # nulls last
        b = self.json("/api/board?sort=DROP&dir=sideways")  # bad params fall back
        self.assertEqual(b["sort"], "ma_employment")

    # ---- static ----
    def test_static(self):
        code, ctype, body = self.get("/")
        self.assertEqual(code, 200)
        self.assertIn("text/html", ctype)
        self.assertIn(b"Career Bridge", body)
        for f, ct in (("/app.js", "javascript"), ("/styles.css", "text/css")):
            code, ctype, _ = self.get(f)
            self.assertEqual(code, 200, f)
            self.assertIn(ct, ctype)
        self.assertEqual(self.get("/../server.py")[0], 404)
        self.assertEqual(self.get("/%2e%2e/server.py")[0], 404)
        self.assertEqual(self.get("/missing.html")[0], 404)


if __name__ == "__main__":
    unittest.main()
