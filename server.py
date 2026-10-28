#!/usr/bin/env python3
"""Career Bridge server: serves web/ and a small JSON API over careerbridge.json.

Python 3.9 standard library only. Usage: python server.py [--port 8000]
Data file: env CB_DATA, else data/careerbridge.json, else data/reference_prototype.json.
"""
import argparse
import ipaddress
import json
import mimetypes
import os
import re
import sys
import traceback
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "web")

GAP = "High exposure, low adoption"
HIHI = "High exposure, high adoption"
LOHI = "Lower exposure, high adoption"
LOLO = "Lower exposure, low adoption"
THIN = "Too few MA job ads to measure"
QUADRANTS = [GAP, HIHI, LOHI, LOLO, THIN]
SILENT = "Silent gap"  # board filter: subset of GAP where under 1% of MA ads ask for AI

DEFAULT_META = {
    "state_rate_2025": 6.18,
    "exposure_cut": 50.0,   # Lightcast AI_EXPOSURE_BAND: Medium-high starts at 50
    "silent_cut": 1.0,
    "exposure_min": 31.5,
    "exposure_max": 82.8,
    "sources": [
        "Data Source: Lightcast, 2026 (AI Exposure and Adoption by Occupation, 2023-Sep 2026)",
        "BLS OEWS May 2025",
        "O*NET 31.0",
        "Anthropic Economic Index, June 2026 release",
    ],
}

# Whole-word aliases expanded before matching titles.
ALIASES = {
    "rn": "registered nurses",
    "admin": "administrative",
    "cna": "nursing assistants",
    "cs": "customer service",
    "hr": "human resources",
    "it": "computer",
    "dev": "developers",
    "devs": "developers",
    "teacher": "teachers",
    "nurse": "nurses",
    "rep": "representatives",
    "reps": "representatives",
}

DATA_FILES = {"/atlas.json", "/titles.json", "/careerbridge.json"}
SOC_RE = re.compile(r"^\d{2}-\d{4}$")
BOARD_SORT_KEYS = {"title", "ma_employment", "exposure", "ma_ai_2025", "us_ai_2025",
                   "ma_median_wage", "bachelors_plus_pct", "major_group", "claude_share_us",
                   "years_behind_software"}
SUMMARY_FIELDS = ("soc", "title", "major_group", "ma_employment", "exposure", "ma_ai_2025", "quadrant", "silent_gap")
BOARD_FIELDS = SUMMARY_FIELDS + ("us_ai_2025", "ma_median_wage", "bachelors_plus_pct", "ma_confidence",
                                   "years_behind_software", "software_path_status")


def resolve_data_path():
    env = os.environ.get("CB_DATA")
    if env:
        return env, False
    main = os.path.join(HERE, "data", "careerbridge.json")
    if os.path.exists(main):
        return main, False
    return os.path.join(HERE, "data", "reference_prototype.json"), True


def fold(text):
    return "".join(c for c in unicodedata.normalize("NFD", text or "")
                   if not unicodedata.category(c).startswith("M")).lower()


