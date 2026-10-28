#!/bin/sh
# Build the static site (open data + sample skill signals) into site/. Host site/ anywhere, e.g. GitHub Pages.
# Needs data/atlas.json and data/titles.json (python pipeline/atlas.py). Licensed Lightcast data is never copied.
set -eu
cd "$(dirname "$0")" || exit 1
[ -f data/atlas.json ] && [ -f data/titles.json ] || { echo "Run python pipeline/atlas.py first."; exit 1; }
rm -rf site
mkdir site
cp web/index.html web/app.js web/styles.css site/
for folder in js img asset assets; do
    [ ! -d "web/$folder" ] || cp -R "web/$folder" site/
done
cp data/atlas.json data/titles.json site/
if [ -n "$(find site \( -iname careerbridge.json -o -iname ma_growth.json -o -iname '*.csv' \) -print)" ]; then
    echo "Build refused: site/ contains licensed JSON or CSV files." >&2
    exit 1
fi
touch site/.nojekyll
echo "Built site/ ($(du -sh site | cut -f1)). Try it: python3 -m http.server 8090 --directory site"
