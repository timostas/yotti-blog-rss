import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArticle } from "../scripts/build-feed.mjs";
import { checkRepositoryVisuals, validateArticleVisuals } from "../scripts/check-article-visuals.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_URL = "https://timostas.github.io/yotti-blog-rss";
const policy = JSON.parse(await readFile(join(ROOT, "config", "editorial-policy.json"), "utf8"));
const gate = policy.quality.longFormVisualGates;
const sourcePath = "articles/new-zealand-south-island-slow-road-ru.md";
const source = await readFile(join(ROOT, sourcePath), "utf8");
const baseline = parseArticle(source, sourcePath, SITE_URL);

function futureReadyArticle() {
  return {
    ...baseline,
    publishedAt: new Date(gate.effectiveFrom),
    body: baseline.body
      .replace(/(<img src="[^"]*new-zealand-route-plan-ru-v5\.webp")/, '$1 loading="lazy"')
      .replace(/(<img src="[^"]*new-zealand-booking-plan-ru-v5\.webp")/, '$1 loading="lazy"')
      .replace(/<img\b(?![^>]*\bdecoding=)/g, '<img decoding="async"'),
  };
}

test("универсальный визуальный шлюз проверяет обе эталонные локали", async () => {
  const report = await checkRepositoryVisuals({ rootDir: ROOT });
  assert.deepEqual(report.errors, []);
  assert.equal(report.checked.length, 2);
  assert.ok(report.checked.every((item) => item.totalImages === 7));
  assert.ok(report.checked.every((item) => item.totalBytes < gate.maximumTotalImageBytesIncludingCover));
});

test("будущая статья проходит только с семью WebP и ленивой загрузкой внутренних материалов", async () => {
  const result = await validateArticleVisuals({
    article: futureReadyArticle(),
    contentFormat: "route-or-itinerary",
    gate,
    rootDir: ROOT,
    siteUrl: SITE_URL,
    strict: true,
    sourceName: "future-route-ru.md",
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.summary.totalImages, 7);
  assert.equal(result.summary.eagerInlineImages, 1);
});

test("будущая статья блокируется при нехватке изображения", async () => {
  const article = futureReadyArticle();
  article.body = article.body.replace(/<figure class="yotti-photo">[\s\S]*?<\/figure>/, "");
  const result = await validateArticleVisuals({
    article,
    contentFormat: "route-or-itinerary",
    gate,
    rootDir: ROOT,
    siteUrl: SITE_URL,
    strict: true,
    sourceName: "future-route-ru.md",
  });
  assert.match(result.errors.join("\n"), /ровно 6 встроенных изображений.*ровно 7 изображений.*contextualPhotos=2/s);
});

test("будущая статья блокируется с PNG-обложкой и лишней eager-загрузкой", async () => {
  const article = futureReadyArticle();
  article.cover = { ...article.cover, type: "image/png", url: article.cover.url.replace(/\.webp$/, ".png") };
  article.body = article.body.replace(/ loading="lazy"/g, "");
  const result = await validateArticleVisuals({
    article,
    contentFormat: "route-or-itinerary",
    gate,
    rootDir: ROOT,
    siteUrl: SITE_URL,
    strict: true,
    sourceName: "future-route-ru.md",
  });
  assert.match(result.errors.join("\n"), /loading="lazy".*локальным image\/webp/s);
});

test("будущая статья блокируется без асинхронного декодирования", async () => {
  const article = futureReadyArticle();
  article.body = article.body.replace(' decoding="async"', "");
  const result = await validateArticleVisuals({
    article,
    contentFormat: "route-or-itinerary",
    gate,
    rootDir: ROOT,
    siteUrl: SITE_URL,
    strict: true,
    sourceName: "future-route-ru.md",
  });
  assert.match(result.errors.join("\n"), /требуется decoding="async"/);
});
