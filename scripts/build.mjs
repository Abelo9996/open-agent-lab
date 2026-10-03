#!/usr/bin/env node
// Builds the static site from data/*.json into _site/.
// Usage: node scripts/build.mjs [--out _site]
// Fails (exit 1) if any data file does not validate.

import { mkdirSync, writeFileSync, copyFileSync, rmSync, readdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadAll } from "./lib/data.mjs";
import {
  esc,
  pct,
  ci,
  int,
  usd,
  secs,
  dec,
  compact,
  intervalChart,
  multiDotChart,
  rangeChart,
  consistencyGrid,
} from "./lib/charts.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
const OUT = join(root, outArg > -1 ? process.argv[outArg + 1] : "_site");
// Absolute base path, only used by 404.html (served at arbitrary depths).
const BASE = process.env.SITE_BASE || "/open-agent-lab/";

const REPO = "https://github.com/Abelo9996/open-agent-lab";
const GH = "https://github.com/Abelo9996";
const TOOLS = {
  rerunBench: `${GH}/rerun-bench`,
  metrics: `${GH}/rerun-bench/blob/main/docs/METRICS.md`,
  nerfWatch: `${GH}/nerf-watch`,
  snapBack: `${GH}/snap-back`,
  agentFence: `${GH}/agent-fence`,
};
const ISSUE_FORM = `${REPO}/issues/new?template=regression-report.yml`;

const { errors, warnings, data } = loadAll(root);
for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}

