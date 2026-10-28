"""Tests for server.py against data/reference_prototype.json.

Run: python -m unittest discover -s tests
"""
import json
import io
import shutil
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
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


@unittest.skipIf(os.environ.get("CB_SKIP_DATA_TESTS"), "protected data excluded from this run")
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
        self.assertEqual(m["exposure_cut"], 50)
        self.assertEqual(m["silent_cut"], 1)
        self.assertNotIn("exposure_median", m)
        self.assertGreater(m["counts"]["occ"], 500)
        self.assertIn("Office and Administrative Support", m["families"])

    # ---- search ----
    def test_search_shape(self):
        rows = self.json("/api/occupations?q=secretar")
        self.assertTrue(rows)
        self.assertEqual(set(rows[0]), {"soc", "title", "major_group", "ma_employment", "exposure", "ma_ai_2025", "quadrant", "silent_gap"})
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
        for k in ("gap_workers", "gap_share", "gap_count", "silent_workers", "silent_share", "silent_count", "state_rate"):
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
        b = self.json("/api/board?quadrant=" + quote("Silent gap"))
        self.assertEqual(b["count"], b["summary"]["silent_count"])
        self.assertEqual(b["workers"], b["summary"]["silent_workers"])
        self.assertTrue(all(r["silent_gap"] and r["exposure"] > 50 and r["ma_ai_2025"] < 1 for r in b["rows"]))
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


BUILT = os.path.join(ROOT, "data", "careerbridge.json")


@unittest.skipIf(os.environ.get("CB_SKIP_DATA_TESTS"), "protected data excluded from this run")
@unittest.skipUnless(os.path.exists(BUILT), "careerbridge.json not built")
class BuiltDataTest(unittest.TestCase):
    """New fields for "Following software's path?" against the built data."""

    @classmethod
    def setUpClass(cls):
        cls.httpd = server.make_server(port=0, data_path=BUILT)
        cls.base = "http://127.0.0.1:%d" % cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    get, json = ServerTest.get, ServerTest.json

    def test_meta_software_curve(self):
        m = self.json("/api/meta")
        self.assertEqual([r[0] for r in m["software_genai_us"]], [2023, 2024, 2025, 2026])

    def test_detail_genai(self):
        d = self.json("/api/occupations/15-1252")
        self.assertTrue(d["genai"] and all(len(r) == 3 for r in d["genai"]))
        self.assertEqual(d["occ"]["software_path_status"], "level")

    def test_board_fields_and_sort(self):
        b = self.json("/api/board?quadrant=all&sort=years_behind_software&dir=asc")
        self.assertEqual(b["sort"], "years_behind_software")
        for r in b["rows"]:
            self.assertIn("years_behind_software", r)
            self.assertIn(r["software_path_status"], {"level", "behind", "not_started", "too_few_ads"})
        rank = {"level": 0, "behind": 1, "not_started": 2, "too_few_ads": 3}
        st = [rank[r["software_path_status"]] for r in b["rows"]]
        self.assertEqual(st, sorted(st))  # level, behind (ascending), not started, then blanks
        yb = [r["years_behind_software"] for r in b["rows"] if r["software_path_status"] == "behind"]
        self.assertEqual(yb, sorted(yb))


