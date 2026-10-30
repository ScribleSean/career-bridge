"""This repo is public: no agent files, internal notes or private references in tracked files.

To check an old commit: python tests/test_public_repo.py <sha>
"""
import hashlib
import os
import re
import shutil
import subprocess
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

AGENT_FILE = re.compile(r"(^|/)(CLAUDE\.md|AGENTS\.md|NOTES\.md|HANDOFF[^/]*|[^/]*\.local\.md)$|(^|/)\.(claude|codex)/")
AGENT_FIX = "agent rules and working notes stay local: git rm --cached it and keep it in .gitignore."

PRIVATE = re.compile(r"\bteammate|/Users/|queue row", re.I)
# SHA-256 of each lowercased private name (a person, a school, a local folder, internal tools).
# Hashes keep the names themselves out of this public file.
PRIVATE_NAMES = {
    "6e5c996a7cd138a63e96b4b4768104bb54fe9b0110a3efb2584b848063b859d6",
    "2d1d92b1f4cc7fd3ef215da88c2826ab3ec2ced95b388b395b658c41b349c90e",
    "fddaaf1379302f10cf2da6dce67db87ce48ca4186926ee735a66c7263129a316",
    "67c6921739229bf4410ca72c769284ce1e15309f06a000e445536adb9906a4f7",
    "6cb784e0f985cba22d0642283892ad0f90dcd48385524de0dec0f51624456a43",
    "ed789ba8898bf08533d57d5938436d45c256e5990e7e619e0b0295cbf62f8ea9",
}
PRIVATE_FIX = ("public text names no people or internal process: credit 'contributors', "
               "describe private sources neutrally ('a separate analysis step').")

SKIP = {".gitignore", "tests/test_public_repo.py"}  # they list the patterns on purpose


def sha256(word):
    return hashlib.sha256(word.encode()).hexdigest()


def private_names(line, hashes=PRIVATE_NAMES):
    """Every word, and every hyphenated run of up to three words ("a-b-c" gives
    a, b, c, a-b, b-c, a-b-c), whose hash is in hashes."""
    hits = []
    for run in re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)*", line.lower()):
        parts = run.split("-")
        for start in range(len(parts)):
            for end in range(start + 1, min(len(parts), start + 3) + 1):
                word = "-".join(parts[start:end])
                if sha256(word) in hashes:
                    hits.append(word)
    return hits


def git(*args):
    return subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True, check=True).stdout


def scan(rev=None):
    """Returns 'path[:line]: problem -> fix' for tracked files at rev (default: the working tree)."""
    paths = (git("ls-tree", "-r", "--name-only", rev) if rev else git("ls-files")).splitlines()
    out = []
    for p in paths:
        if AGENT_FILE.search(p):
            out.append(f"{p}: tracked agent file -> {AGENT_FIX}")
            continue
        if p in SKIP or p.startswith("docs/img/"):
            continue
        try:
            if rev:
                text = git("show", f"{rev}:{p}")
            else:
                with open(os.path.join(ROOT, p), encoding="utf-8") as fh:
                    text = fh.read()
        except (UnicodeDecodeError, FileNotFoundError):
            continue
        for i, line in enumerate(text.splitlines(), 1):
            m = PRIVATE.search(line)
            hits = ([m.group(0)] if m else []) + private_names(line)
            if hits:
                out.append(f"{p}:{i}: '{hits[0]}' -> {PRIVATE_FIX}")
    return out


@unittest.skipUnless(shutil.which("git") and os.path.exists(os.path.join(ROOT, ".git")), "not a git checkout")
class PublicRepoTest(unittest.TestCase):
    def test_private_name_check_catches_a_planted_name(self):
        planted = f"leak-{os.getpid()}"
        hashes = {sha256(planted)}
        self.assertEqual(private_names(f"See ~/notes/{planted.upper()}/plan.md.", hashes), [planted])
        self.assertEqual(private_names("See the notes for the plan.", hashes), [])
        for h in PRIVATE_NAMES:
            self.assertRegex(h, r"^[0-9a-f]{64}$")

    def test_tracked_files_are_public_safe(self):
        problems = scan()
        self.assertEqual(problems, [], "\n" + "\n".join(problems))


if __name__ == "__main__":
    if len(sys.argv) > 1:
        found = scan(sys.argv[1])
        print("\n".join(found) or "ok")
        sys.exit(1 if found else 0)
    unittest.main()
