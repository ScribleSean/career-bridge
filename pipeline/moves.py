"""Nearby jobs from O*NET's own Related Occupations list -> pipeline/atlas_src/moves.json.

Run:  python pipeline/moves.py --onet path/to/db_31_0_text            (writes atlas_src/moves.json)
      python pipeline/moves.py --patch data/atlas.json                 (applies moves.json to a built atlas)
Get the O*NET files free from https://www.onetcenter.org/database.html (text format, CC BY 4.0).

Candidates are only the jobs O*NET itself lists as related (Primary-Short and Primary-Long tiers).
Each is scored by how alike the two jobs' skill and knowledge importance profiles are (cosine after
subtracting the all-jobs average, so skills every job needs don't count as common ground). Ties go
to higher pay, and close matches come before looser ones. Skills to build are the ones the target rates important (3+ of 5) with the biggest
gap over the current job. A target paying under 90% of the current job is not a move up and is left out.
AI use never enters the ranking. Standard library only.
"""
import argparse
import csv
import json
import math
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "pipeline" / "atlas_src"
TIERS = {"Primary-Short": 0, "Primary-Long": 1}
FILES = {"Essential Skills.txt": "Skills", "Transferable Skills.txt": "Skills", "Knowledge.txt": "Knowledge"}
MAX_MOVES = 4
MIN_PAY = 0.9
IMPORTANT = 3.0  # O*NET importance 1-5; 3 = "important"


def read_tsv(path):
    with open(path, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f, delimiter="\t")


def profiles(onet):
    """SOC -> {label: importance}, averaging detailed O*NET codes into their SOC."""
    acc = {}
    for name, kind in FILES.items():
        for r in read_tsv(onet / name):
            if r["Scale ID"] != "IM" or r["Recommend Suppress"] == "Y":
                continue
            cell = acc.setdefault(r["O*NET-SOC Code"][:7], {}).setdefault(f"{kind}: {r['Element Name']}", [])
            cell.append(float(r["Data Value"]))
    return {soc: {k: sum(v) / len(v) for k, v in els.items()} for soc, els in acc.items()}


def related(onet):
    """SOC -> {target SOC: best (tier, index)} from O*NET Related Occupations."""
    out = {}
    for r in read_tsv(onet / "Related Occupations.txt"):
        tier = TIERS.get(r["Relatedness Tier"])
        a, b = r["O*NET-SOC Code"][:7], r["Related O*NET-SOC Code"][:7]
        if tier is None or a == b:
            continue
        key = (tier, int(r["Index"]))
        cur = out.setdefault(a, {})
        cur[b] = min(cur.get(b, key), key)
    return out


def centered_cosine(a, b, mean):
    keys = [k for k in mean if k in a and k in b]
    x = [a[k] - mean[k] for k in keys]
    y = [b[k] - mean[k] for k in keys]
    nx, ny = math.sqrt(sum(v * v for v in x)), math.sqrt(sum(v * v for v in y))
    return sum(p * q for p, q in zip(x, y)) / (nx * ny) if nx and ny else 0.0


def build(onet, risk_csv=SRC / "occupation_risk.csv"):
    with open(risk_csv, newline="", encoding="utf-8") as f:
        jobs = {r["SOC_2018"]: r for r in csv.DictReader(f)}
    prof = {s: p for s, p in profiles(onet).items() if s in jobs}
    labels = sorted({k for p in prof.values() for k in p})
    mean = {k: sum(p[k] for p in prof.values() if k in p) / sum(k in p for p in prof.values()) for k in labels}
    rel = related(onet)
    pay = lambda s: float(jobs[s]["wage2025"] or 0)
    out = {}
    for soc in sorted(jobs):
        if jobs[soc]["tier"] == "Low" or soc not in prof:
            out[soc] = []  # low AI-use jobs keep "stay the course" plans with no moves
            continue
        cands = []
        for t, (tier, _) in rel.get(soc, {}).items():
            if t not in prof or (pay(soc) and pay(t) < MIN_PAY * pay(soc)):
                continue
            sim = centered_cosine(prof[soc], prof[t], mean)
            if sim <= 0:
                continue
            gaps = sorted(((prof[t][k] - prof[soc].get(k, 0), k) for k in prof[t] if prof[t][k] >= IMPORTANT), key=lambda g: (-g[0], g[1]))
            cands.append({"soc": t, "similarity": round(sim, 2), "looser_match": tier > 0 or sim < 0.5,
                          "skills_to_build": [k for d, k in gaps[:3] if d > 0]})
        cands.sort(key=lambda m: (m["looser_match"], -m["similarity"], -pay(m["soc"]), m["soc"]))
        out[soc] = cands[:MAX_MOVES]
    return out


LOOSE = ("A nearby job that shares many of the same skills is {t} ({p}), but it is a loose match. "
         "Treat it as a starting point for research, and talk to people in that role.")
CLOSE = "Decide whether to move toward {t} ({p}). Talk to people in that role first."
NO_MOVE = "Make working with AI part of how you do this job, so you are the person who directs it."
MOVE_LINE = re.compile(r"^(Decide whether to move toward |A nearby job that shares)")


def apply(atlas, moves):
    """Swap each plan's moves for the O*NET ones and keep the timeline's move sentences in step."""
    by = {o["soc"]: o for o in atlas["occ"]}
    for soc, plan in atlas["plans"].items():
        mv = [m for m in moves.get(soc, []) if m["soc"] in by]
        plan["moves"] = [{"soc": m["soc"], "sim": m["similarity"], "loose": m["looser_match"], "skills": m["skills_to_build"]} for m in mv]
        # The page hides targets with no Massachusetts count (its default view), so the plan names the first shown one.
        top = next((m for m in plan["moves"] if by[m["soc"]].get("ma_jobs") is not None), plan["moves"][0] if plan["moves"] else None)
        # Only plans whose 12-month step is about moving get move sentences; others keep their own advice.
        if not any(s["when"] == "Within 12 months" and MOVE_LINE.match(s["text"]) for s in plan["timeline"]):
            continue
        for step in plan["timeline"]:
            if step["when"] == "Next 90 days":
                text = re.sub(r" Start building [^.]*\.$", "", step["text"])
                if top and top["skills"]:
                    text += " Start building " + top["skills"][0].split(": ", 1)[1].lower() + "."
                step["text"] = text
            elif step["when"] == "Within 12 months" and MOVE_LINE.match(step["text"]):
                if top:
                    t = by[top["soc"]]
                    step["text"] = (LOOSE if top["loose"] else CLOSE).format(t=t["title"], p="typically needs " + (t.get("prep") or "some training"))
                else:
                    step["text"] = NO_MOVE
    return atlas


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--onet", type=Path, help="unzipped O*NET text database folder")
    ap.add_argument("--patch", type=Path, help="built atlas.json to update in place from moves.json")
    a = ap.parse_args()
    if a.onet:
        moves = build(a.onet)
        (SRC / "moves.json").write_text(json.dumps(moves, separators=(",", ":"), sort_keys=True))
        print(f"moves.json: {sum(map(bool, moves.values()))} of {len(moves)} jobs have nearby jobs")
    if a.patch:
        atlas = apply(json.loads(a.patch.read_text()), json.loads((SRC / "moves.json").read_text()))
        a.patch.write_text(json.dumps(atlas, separators=(",", ":")))
        print(f"patched {a.patch}")
    if not (a.onet or a.patch):
        ap.error("give --onet, --patch or both")


if __name__ == "__main__":
    main()