let commit = process.env.GITHUB_SHA || "";
if (!commit) {
  try {
    commit = execSync("git rev-parse HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    commit = "";
  }
}
const shortCommit = commit.slice(0, 7);

const agentName = (id) => data.agents.find((a) => a.id === id)?.name || id;
const taskById = Object.fromEntries(data.tasks.tasks.map((t) => [t.id, t]));
const byName = (a, b) => agentName(a.agent).localeCompare(agentName(b.agent)) || a.run_id.localeCompare(b.run_id);

// ---------------------------------------------------------------- layout

const NAV = [
  ["", "Home"],
  ["results/", "Results"],
  ["methodology/", "Methodology"],
  ["regressions/", "Regression watch"],
  ["launches/", "Launch day"],
];

const mark = `<svg class="logo" width="28" height="20" viewBox="0 0 28 20" aria-hidden="true" focusable="false"><rect x="1" y="6" width="4" height="13" rx="1"/><rect x="8" y="2" width="4" height="17" rx="1"/><rect x="15" y="8" width="4" height="11" rx="1"/><rect x="22" y="2" width="4" height="17" rx="1" class="logo-hi"/></svg>`;

function layout({ path, title, description, body, absolute = false }) {
  const depth = path === "" ? 0 : path.split("/").filter(Boolean).length;
  const pre = absolute ? BASE : depth ? "../".repeat(depth) : "./";
  const nav = NAV.map(([href, label]) => {
    const cur = href === path ? ' aria-current="page"' : "";
    return `<li><a href="${pre}${href}"${cur}>${esc(label)}</a></li>`;
  }).join("");
  const fullTitle = path === "" ? "open agent lab" : `${title} | open agent lab`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="${pre}assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${pre}assets/style.css">
<script src="${pre}assets/site.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${pre}">${mark}<span>open agent lab</span></a>
    <nav aria-label="Main"><ul>${nav}</ul></nav>
  </div>
  <div class="ruler" aria-hidden="true"></div>
</header>
<main id="main" class="wrap">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-inner">
    <p>Code under the MIT license. Data under CC BY 4.0. Every number on this site comes from a file in <a href="${REPO}/tree/main/data">data/</a>.</p>
    <p class="mono">${shortCommit ? `built from <a href="${REPO}/commit/${esc(commit)}">${esc(shortCommit)}</a>` : "local build"} &middot; <a href="${REPO}">source</a> &middot; <a href="${REPO}/issues">issues</a></p>
  </div>
</footer>
<div class="tip" role="tooltip" id="tip" hidden></div>
</body>
</html>
`;
}

const badge = (text, kind = "") => `<span class="badge ${kind}">${esc(text)}</span>`;
const sectionHead = (num, label, title, id) =>
  `<p class="eyebrow"><span class="mono">${num}</span> ${esc(label)}</p><h2${id ? ` id="${id}"` : ""}>${title}</h2>`;

function resultBadges(r) {
  const n = Math.min(...r.entries.map((e) => e.metrics.min_runs_per_task));
  const b = [];
  if (r.lab.pilot) b.push(badge(`Pilot, n=${n} per task`, "pilot"));
  else b.push(badge(`n=${n} per task`));
  if (r.lab.launch) b.push(badge(`Launch day: ${r.lab.launch}`));
  return b.join(" ");
}

function overlapVerdict(entries) {
  if (entries.length < 2) return "One agent in this result set, so there is no comparison to make.";
  const apart = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i].metrics.pass_rate_ci95;
      const b = entries[j].metrics.pass_rate_ci95;
      if (a[1] < b[0] || b[1] < a[0]) apart.push(`${agentName(entries[i].agent)} and ${agentName(entries[j].agent)}`);
    }
  }
  if (!apart.length) {
    return "The 95% intervals overlap for every pair of agents here, so this data does not show that any agent has a higher pass rate than another.";
  }
  return `The 95% intervals do not overlap for: ${apart.join("; ")}. The intervals treat runs as independent, so they understate uncertainty about the task population; see the task-bootstrap interval in the table below before reading this as a difference.`;
}

const entryLabel = (e) => agentName(e.agent);
const entrySub = (e) => [e.model, e.cli_version].filter(Boolean).join(" · ");

// ---------------------------------------------------------------- results

function setupTable(r) {
  const rows = r.entries
    .slice()
    .sort(byName)
    .map(
      (e) => `<tr><th scope="row">${esc(agentName(e.agent))}</th><td class="mono">${esc(e.cli_version || "not reported")}</td><td class="mono">${esc(
        e.model || "default (not reported)",
      )}</td><td class="num">${e.metrics.n_tasks}</td><td class="num">${e.metrics.min_runs_per_task}</td><td class="num">${e.metrics.n_runs}</td><td class="mono">${esc(
        e.started_at.replace("T", " ").replace(/\+00:00$|Z$/, " UTC"),
      )}</td></tr>`,
    )
    .join("");
  return `<div class="tablewrap"><table class="data">
<caption class="sr-only">Run setup</caption>
<thead><tr><th scope="col">Agent</th><th scope="col">CLI version</th><th scope="col">Model</th><th scope="col" class="num">Tasks</th><th scope="col" class="num">Runs per task</th><th scope="col" class="num">Runs</th><th scope="col">Started</th></tr></thead>
<tbody>${rows}</tbody></table></div>`;
}

function metricsTable(r) {
  const es = r.entries.slice().sort(byName);
  const k = es[0].metrics.k;
  const rows = [
    ["Pass rate", "Wilson 95% interval", (m) => `${pct(m.pass_rate)} ${ci(m.pass_rate_ci95)}`],
    ["Macro pass rate", "task-bootstrap 95% interval", (m) => `${pct(m.macro_pass_rate)} ${ci(m.macro_pass_rate_task_bootstrap_ci95)}`],
    [`pass@${k}`, "at least one of k runs passes", (m) => pct(m.pass_at_k)],
    [`pass^${k}`, "all k runs pass", (m) => pct(m.pass_hat_k)],
    ["Flip rate", "two runs of a task disagree", (m) => pct(m.flip_rate)],
    ["Flaky tasks", "share with both a pass and a fail", (m) => `${Math.round(m.flaky_task_fraction * m.n_tasks)} of ${m.n_tasks}`],
    ["Median cost per run", "as reported by the CLI", (m) => usd(m.median_cost_usd)],
    ["Median total tokens per run", "includes cache reads", (m) => int(m.tokens_median)],
    ["Median output tokens per run", "", (m) => int(m.output_tokens_median)],
    ["Median wall time per run", "agent process only", (m) => secs(m.wall_time_median_s)],
    ["Tokens CV within task", "mean over tasks; lower is steadier", (m) => dec(m.tokens_cv_within_task)],
    ["Approach similarity", "Jaccard over passing diffs", (m) => dec(m.approach_similarity)],
  ];
  return `<div class="tablewrap"><table class="data metrics">
<caption class="sr-only">All headline metrics</caption>
<thead><tr><th scope="col">Metric</th>${es.map((e) => `<th scope="col" class="num">${esc(agentName(e.agent))}</th>`).join("")}</tr></thead>
<tbody>${rows
    .map(
      ([name, note, f]) =>
        `<tr><th scope="row">${esc(name)}${note ? `<span class="note">${esc(note)}</span>` : ""}</th>${es
          .map((e) => `<td class="num">${esc(f(e.metrics))}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function resultSection(r, idx) {
  const es = r.entries.slice().sort(byName);
  const id = `r-${r.date}-${r.label}`;
  const k = es[0].metrics.k;
  const title = r.lab.title || `${r.date} ${r.label}`;
  const taskIds = [...new Set(es.flatMap((e) => Object.keys(e.metrics.per_task)))].sort();
  const tasks = taskIds.map((t) => taskById[t] || { id: t, title: t });
  const maxRuns = Math.max(...es.flatMap((e) => Object.values(e.metrics.per_task).map((t) => t.n)));
  const hasCost = es.some((e) => e.metrics.median_cost_usd != null);
  const missingCost = es.filter((e) => e.metrics.median_cost_usd == null).map((e) => agentName(e.agent));

  return `<section class="result" aria-labelledby="${id}">
  <header class="result-head">
    <p class="eyebrow"><span class="mono">${esc(r.date)}</span> result set ${idx + 1} of ${data.results.length}</p>
    <h2 id="${id}">${esc(title)}</h2>
    <p class="badges">${resultBadges(r)} ${badge(`rerun-bench ${r.rerun_bench_version}`)}${r.lab.harness_commit ? " " + badge(`harness ${r.lab.harness_commit}`) : ""}</p>
    <p class="links"><a href="../data/results/${esc(r.file)}">Raw JSON</a>${r.lab.source_url ? ` &middot; <a href="${esc(r.lab.source_url)}">Run records, diffs and notes</a>` : ""}</p>
  </header>

  <h3>Setup</h3>
  ${setupTable(r)}
  ${r.lab.machine ? `<p class="small">Machine: ${esc(r.lab.machine)}.</p>` : ""}

  <h3>Pass rate</h3>
  ${intervalChart({
    id: `${id}-ci`,
    title: "Pass rate with Wilson 95% interval",
    desc: "Dot is the share of runs that passed the task verifier; the bar is the 95% interval. Agents are listed alphabetically.",
    rows: es.map((e) => ({
      label: entryLabel(e),
      sub: entrySub(e),
      est: e.metrics.pass_rate,
      lo: e.metrics.pass_rate_ci95[0],
      hi: e.metrics.pass_rate_ci95[1],
      tipNote: `${e.metrics.passes} of ${e.metrics.n_runs} runs passed`,
    })),
  })}
  <p class="verdict" role="note"><strong>Comparison:</strong> ${esc(overlapVerdict(es))}</p>

  <h3>Consistency across reruns</h3>
  ${multiDotChart({
    id: `${id}-k`,
    title: `pass^${k}, pass@1 and pass@${k}`,
    desc: `pass^${k} is the chance that all ${k} runs of a task pass; pass@${k} that at least one does. The gap between them is the cost of inconsistency.`,
    series: [`pass^${k}`, "pass@1", `pass@${k}`],
    rows: es.map((e) => ({
      label: entryLabel(e),
      sub: entrySub(e),
      values: [e.metrics.pass_hat_k, e.metrics.pass_rate, e.metrics.pass_at_k],
    })),
  })}

  ${consistencyGrid({
    id: `${id}-grid`,
    title: "Every run, by task",
    desc: "Each mark is one run. A task with both marks in a row is a flaky task for that agent.",
    tasks,
    agents: es.map((e) => ({
      label: entryLabel(e),
      runs: maxRuns,
      perTask: Object.fromEntries(Object.entries(e.metrics.per_task).map(([t, v]) => [t, v.outcomes])),
    })),
  })}

  <h3>Tokens and cost</h3>
  ${rangeChart({
    id: `${id}-tok`,
    title: "Total tokens per run, by task",
    desc: "Marker is the median over reruns; the line runs from the smallest to the largest run. Totals include cache reads.",
    series: es.map(entryLabel),
    rows: tasks.map((t) => ({
      label: t.id,
      values: es.map((e) => e.metrics.per_task[t.id]?.total_tokens || null),
    })),
    unit: " tokens",
  })}
  ${
    hasCost
      ? rangeChart({
          id: `${id}-cost`,
          title: "Cost per run as reported by the CLI, by task",
          desc: missingCost.length
            ? `${missingCost.join(", ")} did not report cost, so there are no marks for ${missingCost.length > 1 ? "them" : "it"}.`
            : "Marker is the median over reruns; the line runs from the cheapest to the most expensive run.",
          series: es.map(entryLabel),
          rows: tasks.map((t) => ({
            label: t.id,
            values: es.map((e) => {
              const c = e.metrics.per_task[t.id]?.cost_usd;
              return c && c.median != null ? c : null;
            }),
          })),
          fmt: (v) => (v == null ? "n/a" : `$${v.toFixed(v < 0.1 ? 3 : 2)}`),
        })
      : ""
  }

  <h3>All headline metrics</h3>
  ${metricsTable(r)}

  ${
    r.lab.notes?.length
      ? `<h3>Notes from the run</h3><ul class="notes">${r.lab.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
      : ""
  }
</section>`;
}

function resultsPage() {
  const list = data.results;
  const index =
    list.length > 1
      ? `<nav class="toc" aria-label="Result sets"><ul>${list
          .map((r) => `<li><a href="#r-${r.date}-${r.label}"><span class="mono">${r.date}</span> ${esc(r.lab.title || r.label)}</a></li>`)
          .join("")}</ul></nav>`
      : "";
  const body = list.length
    ? list.map(resultSection).join("\n")
    : `<div class="empty"><p class="empty-title">No result sets yet.</p><p>Drop a rerun-bench JSON report into <code>data/results/</code> to publish one.</p></div>`;
  return layout({
    path: "results/",
    title: "Results",
    description: "Pass rates with confidence intervals, pass^k, flip rate and cost spread for coding agents, from repeated runs of the same tasks.",
    body: `<div class="page-head">
  <p class="eyebrow"><span class="mono">02</span> Results</p>
  <h1>Results</h1>
  <p class="lede">Each result set is one rerun-bench report: the same tasks run several times per agent, model and CLI version, scored only by each task's verifier.</p>
  <div class="rules">
    <p><strong>How to read this page.</strong> Agents are listed alphabetically, never by score. When two agents' 95% intervals overlap, this page does not call either one better. A small sample can show a gap that more runs would erase.</p>
  </div>
</div>
${index}
${body}`,
  });
}

// ---------------------------------------------------------------- home

function homePage() {
  const latest = data.results[0];
  let latestBlock = `<div class="empty"><p class="empty-title">No results published yet.</p></div>`;
  if (latest) {
    const es = latest.entries.slice().sort(byName);
    const k = es[0].metrics.k;
    const tiles = es
      .map(
        (e) => `<div class="tile">
  <p class="tile-name">${esc(agentName(e.agent))}</p>
  <p class="tile-sub mono">${esc(entrySub(e))}</p>
  <dl>
    <div><dt>pass rate</dt><dd>${pct(e.metrics.pass_rate)} <span>${ci(e.metrics.pass_rate_ci95)}</span></dd></div>
    <div><dt>pass^${k}</dt><dd>${pct(e.metrics.pass_hat_k)}</dd></div>
    <div><dt>flip rate</dt><dd>${pct(e.metrics.flip_rate)}</dd></div>
    <div><dt>median tokens</dt><dd>${compact(e.metrics.tokens_median)}</dd></div>
  </dl>
</div>`,
      )
      .join("");
    latestBlock = `<div class="latest">
  <div class="latest-head">
    <p class="mono small">${esc(latest.date)}</p>
    <h3>${esc(latest.lab.title || latest.label)}</h3>
    <p class="badges">${resultBadges(latest)}</p>
  </div>
  ${intervalChart({
    id: "home-ci",
    title: "Pass rate with Wilson 95% interval",
    rows: es.map((e) => ({
      label: entryLabel(e),
      sub: e.model,
      est: e.metrics.pass_rate,
      lo: e.metrics.pass_rate_ci95[0],
      hi: e.metrics.pass_rate_ci95[1],
      tipNote: `${e.metrics.passes} of ${e.metrics.n_runs} runs passed`,
    })),
    compactView: true,
  })}
  <div class="tiles">${tiles}</div>
  <p class="verdict" role="note">${esc(overlapVerdict(es))}</p>
  <p><a class="more" href="results/">Full results, per-task grid and table view</a></p>
</div>`;
  }

  const tools = [
    ["rerun-bench", TOOLS.rerunBench, "Runs the same tasks N times per agent and reports pass rate with a Wilson interval, pass^k, flip rate, and cost and token spread.", "Produces every result on this site."],
    ["nerf-watch", TOOLS.nerfWatch, "Reads the session logs Claude Code and Codex already write and flags silent changes in model, reasoning effort, tokens and cost. Runs locally.", "Its anonymized report is what a regression report contains."],
    ["snap-back", TOOLS.snapBack, "Undo for any coding agent. Snapshots the project in a shadow git repo so one command rolls back what the agent did.", "Lets you try an agent update without risking your working tree."],
    ["agent-fence", TOOLS.agentFence, "One permission policy for any coding agent: allow, ask or deny shell commands, file access and git operations, with an audit log of every decision. Hooks for Claude Code and Codex.", "Keeps benchmark and everyday runs inside rules you can read and test."],
  ]
    .map(
      ([name, url, what, role]) => `<li class="tool">
  <h3><a href="${url}"><span class="mono">${name}</span></a></h3>
  <p>${esc(what)}</p>
  <p class="tool-role">${esc(role)}</p>
</li>`,
    )
    .join("");

  return layout({
    path: "",
    title: "Home",
    description: "Independent, reproducible evaluation of coding agents. Same tasks, many runs, intervals shown.",
    body: `<section class="hero">
  <p class="eyebrow"><span class="mono">01</span> open agent lab</p>
  <h1>Coding agents, measured more than once.</h1>
  <p class="lede">An independent lab that reruns the same coding tasks many times per agent, model and CLI version, and publishes how often each run passes, how often results flip, and what each run costs, with the uncertainty shown.</p>
  <p class="hero-links"><a class="button" href="results/">See results</a> <a class="button ghost" href="methodology/">How runs are scored</a></p>
</section>

<section aria-labelledby="latest">
  ${sectionHead("02", "Latest", "Latest result set", "latest")}
  ${latestBlock}
</section>

<section aria-labelledby="tools">
  ${sectionHead("03", "Tools", "The tools behind the lab", "tools")}
  <p>All four are open source and run on your own machine.</p>
  <ul class="tools">${tools}</ul>
</section>

<section aria-labelledby="contribute">
  ${sectionHead("04", "Contribute", "Contribute data", "contribute")}
  <div class="cols">
    <div class="col">
      <h3>Results</h3>
      <ol class="steps">
        <li>Run <a href="${TOOLS.rerunBench}">rerun-bench</a> with at least 3 runs per task.</li>
        <li>Generate the JSON report: <code>rerun-bench report results/ --format json</code>.</li>
        <li>Save it as <code>data/results/&lt;YYYY-MM-DD&gt;-&lt;label&gt;.json</code> and open a pull request with the CLI versions, models and machine.</li>
      </ol>
    </div>
    <div class="col">
      <h3>Regression reports</h3>
      <ol class="steps">
        <li>Run <code>npx github:Abelo9996/nerf-watch report --json --out nerf-watch-report.json</code>.</li>
        <li>Read the report. It holds aggregate numbers only.</li>
        <li><a href="${ISSUE_FORM}">Open a regression report</a> and paste it in.</li>
      </ol>
    </div>
  </div>
  <p><a href="${REPO}/blob/main/CONTRIBUTING.md">Required metadata and review steps</a></p>
</section>`,
  });
}

// ---------------------------------------------------------------- methodology

function methodologyPage() {
  const taskRows = data.tasks.tasks
    .map(
      (t) =>
        `<tr><th scope="row"><span class="mono">${esc(t.id)}</span></th><td>${esc(t.title)}</td><td>${t.tags.map((g) => `<span class="tag">${esc(g)}</span>`).join(" ")}</td><td class="num">${t.timeout_s ?? "n/a"} s</td></tr>`,
    )
    .join("");
  const metrics = [
    ["Pass rate", "Passing runs divided by all runs. A run passes only if the task's verify.py exits 0. The agent's exit code and its own claims of success are recorded but never scored."],
    ["Wilson 95% interval", "The range of pass rates consistent with the observed runs. Unlike the normal approximation, it behaves at 0% and 100% and at small n. With 30 runs and 30 passes the interval is still 89% to 100%."],
    ["Macro pass rate and task-bootstrap interval", "The mean of per-task pass rates, with an interval from resampling tasks. It reflects uncertainty about the task population, which the pooled Wilson interval ignores. Use it when comparing agents across the suite."],
    ["pass@k", "Chance that at least one of k runs of a task passes (Chen et al. 2021). What you get if you retry until it works."],
    ["pass^k", "Chance that all k runs of a task pass (Yao et al. 2024). What you get if you run the agent once and trust the result."],
    ["Flip rate", "Chance that two runs of the same task disagree, averaged over tasks. 0 means every task always passes or always fails."],
    ["Flaky task fraction", "Share of tasks with at least one pass and at least one fail. Coarser than flip rate and grows with n."],
    ["Cost, tokens, wall time", "Medians per run as the CLI reports them. A value the CLI does not report is null and shown as not reported, never as zero. Wall time covers the agent process only."],
    ["Within-task CV", "Coefficient of variation across reruns of one task, averaged over tasks. It measures how steady one agent is, not how different the tasks are."],
    ["Approach similarity", "Mean Jaccard similarity of changed lines across passing runs of a task. 1.0 means every passing run made the same edit."],
  ]
    .map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`)
    .join("");
  return layout({
    path: "methodology/",
    title: "Methodology",
    description: "How runs are isolated and scored, what each metric means, the task suite, and known limitations.",
    body: `<div class="page-head">
  <p class="eyebrow"><span class="mono">03</span> Methodology</p>
  <h1>Methodology</h1>
  <p class="lede">Every number on this site is produced by <a href="${TOOLS.rerunBench}">rerun-bench</a>. The formulas, with unit tests, are in <a href="${TOOLS.metrics}">docs/METRICS.md</a>. This page summarizes them.</p>
</div>

<section aria-labelledby="m-run">
  ${sectionHead("3.1", "Runs", "What one run is", "m-run")}
  <ol class="steps">
    <li>rerun-bench copies the task's starting workspace into a fresh temporary directory. Nothing carries over between runs.</li>
    <li>It starts the agent CLI headlessly in that directory with the task prompt, and records wall time, exit status, token counts, cost when the CLI reports it, the CLI version, the model and the final diff.</li>
    <li>The task's verifier runs against the workspace. The run passes if and only if the verifier exits 0.</li>
  </ol>
  <p>Runs are interleaved: run 0 of every task, then run 1 of every task, and so on, so a provider-side change in the middle of a session spreads across tasks instead of landing on whichever task ran last.</p>
</section>

<section aria-labelledby="m-metrics">
  ${sectionHead("3.2", "Metrics", "What each metric means", "m-metrics")}
  <dl class="defs">${metrics}</dl>
  <p><code>pass^k</code> is never higher than pass@1, and pass@1 is never higher than <code>pass@k</code>. The gap between pass@k and pass^k is the cost of inconsistency. <a href="${TOOLS.metrics}">Full formulas in METRICS.md</a>.</p>
</section>

<section aria-labelledby="m-compare">
  ${sectionHead("3.3", "Comparisons", "How agents are compared", "m-compare")}
  <ul class="plain">
    <li>Agents are listed alphabetically on every page. There is no rank column.</li>
    <li>When two agents' 95% intervals overlap, the site states that the data does not show a difference. It does not call either one better.</li>
    <li>Statistical tests between result sets (Fisher exact per task, paired task-level bootstrap) are planned in rerun-bench and not yet run. Until they are, non-overlapping intervals are reported as such and nothing more.</li>
    <li>Results from different dates, machines or CLI versions are separate result sets and are not pooled.</li>
  </ul>
</section>

<section aria-labelledby="m-tasks">
  ${sectionHead("3.4", "Tasks", "Task suite", "m-tasks")}
  <p>${esc(data.tasks.suite)}: ${data.tasks.tasks.length} small, verifiable Python tasks. Each has a prompt, a starting workspace, a reference solution and a verifier script. They cover precise edits, bug fixes, implementing to a spec, refactors that must preserve behavior, following repository instructions, and writing tests that must catch injected bugs. <a href="${esc(data.tasks.source_url)}">Task sources</a>.</p>
  <div class="tablewrap"><table class="data">
    <caption class="sr-only">Tasks in the suite</caption>
    <thead><tr><th scope="col">Task</th><th scope="col">What it asks</th><th scope="col">Tags</th><th scope="col" class="num">Timeout</th></tr></thead>
    <tbody>${taskRows}</tbody>
  </table></div>
</section>

<section aria-labelledby="m-iso">
  ${sectionHead("3.5", "Isolation", "How runs are isolated", "m-iso")}
  <ul class="plain">
    <li><strong>Workspace.</strong> Each run gets its own temporary copy of the task workspace. Task workspaces are not git repositories.</li>
    <li><strong>Personal configuration.</strong> For Claude Code, rerun-bench loads only project and local settings (<code>--setting-sources project,local --strict-mcp-config</code>), so the user's hooks, plugins and MCP servers do not apply. For Codex CLI it passes <code>--ignore-user-config</code>, so the model, reasoning effort and hooks in the user's config do not apply. Authentication still works.</li>
    <li><strong>Nested sessions.</strong> When rerun-bench itself runs inside an agent session, that session's environment variables are removed before the measured agent starts.</li>
    <li><strong>Permissions.</strong> The agent runs with file-edit and shell permissions inside the temporary directory, like any unattended agent session.</li>
  </ul>
</section>

<section aria-labelledby="m-limits">
  ${sectionHead("3.6", "Limits", "Known limitations", "m-limits")}
  <ul class="plain">
    <li><strong>Small samples.</strong> At 3 runs per task, one failure moves a task's pass rate by 33 points. Results marked pilot are checks that the harness works, not leaderboards.</li>
    <li><strong>Small tasks.</strong> Ten short Python tasks do not represent work in large repositories, other languages, or long sessions.</li>
    <li><strong>One machine, one day.</strong> Each result set comes from one machine at one time. Provider-side load, routing and model changes are outside the lab's control.</li>
    <li><strong>Cost semantics.</strong> Claude Code reports cost at list prices even on a subscription login, where it is quota used rather than money billed. Codex CLI reports tokens only.</li>
    <li><strong>Model identity.</strong> <code>codex exec --json</code> does not report the model, so it is recorded from the <code>--model</code> flag passed to the CLI.</li>
    <li><strong>Token counts.</strong> Totals include cache reads, which dominate the count for both CLIs. Turn counts are not comparable across CLIs and are not shown.</li>
    <li><strong>Approach similarity.</strong> Line-level Jaccard is sensitive to formatting and ignores line order. It signals variability, not code quality.</li>
    <li><strong>Concurrency.</strong> In the pilot the two agents ran at the same time on one machine, which can affect wall time.</li>
  </ul>
</section>

<section aria-labelledby="m-repro">
  ${sectionHead("3.7", "Reproduce", "Reproduce a result set", "m-repro")}
  <pre><code>uv tool install git+https://github.com/Abelo9996/rerun-bench
rerun-bench run --agent claude --tasks all --runs 3 --out results/ --run-id claude --yes
rerun-bench run --agent codex --model &lt;model&gt; --tasks all --runs 3 --out results/ --run-id codex --yes
rerun-bench report results/ --format json -o report.json</code></pre>
  <p>Real runs spend API credit or subscription quota. Start with <code>--tasks edit-config --runs 2</code>.</p>
</section>`,
  });
}

// ---------------------------------------------------------------- regressions

const SIGNAL_LABEL = {
  "model-reroute": "Different model answered",
  "effort-drop": "Reasoning effort dropped",
  "context-shrink": "Context window shrank",
  "cache-writes": "Cache writes jumped",
  "cache-hit-rate": "Cache hit rate fell",
  "tool-errors": "Tool errors rose",
  tokens: "Token use changed",
  cost: "Cost changed",
  "pass-rate": "Pass rate changed",
  other: "Other",
};
const STATUS_LABEL = {
  open: "Open",
  confirmed: "Confirmed",
  "not-reproduced": "Not reproduced",
  explained: "Explained",
};

function regressionsPage() {
  const reports = data.regressions.slice().sort((a, b) => b.reported_at.localeCompare(a.reported_at));
  const table = reports.length
    ? `<div class="tablewrap"><table class="data">
<caption class="sr-only">Reported regressions</caption>
<thead><tr><th scope="col">Reported</th><th scope="col">Agent</th><th scope="col">Model</th><th scope="col">CLI change</th><th scope="col">Signal</th><th scope="col">Summary</th><th scope="col" class="num">Reports</th><th scope="col">Status</th></tr></thead>
<tbody>${reports
        .map(
          (r) => `<tr><td class="mono">${esc(r.reported_at)}</td><th scope="row">${esc(agentName(r.agent))}</th><td class="mono">${esc(r.model || "n/a")}</td><td class="mono">${esc(
            `${r.cli_before || "?"} to ${r.cli_after || "?"}`,
          )}</td><td>${esc(SIGNAL_LABEL[r.signal])}</td><td>${esc(r.summary)} <a href="${esc(r.issue_url)}">issue</a></td><td class="num">${r.independent_reports}</td><td><span class="status st-${esc(r.status)}">${esc(
            STATUS_LABEL[r.status],
          )}</span></td></tr>`,
        )
        .join("")}</tbody></table></div>`
    : `<div class="empty">
  <svg class="empty-art" viewBox="0 0 240 64" aria-hidden="true" focusable="false"><line x1="0" y1="40" x2="240" y2="40" class="empty-base"/><path d="M0 40 H60 L66 34 L72 46 L78 40 H240" class="empty-line"/><circle cx="210" cy="40" r="4" class="empty-dot"/></svg>
  <p class="empty-title">No regression reports yet.</p>
  <p>When reports arrive, each confirmed or open report is listed here with the agent, model, the CLI versions before and after, the signal nerf-watch flagged, how many independent reports agree, and its status. Nothing is listed on the strength of one unreviewed report.</p>
  <p><a class="button" href="${ISSUE_FORM}">Report a suspected regression</a></p>
</div>`;
  return layout({
    path: "regressions/",
    title: "Regression watch",
    description: "Reports of silent changes in coding agents: model rerouting, effort drops, token and cost jumps, collected from anonymized nerf-watch reports.",
    body: `<div class="page-head">
  <p class="eyebrow"><span class="mono">04</span> Regression watch</p>
  <h1>Regression watch</h1>
  <p class="lede">A place to collect evidence when an agent quietly gets worse or more expensive after an update, so a change that hits many people shows up as many matching reports instead of scattered complaints.</p>
  <p><a class="button" href="${ISSUE_FORM}">Report a suspected regression</a></p>
</div>

<section aria-labelledby="g-nw">
  ${sectionHead("4.1", "nerf-watch", "Where the evidence comes from", "g-nw")}
  <p><a href="${TOOLS.nerfWatch}">nerf-watch</a> reads the session logs that Claude Code and Codex already write on your machine and compares your own history across CLI versions and over time. It flags changes you did not make:</p>
  <ul class="plain">
    <li>a different model answered than the one you picked;</li>
    <li>reasoning effort dropped;</li>
    <li>the context window shrank;</li>
    <li>cache writes per turn jumped, or the cache hit rate collapsed, after a CLI update;</li>
    <li>tool calls started failing more often.</li>
  </ul>
  <p>Everything runs locally. <code>nerf-watch report</code> writes aggregate numbers only: token medians, rates, CLI versions, model ids, dates and counts. It contains no prompts, responses, tool output, file paths, project names or session ids. Read it before you share it.</p>
</section>

<section aria-labelledby="g-how">
  ${sectionHead("4.2", "Report", "How to report", "g-how")}
  <ol class="steps">
    <li>Run <code>npx github:Abelo9996/nerf-watch report --json --out nerf-watch-report.json</code> (Node.js 20 or newer).</li>
    <li>Open the file and check that it contains nothing you do not want to publish. The issue is public.</li>
    <li><a href="${ISSUE_FORM}">Open a regression report</a>, paste the JSON, and fill in the agent, CLI versions and model.</li>
  </ol>
  <p>Reports are reviewed by hand. A report is listed below once it is reviewed; its status says whether it was confirmed by more reports or by a rerun-bench run, not reproduced, or explained by a documented change.</p>
</section>

<section aria-labelledby="g-list">
  ${sectionHead("4.3", "Reports", "Reported regressions", "g-list")}
  ${table}
</section>`,
  });
}

// ---------------------------------------------------------------- launches

function launchesPage() {
  const ls = data.launches.slice().sort((a, b) => b.announced_at.localeCompare(a.announced_at));
  const hours = (a, b) => (a && b ? `${((Date.parse(b) - Date.parse(a)) / 36e5).toFixed(1)} h` : "n/a");
  const table = ls.length
    ? `<div class="tablewrap"><table class="data">
<caption class="sr-only">Launch-day result sets</caption>
<thead><tr><th scope="col">Model</th><th scope="col">Vendor</th><th scope="col">Announced</th><th scope="col">Status</th><th scope="col" class="num">Published after</th><th scope="col">Results</th></tr></thead>
<tbody>${ls
        .map(
          (l) => `<tr><th scope="row" class="mono">${esc(l.model)}</th><td>${esc(l.vendor)}</td><td class="mono">${esc(l.announced_at.replace("T", " "))}</td><td>${esc(l.status)}</td><td class="num">${hours(
            l.announced_at,
            l.published_at,
          )}</td><td>${l.results_file ? `<a href="../results/#r-${esc(l.results_file.replace(/\.json$/, ""))}">result set</a>` : "pending"}</td></tr>`,
        )
        .join("")}</tbody></table></div>`
    : `<div class="empty">
  <svg class="empty-art" viewBox="0 0 240 64" aria-hidden="true" focusable="false"><line x1="0" y1="40" x2="240" y2="40" class="empty-base"/>${Array.from({ length: 24 }, (_, i) => `<line x1="${6 + i * 10}" x2="${6 + i * 10}" y1="${i % 6 === 0 ? 30 : 35}" y2="40" class="empty-tick"/>`).join("")}<circle cx="6" cy="40" r="4" class="empty-dot"/></svg>
  <p class="empty-title">No launch-day results yet.</p>
  <p>The first one will appear here after the next major model launch, with the time from announcement to publication.</p>
</div>`;
  return layout({
    path: "launches/",
    title: "Launch day",
    description: "Plan for publishing rerun-bench numbers within 24 hours of major model launches.",
    body: `<div class="page-head">
  <p class="eyebrow"><span class="mono">05</span> Launch day</p>
  <h1>Launch-day results</h1>
  <p class="lede">The plan: publish rerun-bench numbers for a new model within 24 hours of its launch, so there is a measured, reproducible data point next to the announcement.</p>
</div>

<section aria-labelledby="l-plan">
  ${sectionHead("5.1", "Plan", "What happens after a launch", "l-plan")}
  <ol class="timeline">
    <li><span class="mono t">T+0</span><div><strong>Announcement.</strong> The model becomes available in at least one supported CLI (Claude Code, Codex CLI, OpenCode). The announcement time is recorded.</div></li>
    <li><span class="mono t">T+0 to 2 h</span><div><strong>Setup.</strong> The current CLI version is pinned. The new model and the model it replaces are run with the same CLI version, the same harness commit and the same machine.</div></li>
    <li><span class="mono t">T+2 to 20 h</span><div><strong>Runs.</strong> The full default suite, at least 5 runs per task, interleaved. Failures are checked against their diffs before publishing, and any failure caused by the harness or the environment is reported, not hidden.</div></li>
    <li><span class="mono t">by T+24 h</span><div><strong>Publish.</strong> The report goes into <code>data/results/</code> with <code>lab.launch</code> set, run records and diffs are linked, and the publication time is recorded below.</div></li>
  </ol>
  <p>If 24 hours is not enough to finish the runs, the result set is published late and the delay is shown. Launch-day numbers follow the same rules as every other result: intervals shown, no ranking when they overlap.</p>
</section>

<section aria-labelledby="l-list">
  ${sectionHead("5.2", "Log", "Launch-day log", "l-list")}
  ${table}
</section>`,
  });
}

function notFoundPage() {
  return layout({
    path: "404",
    absolute: true,
    title: "Not found",
    description: "Page not found.",
    body: `<div class="page-head"><p class="eyebrow"><span class="mono">404</span></p><h1>No page here.</h1><p class="lede"><a href="${BASE}">Back to the home page</a>.</p></div>`,
  });
}

// ---------------------------------------------------------------- write

rmSync(OUT, { recursive: true, force: true });
const write = (rel, content) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
};

write("index.html", homePage());
write("results/index.html", resultsPage());
write("methodology/index.html", methodologyPage());
write("regressions/index.html", regressionsPage());
write("launches/index.html", launchesPage());
write("404.html", notFoundPage());
write(".nojekyll", "");

mkdirSync(join(OUT, "assets"), { recursive: true });
for (const f of readdirSync(join(root, "src"))) copyFileSync(join(root, "src", f), join(OUT, "assets", f));
const copyDir = (from, to) => {
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from, { withFileTypes: true })) {
    if (f.name.startsWith(".")) continue;
    if (f.isDirectory()) copyDir(join(from, f.name), join(to, f.name));
    else copyFileSync(join(from, f.name), join(to, f.name));
  }
};
if (existsSync(join(root, "data"))) copyDir(join(root, "data"), join(OUT, "data"));

console.log(`built ${OUT.replace(root + "/", "")}: 6 pages, ${data.results.length} result set(s)`);