class Store:
    """Loads the data once and keeps indexes for search and board queries."""

    def __init__(self, path, using_reference=False):
        self.lite = not os.path.exists(path)  # no Lightcast file: serve the open-data app only
        d = {}
        if not self.lite:
            with open(path, encoding="utf-8") as f:
                d = json.load(f)
        self.path = path
        self.using_reference = using_reference
        self.occ = d.get("occ", [])
        self.by_soc = {o["soc"]: o for o in self.occ}
        self.trend = d.get("trend", {})
        self.genai = d.get("genai", {})
        self.growth = d.get("growth", {})
        self.tasks = d.get("tasks", {})
        self.skills = d.get("skills", {})
        self.strengths = d.get("strengths", {})
        self.paths = d.get("paths", {})
        meta = dict(DEFAULT_META)
        meta.update(d.get("meta") or {})
        for o in self.occ:  # older data files lack the field: derive it with the contract rule
            if "silent_gap" not in o:
                o["silent_gap"] = bool(o.get("ma_confidence") != "THIN" and o.get("ma_ai_2025") is not None
                                       and (o.get("exposure") or 0) > meta["exposure_cut"]
                                       and o["ma_ai_2025"] < meta["silent_cut"])
        exps = [o["exposure"] for o in self.occ if o.get("exposure") is not None]
        if "exposure_min" not in (d.get("meta") or {}) and exps:
            meta["exposure_min"] = min(DEFAULT_META["exposure_min"], min(exps))
        if "exposure_max" not in (d.get("meta") or {}) and exps:
            meta["exposure_max"] = max(DEFAULT_META["exposure_max"], max(exps))
        self.meta = meta
        self.families = sorted({o.get("major_group") or "" for o in self.occ} - {""})
        # Search index: largest jobs first.
        self.ranked = sorted(self.occ, key=lambda o: -(o.get("ma_employment") or 0))
        self.lower_titles = {o["soc"]: fold(o.get("title")) for o in self.occ}
        self.summary = self._board_summary()

    def _board_summary(self):
        total = sum(o.get("ma_employment") or 0 for o in self.occ)
        gap = [o for o in self.occ if o.get("quadrant") == GAP]
        w = sum(o.get("ma_employment") or 0 for o in gap)
        silent = [o for o in self.occ if o.get("silent_gap")]
        sw = sum(o.get("ma_employment") or 0 for o in silent)
        return {
            "gap_workers": w,
            "gap_share": round(100.0 * w / total, 1) if total else 0.0,
            "gap_count": len(gap),
            "silent_workers": sw,
            "silent_share": round(100.0 * sw / total, 1) if total else 0.0,
            "silent_count": len(silent),
            "state_rate": self.meta["state_rate_2025"],
            "total_workers": total,
            "total_count": len(self.occ),
        }

    @staticmethod
    def summarize(o, fields=SUMMARY_FIELDS):
        return {k: o.get(k) for k in fields}

    def _words(self, text):
        words = []
        for w in fold(text).split():
            w = re.sub(r"[^\w*-]", "", w, flags=re.ASCII)
            if not w:
                continue
            words.extend(x[:-1] if len(x) > 3 and x.endswith("s") else x
                         for x in ALIASES.get(w, w).split())
        return words

    @staticmethod
    def _match(title, words):
        for w in words:
            if w in title:
                continue
            # Light plural/singular tolerance ("nurse" -> "nurses", "clerks" -> "clerk").
            if len(w) > 4 and w[:-1] in title:
                continue
            return False
        return True

    def search(self, q, limit=10):
        q = (q or "").strip()
        if not q:
            return [self.summarize(o) for o in self.ranked[:limit]]
        if SOC_RE.match(q) and q in self.by_soc:
            return [self.summarize(self.by_soc[q])]
        words = self._words(q)
        if not words:
            return []
        scored = []
        for i, o in enumerate(self.ranked):
            title = self.lower_titles[o["soc"]]
            if not self._match(title, words):
                continue
            # Rank: words found before any "except ..." clause and at the start of a word
            # rank higher; ties keep MA employment order.
            head = title.split(" except ")[0]
            score = 0
            for w in words:
                stem = w[:-1] if len(w) > 4 and w not in title else w
                if stem in head:
                    score += 2
                if re.search(r"\b" + re.escape(stem), head):
                    score += 1
            scored.append((-score, i, o))
        scored.sort(key=lambda t: (t[0], t[1]))
        return [self.summarize(o) for _, _, o in scored[:limit]]

    def detail(self, soc):
        o = self.by_soc.get(soc)
        if not o:
            return None
        paths = []
        for p in self.paths.get(soc, []) or []:
            try:
                target, sim, wage_diff, bridge = p[0], p[1], p[2], p[3]
            except (IndexError, TypeError):
                continue
            t = self.by_soc.get(target)
            if not t:
                continue
            paths.append({
                "soc": target, "similarity": sim, "wage_diff": wage_diff,
                "bridge_skills": [s.strip() for s in (bridge or "").split(",") if s.strip()],
                "target": self.summarize(t, BOARD_FIELDS + ("job_zone",)),
            })
        paths.sort(key=lambda p: -(p["similarity"] or 0))
        return {
            "occ": o,
            "trend": self.trend.get(soc, []),
            "genai": self.genai.get(soc, []),
            "growth": self.growth.get(soc, []),
            "tasks": self.tasks.get(soc, []),
            "skills": self.skills.get(soc, []),
            "strengths": self.strengths.get(soc, []),
            "paths": paths,
        }

    def board(self, params):
        quadrant = params.get("quadrant", "")
        family = params.get("family", "")
        words = self._words(params.get("q", ""))
        sort = params.get("sort", "ma_employment")
        if sort not in BOARD_SORT_KEYS:
            sort = "ma_employment"
        direction = params.get("dir", "")
        if direction not in ("asc", "desc"):
            direction = "asc" if sort in ("title", "major_group") else "desc"
        rows = []
        for o in self.occ:
            if quadrant == SILENT:
                if not o.get("silent_gap"):
                    continue
            elif quadrant and quadrant not in ("all", "All jobs") and o.get("quadrant") != quadrant:
                continue
            if family and o.get("major_group") != family:
                continue
            title = self.lower_titles[o["soc"]]
            if words and not self._match(title, words):
                continue
            rows.append(o)

        def val(o):
            # "Not started" sorts as furthest behind software; "too few ads" stays blank (last).
            if sort == "years_behind_software" and o.get("software_path_status") == "not_started":
                return 99.0
            return o.get(sort)

        def key(o):
            v = val(o)
            return (str(v).lower() if isinstance(v, str) else v)

        present = [o for o in rows if val(o) is not None]
        missing = [o for o in rows if val(o) is None]
        present.sort(key=key, reverse=(direction == "desc"))
        rows = present + missing  # nulls always last
        return {
            "rows": [self.summarize(o, BOARD_FIELDS) for o in rows],
            "count": len(rows),
            "workers": sum(o.get("ma_employment") or 0 for o in rows),
            "sort": sort, "dir": direction,
            "summary": self.summary,
            "quadrants": QUADRANTS,
            "families": self.families,
        }

    def meta_payload(self):
        m = dict(self.meta)
        m["counts"] = {k: len(getattr(self, k)) for k in ("occ", "trend", "genai", "tasks", "skills", "strengths", "paths")}
        m["quadrant_counts"] = {q: sum(1 for o in self.occ if o.get("quadrant") == q) for q in QUADRANTS}
        m["families"] = self.families
        m["aliases"] = ALIASES
        m["using_reference"] = self.using_reference
        m["lite"] = self.lite
        m["data_file"] = os.path.basename(self.path)
        if self.using_reference:
            m["warning"] = ("Showing the teammate's reference prototype data. "
                            "Run pipeline/build.py to build data/careerbridge.json.")
        return m


