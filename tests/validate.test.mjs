// Checks that the validator accepts the committed data and rejects broken
// result files. Run with `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAll, validateResult } from "../scripts/lib/data.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pilot = join(root, "data", "results", "2026-10-03-pilot.json");

function withResult(mutate, name = "2026-10-03-test.json") {
  const dir = mkdtempSync(join(tmpdir(), "oal-"));
  const doc = JSON.parse(readFileSync(pilot, "utf8"));
  mutate(doc);
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify(doc));
  return validateResult(p);
}

test("committed data validates", () => {
  const { errors } = loadAll(root);
  assert.deepEqual(errors, []);
});

test("an unmodified rerun-bench report without lab metadata validates", () => {
  const r = withResult((d) => delete d.lab, "2026-10-03-plain.json");
  assert.deepEqual(r.errors, []);
  assert.equal(r.result.label, "plain");
});

test("bad file name is rejected", () => {
  const r = withResult(() => {}, "pilot.json");
  assert.ok(r.errors.some((e) => e.includes("file name")));
});

test("pass rate outside its interval is rejected", () => {
  const r = withResult((d) => {
    d.entries[0].metrics.pass_rate_ci95 = [0.1, 0.2];
  });
  assert.ok(r.errors.some((e) => e.includes("does not contain pass_rate")));
});

test("outcomes that disagree with passes are rejected", () => {
  const r = withResult((d) => {
    d.entries[1].metrics.per_task["edit-config"].outcomes = [true, false, true];
  });
  assert.ok(r.errors.some((e) => e.includes("number of true entries")));
});

test("lab.date must match the file name", () => {
  const r = withResult((d) => {
    d.lab.date = "2026-10-04";
  });
  assert.ok(r.errors.some((e) => e.includes("lab.date")));
});

test("regression reports with unknown agents are rejected", () => {
  const dir = mkdtempSync(join(tmpdir(), "oal-"));
  cpSync(join(root, "data"), join(dir, "data"), { recursive: true });
  writeFileSync(
    join(dir, "data", "regressions.json"),
    JSON.stringify({
      reports: [
        {
          id: "x-1",
          reported_at: "2026-10-03",
          agent: "nope",
          model: null,
          cli_before: null,
          cli_after: null,
          signal: "tokens",
          summary: "s",
          independent_reports: 1,
          status: "open",
          issue_url: "https://example.org/1",
        },
      ],
    }),
  );
  const { errors } = loadAll(dir);
  assert.ok(errors.some((e) => e.includes('"nope" is not in data/agents.json')));
});
