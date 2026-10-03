# Changelog

All notable changes to this project are listed here. Dates are UTC.

## 0.1.0 (2026-10-03)

First public version.

- Static site built from `data/*.json` by a dependency-free Node script, deployed to GitHub Pages.
- Pages: home, results, methodology, regression watch, launch day, 404.
- Results page: pass rate with Wilson 95% interval, pass^k / pass@1 / pass@k, per-run
  consistency grid, tokens and cost per task, full metrics table, table view for every chart.
- Imported the rerun-bench pilot of 2026-10-03 (Claude Code and Codex CLI, 10 tasks x 3 runs).
- Data validation script, tests for it, and a CI workflow that validates and builds on pull requests.
- Regression report issue form for anonymized nerf-watch reports.
