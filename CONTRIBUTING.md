# Contributing

Two kinds of data are welcome: result sets from rerun-bench, and regression reports from
nerf-watch. Code changes to the site are welcome too; keep the build dependency-free.

## Submitting results

Open a pull request that adds one file to `data/results/`.

### File

- Name: `data/results/<YYYY-MM-DD>-<label>.json`. The date is the UTC day the runs started.
  The label is lowercase letters, digits and hyphens, for example `claude-2-1-288-n5`.
- Content: the output of `rerun-bench report <results dir> --format json`, unedited apart
  from the optional `lab` block below.
- One result set per file. Each entry inside it is one agent, model and CLI version.

### Required metadata (in the pull request description)

- Agent CLI and exact version for each entry (`<cli> --version`).
- Model, and how it was selected (flag, config, or CLI default).
- rerun-bench version and commit.
- Runs per task (at least 3) and the exact `rerun-bench run` commands.
- Machine: OS, CPU architecture, Python version.
- Authentication type (API key or subscription login), because it changes what reported
  cost means.
- Whether agents ran concurrently, and the `--jobs` value.
- Any non-default isolation or `--agent-opt` settings.
- A link to the raw run records (`meta.json`, `runs.jsonl`, diffs), for example a branch or
  release in your fork of rerun-bench. Results without run records are not merged.
- Any failure you investigated, and whether it was the agent, the task or the environment.

### The lab block

Optional. Add it at the top level of the JSON file:

```json
"lab": {
  "title": "Claude Code 2.1.288 vs Codex CLI 0.160.0, 10 tasks x 5 runs",
  "pilot": false,
  "date": "2026-10-03",
  "source_url": "https://github.com/<you>/rerun-bench/tree/<branch>/results",
  "harness_commit": "7a2bef2",
  "machine": "macOS 26.2, Apple Silicon (arm64), Python 3.13.15",
  "launch": "gpt-6-luna",
  "notes": ["One sentence per note. Plain facts about the run."]
}
```

| Field | Meaning |
|---|---|
| `title` | Heading for the result set. Defaults to the date and label. |
| `pilot` | `true` shows a "Pilot, n=N per task" badge. Use it for runs meant to test the setup. |
| `date` | Must equal the date in the file name. |
| `source_url` | HTTPS link to run records and diffs. |
| `harness_commit` | rerun-bench commit hash. |
| `machine` | Where the runs happened. |
| `launch` | Set for launch-day result sets: the model that launched. |
| `notes` | Facts a reader needs: cost semantics, failures and their causes, deviations. |

### Checks

```sh
npm run validate
npm test
npm run build
```

CI runs the same checks on every pull request. The validator rejects files whose numbers
contradict each other (for example a pass rate outside its own interval, or per-run outcomes
that do not add up to the pass count).

### Review

A maintainer checks the run records against the report, reruns the report from
`runs.jsonl` with the stated rerun-bench version, and confirms the metadata. Copy is kept
factual: no claims beyond what the numbers show.

## Submitting a regression report

1. Run `npx nerf-watch report --json --out nerf-watch-report.json`.
2. Read the file. It should contain only aggregate numbers, CLI versions, model ids, dates
   and counts. Remove anything you do not want public.
3. Open a [regression report](https://github.com/Abelo9996/open-agent-lab/issues/new?template=regression-report.yml)
   and fill in every required field: agent, CLI version before and after, model requested,
   nerf-watch version, date first noticed, the report JSON, and what you observed.

A maintainer reviews the issue. Reviewed reports are added to `data/regressions.json` with
one of these statuses:

| Status | Meaning |
|---|---|
| `open` | Reviewed, plausible, not yet confirmed. |
| `confirmed` | Matched by independent reports or reproduced with rerun-bench. |
| `not-reproduced` | Could not be reproduced and no matching reports arrived. |
| `explained` | Caused by a documented change (release notes, settings, plan change). |

### regressions.json entry

```json
{
  "id": "claude-2-1-272-cache-writes",
  "reported_at": "2026-10-03",
  "agent": "claude",
  "model": "claude-opus-5",
  "cli_before": "2.1.271",
  "cli_after": "2.1.272",
  "signal": "cache-writes",
  "summary": "Median cache writes per call rose from 926 to 3,037 after the update.",
  "independent_reports": 1,
  "status": "open",
  "issue_url": "https://github.com/Abelo9996/open-agent-lab/issues/1"
}
```

`signal` is one of `model-reroute`, `effort-drop`, `context-shrink`, `cache-writes`,
`cache-hit-rate`, `tool-errors`, `tokens`, `cost`, `pass-rate`, `other`. `agent` must be an id
in `data/agents.json`.

## Adding an agent

Add an entry to `data/agents.json` with an `id` matching the `agent` field rerun-bench writes,
a display `name`, and an HTTPS `homepage` or `null`.

## Writing style

Plain, specific, factual. No superlatives, no rankings where intervals overlap, no claims
beyond the data. Use hyphens or commas, not long dashes.
