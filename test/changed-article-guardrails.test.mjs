import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyChangedPaths,
  diffQueueSecurityFields,
  parseCliArgs,
  parseNameStatusZ,
  runChangedArticleGuardrails,
} from "../scripts/check-changed-article-guardrails.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(rootDir, args) {
  return execFileSync("git", args, { cwd: rootDir, encoding: "utf8" }).trim();
}

async function queueDowngradeFixture({ beforeStatus, afterStatus }) {
  const rootDir = await mkdtemp(join(tmpdir(), "yotti-queue-downgrade-"));
  await Promise.all([
    mkdir(join(rootDir, "articles"), { recursive: true }),
    mkdir(join(rootDir, "config"), { recursive: true }),
    mkdir(join(rootDir, "content"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(rootDir, "feed.config.json"), await readFile(join(ROOT, "feed.config.json"))),
    writeFile(join(rootDir, "config", "editorial-policy.json"), await readFile(join(ROOT, "config", "editorial-policy.json"))),
  ]);

  const urls = [
    "https://yotti.net/blog/status-guardrail-one",
    "https://yotti.net/blog/status-guardrail-two",
    "https://yotti.net/blog/status-guardrail-three",
  ];
  const filler = Array.from({ length: 155 }, (_, index) => `слово${index + 1}`).join(" ");
  await writeFile(join(rootDir, "articles", "status-guardrail-ru.md"), `---
title: "Проверка смены статуса"
slug: "status-guardrail-ru"
description: "Тестовая статья для сквозной проверки security delta очереди."
publishedAt: "2026-01-01T09:00:00Z"
author: "Редакция Yotti"
reviewer: "Редактор Yotti"
reviewedAt: "2026-09-01"
reviewAfter: "2026-12-01"
language: "ru"
categories: []
sources:
  - "https://example.com/source-one"
  - "https://example.com/source-two"
published: true
---

${filler}

[Проверка первой связанной статьи](${urls[0]}), [проверка второй связанной статьи](${urls[1]}) и [проверка третьей связанной статьи](${urls[2]}).
`);

  const queue = (status, internalArticleLinks = urls) => ({
    schemaVersion: 1,
    items: [{
      id: "status-guardrail",
      status,
      locales: ["ru"],
      contentFormat: "non-visual-regression-fixture",
      semanticLinkClass: "standard",
      publicUrls: { ru: "https://yotti.net/blog/status-guardrail" },
      internalArticleLinks: { ru: internalArticleLinks },
    }],
  });
  await writeFile(join(rootDir, "content", "queue.json"), `${JSON.stringify(queue(beforeStatus), null, 2)}\n`);

  git(rootDir, ["init", "-q"]);
  git(rootDir, ["config", "user.name", "Guardrail Test"]);
  git(rootDir, ["config", "user.email", "guardrail@example.invalid"]);
  git(rootDir, ["add", "."]);
  git(rootDir, ["commit", "-qm", "base"]);
  const base = git(rootDir, ["rev-parse", "HEAD"]);

  await writeFile(join(rootDir, "content", "queue.json"), `${JSON.stringify(queue(afterStatus, urls.slice(0, 2)), null, 2)}\n`);
  git(rootDir, ["add", "content/queue.json"]);
  git(rootDir, ["commit", "-qm", "downgrade queue status and weaken security metadata"]);
  return { rootDir, base };
}

test("CLI требует ровно один безопасный scope", () => {
  assert.deepEqual(parseCliArgs(["--base", "abc123"]), { mode: "base", base: "abc123" });
  assert.deepEqual(parseCliArgs(["--files", "articles/a-ru.md", "assets/a.webp"]), { mode: "files", files: ["articles/a-ru.md", "assets/a.webp"] });
  for (const args of [[], ["--base"], ["--base", "-h"], ["--base", "bad ref"], ["--base", "a", "--files", "articles/a.md"], ["--files"], ["--what"], ["--files", "../a.md"], ["--files", "/tmp/a.md"], ["--files", "content/queue.json"]]) {
    assert.throws(() => parseCliArgs(args));
  }
});

test("NUL-safe parser сохраняет old/new rename и copy paths", () => {
  const entries = parseNameStatusZ(Buffer.from("M\0articles/a ru.md\0R100\0assets/old.webp\0assets/new.webp\0C75\0assets/source.webp\0assets/copy.webp\0", "utf8"));
  assert.deepEqual(entries, [
    { status: "M", path: "articles/a ru.md" },
    { status: "R100", oldPath: "assets/old.webp", path: "assets/new.webp" },
    { status: "C75", oldPath: "assets/source.webp", path: "assets/copy.webp" },
  ]);
});

test("classification включает old/new assets и блокирует article removal", () => {
  const result = classifyChangedPaths([
    { status: "M", path: "articles/a-ru.md" },
    { status: "D", path: "articles/b-en.md" },
    { status: "R100", oldPath: "articles/old-ru.md", path: "articles/new-ru.md" },
    { status: "R100", oldPath: "assets/old.webp", path: "assets/new.webp" },
    { status: "M", path: "content/queue.json" },
  ]);
  assert.deepEqual(result.forceArticleFiles, ["articles/a-ru.md", "articles/new-ru.md"]);
  assert.deepEqual(result.removedArticleFiles, ["articles/b-en.md", "articles/old-ru.md"]);
  assert.deepEqual(result.changedAssetFiles, ["assets/new.webp", "assets/old.webp"]);
  assert.equal(result.queueChanged, true);
});

test("queue security delta scopes only changed locale; planning fields do not", () => {
  const base = {
    items: [{
      id: "a",
      locales: ["ru", "en"],
      contentFormat: "connectivity-and-esim",
      semanticLinkClass: "focused-technical",
      publicUrls: { ru: "https://yotti.net/blog/a", en: "https://yotti.net/en/blog/a" },
      internalArticleLinks: { ru: ["https://yotti.net/blog/one"], en: ["https://yotti.net/en/blog/one"] },
      scores: { utility: 80 },
    }],
    plannedPublications: ["a"],
  };
  const planningOnly = structuredClone(base);
  planningOnly.plannedPublications = [];
  planningOnly.items[0].scores.utility = 95;
  assert.deepEqual(diffQueueSecurityFields(base, planningOnly), []);

  const localeChange = structuredClone(base);
  localeChange.items[0].internalArticleLinks.ru.push("https://yotti.net/blog/two");
  assert.deepEqual(diffQueueSecurityFields(base, localeChange).map(({ id, locales }) => ({ id, locales })), [{ id: "a", locales: ["ru"] }]);

  const classChange = structuredClone(base);
  classChange.items[0].semanticLinkClass = "standard";
  assert.deepEqual(diffQueueSecurityFields(base, classChange).map(({ id, locales }) => ({ id, locales })), [{ id: "a", locales: ["en", "ru"] }]);

  const statusDowngrade = structuredClone(base);
  statusDowngrade.items[0].status = "rejected";
  assert.deepEqual(diffQueueSecurityFields(base, statusDowngrade), []);
});

test("queue status downgrade cannot bypass end-to-end article guardrails", async (t) => {
  for (const scenario of [
    { name: "published to rejected uses before status", beforeStatus: "published", afterStatus: "rejected" },
    { name: "paused to rejected uses published front matter", beforeStatus: "paused", afterStatus: "rejected" },
  ]) {
    await t.test(scenario.name, async () => {
      const { rootDir, base } = await queueDowngradeFixture(scenario);
      try {
        const report = await runChangedArticleGuardrails({ rootDir, cli: { mode: "base", base } });
        assert.equal(report.exitCode, 1);
        assert.ok(report.checked.some(({ sourceName }) => sourceName === "articles/status-guardrail-ru.md"));
        assert.match(report.errors.join("\n"), /body-ссылка отсутствует в metadata|требуется минимум 3 смысловых ссылок/u);
      } finally {
        await rm(rootDir, { recursive: true, force: true });
      }
    });
  }
});
