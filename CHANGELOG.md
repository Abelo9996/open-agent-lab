# Changelog

All notable changes to this project are listed here. Dates are UTC.

## Unreleased

- This repository is a plugin marketplace named `open-agent-lab` for Claude Code
  (`.claude-plugin/marketplace.json`) and Codex (`.agents/plugins/marketplace.json`) that lists
  nerf-watch, snap-back, agent-fence and rerun-bench. Each packaged tool section on the home page
  shows its plugin install line, and the README has an install section.

## 0.1.1 (2026-10-04)

- Install commands on the home page now match the published packages and work as pasted:
  `uvx rerun-bench run --agent mock` (rerun-bench is on PyPI; the git install is gone),
  `npx @abelo9996/snap-back wrap -- codex`, and each tool names its prerequisite and next
  command. The methodology page installs rerun-bench with `uv tool install rerun-bench`.
- Plain-language reading next to the numbers: an "In plain words" summary of each result set
  on the home and results pages, a key for pass rate and its interval, pass^k, flip rate and
  median tokens, and the hero tallies read "95% interval: 89% to 100%" instead of a bare
  "95% [89, 100]" that could be taken for a pass rate.
- Results and launch-day pages end with next steps (try the mock agent, reproduce, submit
  results, report a regression, follow launches).
- Keyboard: each chart and the pass/fail grid is one tab stop with arrow-key movement inside
  (the results page went from about 110 tab stops to about 25). Tables and code blocks that
  scroll sideways get a tab stop and a name. Grid marks use text instead of aria-label on a
  plain span. The results grid header no longer runs "run 0run 1run 2" together.
- Phone: the page links wrap instead of scrolling sideways, so "Launch day" is visible.
- Tests for the built pages: internal links and anchors, install commands, social tags,
  summaries, tab stops, alt text and dashes.

- Regression watch: a `regressions` workflow (daily, manual, and on regression-report issue
  events) reads open regression-report issues, validates the nerf-watch JSON in each against a
  strict schema, and writes per agent, CLI version, model and signal aggregates (independent
  reports, median effect size, first and last seen, source issues) to `data/regressions.json`.
  The regression watch page renders them; the pages workflow redeploys after a run that
  commits. Parser, validator and aggregator tests include hostile issue bodies.
- The regression report form and the docs point to `npx nerf-watch share`, which fills the
  form in.

- Home page: a hero that shows every run of the latest result set as a pass/fail grid, filled
  in run order on load, with pass counts that follow the grid and a replay control.
- Home page: one section per tool (nerf-watch, rerun-bench, snap-back, agent-fence,
  launch-day-kit) with stable anchors, install command with a copy button, three facts, links,
  and the terminal recording (still frame first, GIF while on screen, pause control).
- Sticky header with a scroll shadow, a scroll-position needle on the ruler, and a light,
  dark or system theme control.
- Hover and focus states on links, buttons, cards, chart rows and grid cells; chart marks grow
  in from their estimate when first scrolled into view; cross-page view transitions.
- All motion is off under `prefers-reduced-motion: reduce`; pages are complete without scripts.
- Open Graph and Twitter card tags on every page and a 1280x640 social preview image
  rendered by `scripts/social.mjs`.

## 0.1.0 (2026-10-03)

First public version.

- Static site built from `data/*.json` by a dependency-free Node script, deployed to GitHub Pages.
- Pages: home, results, methodology, regression watch, launch day, 404.
- Results page: pass rate with Wilson 95% interval, pass^k / pass@1 / pass@k, per-run
  consistency grid, tokens and cost per task, full metrics table, table view for every chart.
- Imported the rerun-bench pilot of 2026-10-03 (Claude Code and Codex CLI, 10 tasks x 3 runs).
- Data validation script, tests for it, and a CI workflow that validates and builds on pull requests.
- Regression report issue form for anonymized nerf-watch reports.