def make_handler(store):
    class Handler(BaseHTTPRequestHandler):
        server_version = "CareerBridge/1.0"

        def log_message(self, fmt, *args):
            if os.environ.get("CB_QUIET"):
                return
            sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

        def _send(self, code, body, ctype, extra=None):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def _json(self, obj, code=200):
            body = json.dumps(obj, separators=(",", ":")).encode("utf-8")
            self._send(code, body, "application/json; charset=utf-8", {"Cache-Control": "no-store"})

        def do_HEAD(self):
            self.do_GET()

        def do_GET(self):
            try:
                url = urlparse(self.path)
                path = unquote(url.path)
                params = {k: v[-1] for k, v in parse_qs(url.query).items()}
                if path.startswith("/api/"):
                    return self._api(path, params)
                return self._static(path)
            except Exception:  # never take the server down on one bad request
                traceback.print_exc(file=sys.stderr)
                try:
                    self._json({"error": "server error"}, 500)
                except Exception:
                    pass

        def _api(self, path, params):
            path = path.rstrip("/")
            if path == "/api/meta":
                return self._json(store.meta_payload())
            if path == "/api/occupations":
                try:
                    limit = max(1, min(50, int(params.get("limit", 10))))
                except ValueError:
                    limit = 10
                return self._json(store.search(params.get("q", ""), limit))
            if path.startswith("/api/occupations/"):
                soc = path[len("/api/occupations/"):]
                d = store.detail(soc)
                if d is None:
                    return self._json({"error": "unknown occupation", "soc": soc}, 404)
                return self._json(d)
            if path == "/api/board":
                return self._json(store.board(params))
            return self._json({"error": "not found", "path": path}, 404)

        def _static(self, path):
            if path in ("", "/"):
                path = "/index.html"
            # The page reads these JSON files directly; they live in data/ (gitignored), not web/.
            if path == "/careerbridge.json":
                full = os.path.realpath(store.path)
                ok = os.path.isfile(full)
            else:
                base = os.path.realpath(os.path.join(HERE, "data") if path in DATA_FILES else WEB)
                full = os.path.realpath(os.path.join(base, path.lstrip("/")))
                ok = full.startswith(base + os.sep) and os.path.isfile(full)
            if not ok:
                return self._send(404, b"Not found", "text/plain; charset=utf-8")
            ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype in ("application/javascript",):
                ctype += "; charset=utf-8"
            if full.endswith(".js"):
                ctype = "text/javascript; charset=utf-8"
            with open(full, "rb") as f:
                body = f.read()
            self._send(200, body, ctype, {"Cache-Control": "no-cache"})

    return Handler


def make_server(port=8000, host="127.0.0.1", data_path=None, allow_remote=False):
    try:
        loopback = ipaddress.ip_address(host).is_loopback
    except ValueError:
        loopback = host.lower() == "localhost"
    if not loopback and not allow_remote:
        raise ValueError("Non-loopback host refused: the licensed file would be served with no auth. "
                         "Pass --allow-remote to allow remote access.")
    if data_path:
        store = Store(data_path, using_reference=os.path.basename(data_path) == "reference_prototype.json")
    else:
        p, ref = resolve_data_path()
        store = Store(p, ref)
    httpd = ThreadingHTTPServer((host, port), make_handler(store))
    httpd.daemon_threads = True
    httpd.store = store
    return httpd


def main():
    ap = argparse.ArgumentParser(description="Career Bridge server")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--allow-remote", action="store_true")
    args = ap.parse_args()
    try:
        httpd = make_server(args.port, args.host, allow_remote=args.allow_remote)
    except ValueError as e:
        ap.error(str(e))
    s = httpd.store
    print("Career Bridge: %d occupations from %s" % (len(s.occ), s.path))
    if s.lite:
        print("Lite mode: no Lightcast file at %s. Serving the open-data app (data/atlas.json)." % s.path)
    elif s.using_reference:
        print("WARNING: using reference_prototype.json (run pipeline/build.py for real data)")
    print("Open http://localhost:%d" % args.port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
