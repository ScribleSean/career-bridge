# Pipeline notes: differences from reference_prototype.json

Build: `python pipeline/build.py` (~5 s). Tests: `python -m unittest tests/test_pipeline.py -v`.

## Matches
On the 617 SOCs the two files share, exposure, ma/us AI rates, GenAI rate, confidence, MA employment, MA wage, quadrant and major group are identical. State rate 6.18 and Medical Secretaries (43-6013: exposure 64.0, MA AI 0.37%) match.

## Intentional differences
1. **659 occupations, not 617.** We keep every SOC with MA OEWS employment and a Lightcast exposure score, including combined OEWS rows reached through Lightcast `soc_5` or `ONET[:6]+"0"`. MA workers covered: 3.57M of 3.58M (the prototype covers 3.11M). The 17 SOCs left out have no Lightcast code (mostly "All Other" rows).
2. **Path similarity is z-scored per skill (CB_SIM=zscore, the default).** The prototype centers each occupation's own vector (Pearson). Every job rates reading and listening high and repairing low, so Pearson scores most pairs above 0.7. For example, Medical Secretaries scores 0.79 against Computer User Support and 0.80 against Construction Inspectors. Z-scoring matches jobs on what sets them apart. The result is fewer paths that make more sense: 495 SOCs have paths, against 598 with Pearson. To reproduce the prototype, run `CB_SIM=row python pipeline/build.py`.
3. **No null job_zone, bachelors_plus_pct or claude_share_us where O*NET or AEI has data.** The prototype leaves 79, 67 and 28 of these blank, even for codes with data (for example 15-2021 Mathematicians). Values for multi-O*NET SOCs are means across the member codes (AEI shares are sums), so `bachelors_plus_pct` differs for about 24 SOCs.
4. **At most 10 paths.** The prototype sometimes returns 11 (43-6013).
5. **State rate definition:** MA 2025 AI-skill postings divided by MA postings that have a published rate, with Unclassified included. Including THIN rows, whose rate is blank, in the denominator gives 6.17.
6. **Strengths:** the MA mean is weighted by employment across all 659 SOCs, so the diffs move by a few hundredths.
7. **Rounding:** rules compare the published values, which are rounded to 2 dp. Task pcts come straight from AEI, which rounds to 2 dp, so many show 0.0.

`meta.exposure_median` stays 55.7 as the contract requires. The MA-employment-weighted median of this build is 54.9, stored as `exposure_median_computed`.
