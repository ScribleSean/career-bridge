#!/bin/sh
# Build the static site (open data + sample skill signals) into site/. Host site/ anywhere, e.g. GitHub Pages.
# Needs data/atlas.json and data/titles.json (python pipeline/atlas.py). Licensed Lightcast data is never copied.
cd "$(dirname "$0")" || exit 1
[ -f data/atlas.json ] && [ -f data/titles.json ] || { echo "Run python pipeline/atlas.py first."; exit 1; }
rm -rf site && cp -R web site && cp data/atlas.json data/titles.json site/ && touch site/.nojekyll
echo "Built site/ ($(du -sh site | cut -f1)). Try it: python3 -m http.server 8090 --directory site"
