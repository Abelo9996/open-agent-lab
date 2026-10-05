// Builds the site into a temporary folder and checks what a first-time visitor
// relies on: working internal links and anchors, install commands that match
// the published packages, social preview tags, plain-language summaries next
// to the metrics, and keyboard and screen reader basics. Run with `npm test`.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRel = `.test-site-${process.pid}`;
const out = join(root, outRel);
const SITE_URL = "https://abelo9996.github.io/open-agent-lab/";
const PAGES = ["index.html", "results/index.html", "methodology/index.html", "regressions/index.html", "launches/index.html", "404.html"];
const html = {};

before(() => {
  execFileSync(process.execPath, [join(root, "scripts", "build.mjs"), "--out", outRel], { cwd: root, stdio: "pipe" });
  for (const p of PAGES) html[p] = readFileSync(join(out, p), "utf8");
});
after(() => rmSync(out, { recursive: true, force: true }));

const ids = (s) => new Set([...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

test("every internal link and anchor resolves to a built file and element", () => {
  const problems = [];
  for (const p of PAGES) {
    if (p === "404.html") continue; // uses absolute /open-agent-lab/ paths, checked below
    const base = new URL(p, "https://x.test/");
    for (const m of html[p].matchAll(/\s(?:href|src|data-gif)="([^"]+)"/g)) {
      const ref = m[1].replace(/&amp;/g, "&");
      if (/^(https?:|mailto:)/.test(ref)) continue;
      const u = new URL(ref, base);
      let file = decodeURIComponent(u.pathname.slice(1));
      if (file === "" || file.endsWith("/")) file += "index.html";
      const abs = join(out, file);
      if (!existsSync(abs) || statSync(abs).isDirectory()) {
        problems.push(`${p}: ${ref} (no ${file})`);
        continue;
      }
      const hash = u.hash.slice(1);
      if (hash && file.endsWith(".html") && !ids(readFileSync(abs, "utf8")).has(decodeURIComponent(hash))) {
        problems.push(`${p}: ${ref} (no #${hash})`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("the 404 page links back with absolute paths", () => {
  assert.match(html["404.html"], /href="\/open-agent-lab\/"/);
  assert.match(html["404.html"], /href="\/open-agent-lab\/assets\/style\.css"/);
});

test("tool install commands match the published packages", () => {
  const cmds = [...html["index.html"].matchAll(/<div class="cmd"><pre><code>([^<]+)<\/code>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  assert.deepEqual(cmds, [
    "npx nerf-watch check",
    "uvx rerun-bench run --agent mock",
    "npx @abelo9996/snap-back wrap -- codex",
    "npm install -g @abelo9996/agent-fence",
    "git clone https://github.com/Abelo9996/launch-day-kit",
  ]);
  for (const p of PAGES) {
    assert.doesNotMatch(html[p], /git\+https:\/\/github\.com\/Abelo9996\/rerun-bench/, `${p} still installs rerun-bench from git`);
    // Unscoped snap-back and agent-fence are not published on npm.
    assert.doesNotMatch(html[p], /npm install -g (snap-back|agent-fence)\b|npx (snap-back|agent-fence)\b/, `${p} uses an unpublished package name`);
  }
  assert.match(html["methodology/index.html"], /uv tool install rerun-bench\n/);
});

test("packaged tools show their Homebrew tap install line", () => {
  const brews = [...html["index.html"].matchAll(/<p class="cmd-brew small">Homebrew \(macOS and Linux\): <code>([^<]+)<\/code><\/p>/g)].map((m) => m[1]);
  assert.deepEqual(brews, [
    "brew install abelo9996/tap/nerf-watch",
    "brew install abelo9996/tap/rerun-bench",
    "brew install abelo9996/tap/snap-back",
    "brew install abelo9996/tap/agent-fence",
  ]);
});

test("every tool section names a next step after its first command", () => {
  const thens = html["index.html"].match(/<p class="cmd-then small">/g) || [];
  assert.equal(thens.length, 5);
});

test("every page has Open Graph and Twitter tags with absolute URLs", () => {
  for (const p of PAGES) {
    for (const name of ["og:title", "og:description", "og:url", "og:image", "twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
      const m = html[p].match(new RegExp(`(?:property|name)="${name}" content="([^"]*)"`));
      assert.ok(m && m[1], `${p} is missing ${name}`);
      if (/url|image/.test(name)) assert.ok(m[1].startsWith(SITE_URL), `${p} ${name} is not absolute: ${m[1]}`);
    }
  }
  assert.ok(existsSync(join(out, "assets", "social-preview.png")));
});

test("headline numbers come with a plain-language reading", () => {
  for (const p of ["index.html", "results/index.html"]) {
    assert.match(html[p], /<strong>In plain words:<\/strong> Claude Code passed 30 of 30 runs and Codex CLI passed 28 of 30 runs: 10 tasks, each run 3 times/);
    assert.match(html[p], /This is a pilot/);
  }
  const home = html["index.html"];
  assert.match(home, /<dl class="key">/);
  for (const term of ["pass rate [low, high]", "pass^3", "flip rate", "median tokens"]) assert.ok(home.includes(`<dt>${term}</dt>`), term);
  // The hero interval reads as a range, not as a second pass rate.
  assert.match(home, /95% interval: 89% to 100%/);
  assert.doesNotMatch(home, /class="hg-ci">95% \[/);
});

test("every page ends with something to do", () => {
  assert.match(html["results/index.html"], /id="next"/);
  assert.match(html["launches/index.html"], /id="l-follow"/);
  assert.match(html["regressions/index.html"], /Report a suspected regression/);
  assert.match(html["methodology/index.html"], /id="m-repro"/);
});

test("each chart and pass/fail grid is a single tab stop", () => {
  const r = html["results/index.html"];
  const groups = r.split(/(?=<div class="cbody" role="list" data-rove>|<table class="grid-table" data-rove>)/).slice(1);
  assert.ok(groups.length >= 5, `expected charts and a grid, found ${groups.length}`);
  for (const g of groups) {
    const end = g.indexOf(g.startsWith("<table") ? "</table>" : '<div class="crow crow-axis"');
    const body = g.slice(0, end);
    assert.equal((body.match(/tabindex="0"/g) || []).length, 1, body.slice(0, 80));
    assert.ok((body.match(/tabindex="-1"/g) || []).length >= 1);
  }
});

test("no aria-label on elements without a role, and every image has alt text", () => {
  for (const p of PAGES) {
    assert.doesNotMatch(html[p], /<span(?![^>]*\brole=)[^>]*\saria-label=/, `${p} has aria-label on a plain span`);
    for (const m of html[p].matchAll(/<img\b[^>]*>/g)) assert.match(m[0], /\salt="[^"]+"/, `${p}: ${m[0]}`);
  }
});

test("built pages contain no long dashes", () => {
  for (const p of PAGES) assert.doesNotMatch(html[p], /[–—]/, p);
});
