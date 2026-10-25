<p align="center"><img src="docs/img/hero.svg" alt="Career Bridge: workers and employers answer a short survey, answers become totals only, and results compare what workers do with AI with what employers say is becoming more important" width="100%"></p>

<h1 align="center">Career Bridge</h1>

<p align="center"><b>How are people in Massachusetts' silent-gap jobs actually using AI?</b><br>
A short, repeatable survey for workers and employers, published only as totals.<br>
<a href="https://scriblesean.github.io/career-bridge/"><b>Try the live demo →</b></a></p>

<p align="center">🥉 <b>3rd place, Human Edge Studio by SG+I</b> · WPI · October 24, 2026 · team The Communicators</p>

---

## What we found

About **526,000 Massachusetts workers** are in jobs where AI overlaps with much of the work, yet under 1% of job ads for those jobs mention AI skills. (Jobs above 50 on the Lightcast AI Exposure Index with under 1% of 2025 Massachusetts job ads asking for any AI skill; workers from BLS OEWS May 2025.)

Ads show what employers ask for. They don't show what people in those jobs actually do with AI. It could be that the jobs don't need AI skills, or that people already use AI and nobody is asking. Asking people tells the difference.

## The survey

<img src="docs/img/tour-survey.png" alt="A worker picks their job, marks which activities they do and where AI helps, and submits; their answers are counted in the totals" width="100%">

- **Five minutes for workers:** which work activities they do in a typical week, and whether AI helps with each, plus the AI tools they use, whether they were trained, and what would help.
- **Three minutes for employers:** what the role needs, what is becoming more important, whether job ads mention AI, and whether they train people on AI.
- **Built on O\*NET:** the activities are the ones O\*NET lists for each job, so answers line up with federal data and Lightcast skills. Three AI activities O\*NET doesn't track yet are added: using AI assistants, checking AI output, and automating routine tasks.
- **Starting with three silent-gap jobs:** administrative assistants, customer service representatives and retail salespeople.

## The results

<img src="docs/img/tour-results.png" alt="Sample results: share of workers using AI, employer training, job ads mentioning AI, and where workers and employers differ" width="100%">

Totals by job and region only, with no names or company names. Any group with fewer than 10 responses is hidden. The page shows where workers and employers differ: for example, which AI activities employers say are becoming more important but few workers do yet. That is exactly who could use AI training, such as the state's free courses.

## For career counselors

<img src="docs/img/tour-job.png" alt="A job page: pay, growth, training, how much AI is used on the work, and jobs with similar skills" width="100%">

Look up any job for pay, growth, training, how much AI is already used on the work (Anthropic Economic Index), what to do more of, and jobs with similar skills with the skills to build. Every number names its source: BLS OEWS, O\*NET 31.0 and the Anthropic Economic Index.

## Proposed pilot

One region with its MassHire workforce board, three jobs, one quarter: about 100 worker and 25 employer responses per job, collected through channels people already use. The result is a short report the board can use to target AI training, and a question set it can repeat every year.

## Status

A working prototype. **All survey results in it are sample data**, made up to show how the totals would read; what you answer stays in your browser. Career Bridge is an independent student project and is not affiliated with MassHire, Lightcast or the Commonwealth of Massachusetts.

<sub>Run it locally: `./build-site.sh`, then `python3 -m http.server 8090 --directory site`. The README clips are recorded from the real app with `node docs/media/record.mjs` (headless Chrome, no dependencies).</sub>
