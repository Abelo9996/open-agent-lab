# open agent lab

[![ci](https://github.com/Abelo9996/open-agent-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/Abelo9996/open-agent-lab/actions/workflows/ci.yml) [![pages](https://github.com/Abelo9996/open-agent-lab/actions/workflows/pages.yml/badge.svg)](https://github.com/Abelo9996/open-agent-lab/actions/workflows/pages.yml)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/results-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/results-light.png">
  <img alt="The open agent lab results page, showing the pilot result set for Claude Code and Codex CLI (10 tasks x 3 runs) and its setup table" src="docs/results-light.png">
</picture>

An independent, reproducible evaluation lab for coding agents (Claude Code, Codex CLI,
OpenCode, DeepSeek Harness and others). It reruns the same coding tasks many times per
agent, model and CLI version, and publishes pass rates with confidence intervals,
consistency across reruns, and cost and token spread.

Site: https://abelo9996.github.io/open-agent-lab/

This repository holds both the site and its data. Every number on the site comes from a
JSON file under [`data/`](data/).

## What is here

| Path | What it is |
|---|---|
| `data/results/<YYYY-MM-DD>-<label>.json` | One result set each: a rerun-bench JSON report, optionally with a `lab` block of metadata. |
| `data/regressions.json` | Reviewed regression reports, shown on the regression watch page. |
| `data/launches.json` | Launch-day log: model launches and the result sets published for them. |
| `data/agents.json` | Display names and links for agent ids used in result files. |
| `data/tasks.json` | The task suite (ids, titles, tags, timeouts), copied from rerun-bench. |
| `scripts/build.mjs` | Builds `_site/` from `data/`. No dependencies. |
| `scripts/validate.mjs` | Validates every data file. CI runs it on every pull request. |
| `src/` | Stylesheet, the page script (tooltips, theme, copy buttons, demo playback, chart entrance), the favicon, the tool demo recordings and still frames, and the social preview image, copied to `_site/assets/`. |
| `scripts/social.mjs` | Renders `src/social-preview.png` (and `docs/social-preview.png`) from the latest result set with headless Chrome. |

## The tools behind it

- [rerun-bench](https://github.com/Abelo9996/rerun-bench): runs the same tasks N times per
  agent and reports pass rate with a Wilson interval, pass^k, flip rate, and cost and token
  spread. It produces every result set here. Metric definitions:
  [docs/METRICS.md](https://github.com/Abelo9996/rerun-bench/blob/main/docs/METRICS.md).
- [nerf-watch](https://github.com/Abelo9996/nerf-watch): local-first detector of silent model,
  effort, token and cost changes in agent logs. Its anonymized report is what a regression
  report contains.
- [snap-back](https://github.com/Abelo9996/snap-back): undo for any coding agent.
- [agent-fence](https://github.com/Abelo9996/agent-fence): one permission policy for any agent.
- [launch-day-kit](https://github.com/Abelo9996/launch-day-kit): playbook, templates and a
  scaffolder for shipping a companion repo within hours of a platform launch.

Each tool has a section on the home page with its install command and a terminal recording,
linked by name: [#nerf-watch](https://abelo9996.github.io/open-agent-lab/#nerf-watch),
[#rerun-bench](https://abelo9996.github.io/open-agent-lab/#rerun-bench),
[#snap-back](https://abelo9996.github.io/open-agent-lab/#snap-back),
[#agent-fence](https://abelo9996.github.io/open-agent-lab/#agent-fence),
[#launch-day-kit](https://abelo9996.github.io/open-agent-lab/#launch-day-kit).

## Add a result set

1. Run rerun-bench with at least 3 runs per task, then
   `rerun-bench report results/ --format json -o report.json`.
2. Copy the file to `data/results/<YYYY-MM-DD>-<label>.json`, where the date is the day the
   runs started (UTC) and the label is lowercase letters, digits and hyphens.
3. Optionally add a `lab` block (title, pilot flag, notes, links). See
   [CONTRIBUTING.md](CONTRIBUTING.md#the-lab-block).
4. `npm run validate && npm run build`, then open a pull request. When it merges to `main`,
   the pages workflow rebuilds and deploys the site.

A file straight from `rerun-bench report --format json` validates without any edits.

## Run locally

Requires Node.js 20 or newer. There is nothing to install.

```sh
npm run validate   # check data/
npm test           # tests for the validator
npm run build      # write _site/
npm run serve      # preview at http://localhost:8080/
npm run social     # re-render the social preview image (needs Chrome)
```

The pages work without JavaScript and with `prefers-reduced-motion: reduce`: every number,
chart mark and demo still frame is final in the HTML, and animation is layered on top.

## How results are presented

- Agents are listed alphabetically. There is no rank column.
- When two agents' 95% intervals overlap, the site says the data does not show a difference.
- Sample size is shown on every result set, and pilot runs are labeled as pilots.
- Values a CLI does not report are shown as not reported, never as zero.

## License

Code: MIT, see [LICENSE](LICENSE). Data under `data/`: CC BY 4.0.
