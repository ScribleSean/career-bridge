"""Massachusetts job growth by occupation, May 2019 -> May 2025 (BLS OEWS state files).

Reads data/oews_history/state_<year>.xlsx (BLS OEWS "state" workbooks; gitignored) with the
standard library only, keeps Massachusetts detailed occupations, and writes data/ma_growth.json:

  {"meta": {"first_year", "last_year", "all_jobs": [[year, employment], ...], "all_growth_pct"},
   "occ":  {soc: {"emp": [[year, employment], ...], "growth_pct": float|null,
                  "vs_all_pts": float|null, "status": "faster"|"slower"|"similar"|"too_little_data"}}}

Growth compares each job's change with all MA jobs over the same years. Status is "similar"
within 5 points of the all-jobs change. This is past change, not a forecast. OEWS counts jobs
(not people) and excludes the self-employed; a few SOC codes changed between 2019 and 2021.
Run: python pipeline/growth.py   (folder override: env OEWS_HISTORY)
"""
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SRC = Path(os.environ.get("OEWS_HISTORY", ROOT / "data" / "oews_history"))
OUT = ROOT / "data" / "ma_growth.json"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
SIMILAR_PTS = 5.0
EMPLOYMENT_NOT_AVAILABLE = "**"
SOC_2018_FULLY_ADOPTED = 2021


def _col_index(ref):
    letters = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_rows(path):
    """Yield rows (lists of strings) from the first sheet of an .xlsx file."""
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            for _, el in ET.iterparse(z.open("xl/sharedStrings.xml")):
                if el.tag == NS + "si":
                    shared.append("".join(t.text or "" for t in el.iter(NS + "t")))
                    el.clear()
        with z.open("xl/worksheets/sheet1.xml") as f:
            for _, el in ET.iterparse(f):
                if el.tag != NS + "row":
                    continue
                row = {}
                for c in el.iter(NS + "c"):
                    v = c.find(NS + "v")
                    if v is None:
                        isv = c.find(NS + "is")
                        val = "".join(t.text or "" for t in isv.iter(NS + "t")) if isv is not None else ""
                    else:
                        val = shared[int(v.text)] if c.get("t") == "s" else (v.text or "")
                    row[_col_index(c.get("r"))] = val
                el.clear()
                if row:
                    yield [row.get(i, "") for i in range(max(row) + 1)]


def to_num(s):
    s = str(s).strip()
    return None if s == EMPLOYMENT_NOT_AVAILABLE else float(s.replace(",", ""))


def ma_rows(path):
    """{soc: employment} for MA detailed occupations, plus the all-occupations total."""
    rows = read_rows(path)
    header = [h.strip().lower() for h in next(rows)]
    col = {name: i for i, name in enumerate(header)}
    area = col.get("area_title", col.get("st"))
    occ = col.get("occ_code")
    grp = col.get("o_group", col.get("occ_group"))
    emp = col.get("tot_emp")
    out, total = {}, None
    for r in rows:
        if len(r) <= max(area, occ, emp):
            continue
        if r[area].strip() not in ("Massachusetts", "MA"):
            continue
        code = r[occ].strip()
        e = to_num(r[emp])
        if code == "00-0000":
            total = e
        elif grp is not None and r[grp].strip().lower() == "detailed" and e is not None:
            out[code] = e
    return out, total


def build():
    files = sorted(SRC.glob("state_*.xlsx"))
    if not files:
        sys.exit(f"no OEWS history files in {SRC} (expected state_<year>.xlsx)")
    years, all_jobs = {}, []
    for f in files:
        y = int(re.search(r"(\d{4})", f.stem).group(1))
        occ, total = ma_rows(f)
        years[y] = occ
        all_jobs.append([y, total])
        print(f"  {y}: {len(occ)} MA occupations, total {total:,.0f}" if total else f"  {y}: {len(occ)} occupations")
    first, last = min(years), max(years)
    tot = dict(all_jobs)
    all_growth = 100 * (tot[last] / tot[first] - 1) if tot.get(first) and tot.get(last) else None

    res = {}
    for soc in sorted(set().union(*years.values())):
        series = [[y, years[y][soc]] for y in sorted(years) if soc in years[y]]
        start = next(((y, e) for y, e in series if y <= max(first, SOC_2018_FULLY_ADOPTED)), None)
        end = next(((y, e) for y, e in series if y == last), None)
        growth = vs = None
        status = "too_little_data"
        if start and end and start[1] > 0 and tot.get(start[0]):
            growth = 100 * (end[1] / start[1] - 1)
            base = 100 * (tot[last] / tot[start[0]] - 1)
            vs = growth - base
            status = "similar" if abs(vs) <= SIMILAR_PTS else ("faster" if vs > 0 else "slower")
        res[soc] = {"emp": series, "growth_pct": None if growth is None else round(growth, 1),
                    "since": start[0] if start else None,
                    "vs_all_pts": None if vs is None else round(vs, 1), "status": status}

    out = {"meta": {"first_year": first, "last_year": last, "all_jobs": all_jobs,
                    "all_growth_pct": None if all_growth is None else round(all_growth, 1),
                    "similar_band_pts": SIMILAR_PTS,
                    "source": "BLS OEWS state files, May of each year"},
           "occ": res}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    counts = {}
    for v in res.values():
        counts[v["status"]] = counts.get(v["status"], 0) + 1
    print(f"wrote {OUT}: {len(res)} occupations; all MA jobs {first}->{last}: {out['meta']['all_growth_pct']}%; {counts}")
    return out


if __name__ == "__main__":
    build()
