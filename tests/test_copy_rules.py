"""Wording rules for everything the app shows (web/).

Each rule pairs a pattern with the fix. To check another tree, such as an old
commit unpacked with `git archive`: python tests/test_copy_rules.py <root>
"""
import os
import re
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (pattern, fix). Matched per line of web/*.html and web/**/*.js.
BANNED = [
    (re.compile(r"\bat[- ]risk\b|\bautomatable\b", re.I),
     "Exposure is overlap, not job loss: say 'AI overlap' (Lightcast) or 'AI use (Anthropic Economic Index)'."),
    (re.compile(r"worried about AI|\bcuts? jobs\b|\breplaced by AI\b", re.I),
     "No threat or job-loss framing: say what the number is ('AI what-if', 'means fewer jobs'), not what to fear."),
    (re.compile(r"\bClaude[- ](use|usage|exposure|score)\b", re.I),
     "Name the metric 'AI use (Anthropic Economic Index)'; Claude is where the data comes from, not the metric's name."),
]

# A sentence that names one of these next to a relationship word implies a tie that doesn't exist,
# unless the same sentence negates it or marks it as a proposal.
ORGS = re.compile(r"MassHire|Lightcast|Commonwealth", re.I)
TIE = re.compile(r"verif|partner|endors|certif|approv|official", re.I)
HEDGE = re.compile(r"\bnot\b|n’t|n't|\bcould\b|\bwould\b|Proposed", re.I)
TIE_FIX = ("Never imply a MassHire, Lightcast or state relationship: say 'career center' for a role, "
           "or mark the idea 'Proposed' / use 'could'.")


def copy_files(root):
    web = os.path.join(root, "web")
    for d, _, files in os.walk(web):
        for f in sorted(files):
            if f.endswith((".js", ".html")):
                yield os.path.join(d, f)


def scan(root):
    """Returns 'path:line: text -> fix' for every rule broken under root/web."""
    out = []
    for path in copy_files(root):
        rel = os.path.relpath(path, root)
        with open(path, encoding="utf-8") as fh:
            for i, line in enumerate(fh, 1):
                for pat, fix in BANNED:
                    m = pat.search(line)
                    if m:
                        out.append(f"{rel}:{i}: '{m.group(0)}' -> {fix}")
                for sentence in re.split(r"(?<=[.!?])\s|['\"`]\s*,\s*['\"`]", line):
                    org, tie = ORGS.search(sentence), TIE.search(sentence)
                    if org and tie and not HEDGE.search(sentence):
                        out.append(f"{rel}:{i}: '{org.group(0)}' with '{tie.group(0)}' -> {TIE_FIX}")
    return out


class CopyRulesTest(unittest.TestCase):
    def test_web_copy_follows_wording_rules(self):
        problems = scan(ROOT)
        self.assertEqual(problems, [], "\n" + "\n".join(problems))


if __name__ == "__main__":
    if len(sys.argv) > 1:
        found = scan(sys.argv[1])
        print("\n".join(found) or "ok")
        sys.exit(1 if found else 0)
    unittest.main()