class SyntheticServerTest(unittest.TestCase):
    def test_search_accents(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "synthetic.json"
            path.write_text(json.dumps({"occ": [
                {"soc": "1", "title": "Résumé Writer"},
                {"soc": "2", "title": "Cafeteria Worker"},
                {"soc": "3", "title": "Café Manager"}]}))
            store = server.Store(str(path))
        for query in ("résumé writer", "resume writer", "re\u0301sume\u0301 writer"):
            self.assertEqual([o["soc"] for o in store.search(query)], ["1"])
        for query in ("café", "cafe", "cafe\u0301"):
            self.assertIn("3", [o["soc"] for o in store.search(query)])
        self.assertEqual([o["soc"] for o in store.search("writ")], ["1"])  # partial words still match while typing
        self.assertEqual(store._words("résumé café"), ["resume", "cafe"])
        self.assertIn("3", [o["soc"] for o in store.board({"q": "café"})["rows"]])

    def test_remote_host_requires_explicit_flag_before_loading_data(self):
        with patch.object(server, "Store") as store, patch.object(server, "ThreadingHTTPServer") as http:
            for host in ("0.0.0.0", "::", "192.168.1.2", "example.com", ""):
                with self.assertRaisesRegex(ValueError, "licensed file would be served with no auth"):
                    server.make_server(host=host, data_path="synthetic.json")
            store.assert_not_called()
            http.assert_not_called()
            for host in ("127.0.0.1", "127.0.0.2", "::1", "localhost"):
                server.make_server(host=host, data_path="synthetic.json")
            server.make_server(host="0.0.0.0", data_path="synthetic.json", allow_remote=True)
            http.assert_called_with(("0.0.0.0", 8000), unittest.mock.ANY)

    def test_cli_reports_remote_refusal_and_passes_override(self):
        with patch.object(sys, "argv", ["server.py", "--host", "0.0.0.0"]), \
                patch.object(sys, "stderr", new_callable=io.StringIO) as err:
            with self.assertRaises(SystemExit) as exit:
                server.main()
            self.assertEqual(exit.exception.code, 2)
            self.assertIn("--allow-remote", err.getvalue())
            self.assertIn("licensed file would be served with no auth", err.getvalue())
        with patch.object(sys, "argv", ["server.py", "--host", "0.0.0.0", "--allow-remote"]), \
                patch.object(server, "make_server") as make, patch("builtins.print"):
            server.main()
            make.assert_called_once_with(8000, "0.0.0.0", allow_remote=True)

    def test_500_hides_exception_and_logs_to_stderr(self):
        store = MagicMock()
        store.meta_payload.side_effect = RuntimeError("private file detail")
        handler = object.__new__(server.make_handler(store))
        handler.path = "/api/meta"
        handler._json = MagicMock()
        with patch.object(sys, "stderr", new_callable=io.StringIO) as err:
            handler.do_GET()
        handler._json.assert_called_once_with({"error": "server error"}, 500)
        self.assertIn("private file detail", err.getvalue())


class StaticBuildTest(unittest.TestCase):
    def test_allowlist_and_forbidden_output(self):
        # Every input and output is synthetic; never read the workspace data/ or site/.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copyfile(Path(ROOT) / "build-site.sh", root / "build-site.sh")
            for folder in ("web/js", "web/img", "web/assets", "data"):
                (root / folder).mkdir(parents=True)
            for name in ("index.html", "app.js", "styles.css", "js/app.js", "img/icon.svg", "assets/icon.svg",
                         "careerbridge.json", "ma_growth.json", "private.csv", "notes.txt"):
                (root / "web" / name).write_text("synthetic")
            for name in ("atlas.json", "titles.json"):
                (root / "data" / name).write_text("{}")
            def build():
                return subprocess.run(["sh", "build-site.sh"], cwd=root, capture_output=True, text=True)
            result = build()
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual({str(p.relative_to(root / "site")) for p in (root / "site").rglob("*") if p.is_file()},
                             {"index.html", "app.js", "styles.css", "js/app.js", "img/icon.svg", "assets/icon.svg",
                              "atlas.json", "titles.json", ".nojekyll"})
            for name in ("careerbridge.json", "ma_growth.json", "leak.csv"):
                leak = root / "web" / "assets" / name
                leak.write_text("synthetic")
                result = build()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("Build refused", result.stderr)
                leak.unlink()


class WebDiscoveryTest(unittest.TestCase):
    def test_node_suite(self):
        """unittest's default test*.py pattern otherwise misses web.test.mjs."""
        node = shutil.which("node")
        if node is None:
            self.skipTest("node not installed")
        result = subprocess.run([node, "--test", "tests/"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
