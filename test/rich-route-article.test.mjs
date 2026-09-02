import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArticle, renderArticleBody } from "../scripts/build-feed.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ARTICLE_FILES = [
  "articles/new-zealand-south-island-slow-road-ru.md",
  "articles/new-zealand-south-island-slow-road-en.md",
];
const PHOTO_ASSETS = [
  "assets/inline/new-zealand-christchurch-avon-v2.webp",
  "assets/inline/new-zealand-lake-pukaki-v2.webp",
  "assets/inline/new-zealand-queenstown-waterfront-v2.webp",
];
const MAP_ASSETS = [
  ["assets/inline/new-zealand-route-map-ru-v4.webp", "assets/inline/new-zealand-route-map-ru-static-v4.webp"],
  ["assets/inline/new-zealand-route-map-en-v4.webp", "assets/inline/new-zealand-route-map-en-static-v4.webp"],
];
const INFORMATION_GRAPHICS = [
  "assets/inline/new-zealand-route-plan-ru-v4.webp",
  "assets/inline/new-zealand-route-plan-en-v4.webp",
  "assets/inline/new-zealand-booking-plan-ru-v4.webp",
  "assets/inline/new-zealand-booking-plan-en-v4.webp",
];

for (const relativePath of ARTICLE_FILES) {
  test(`${relativePath}: использует RSS-устойчивый визуальный ритм`, async () => {
    const source = await readFile(join(ROOT, relativePath), "utf8");
    const article = parseArticle(source, relativePath, "https://timostas.github.io/yotti-blog-rss");
    const html = renderArticleBody(article);

    assert.ok(article.wordCount >= 1800 && article.wordCount <= 3000, `wordCount=${article.wordCount}`);
    assert.equal((html.match(/class="yotti-photo"/g) || []).length, 3);
    assert.equal((html.match(/class="yotti-information-graphic"/g) || []).length, 2);
    assert.match(html, /class="yotti-route-map"/);
    assert.match(html, /<picture>/);
    assert.match(html, /<source media="\(prefers-reduced-motion: reduce\)"/);
    assert.match(html, /new-zealand-route-map-(?:ru|en)-v4\.webp/);
    assert.match(html, /new-zealand-route-plan-(?:ru|en)-v4\.webp/);
    assert.match(html, /new-zealand-booking-plan-(?:ru|en)-v4\.webp/);
    assert.doesNotMatch(html, /<(?:style|svg|table|details|div|section|aside)\b/i);
    assert.doesNotMatch(source, /<\/(?:strong|em|a|span|p|li|h[1-6]|figcaption)>[\p{L}\p{N}]/u);
    assert.doesNotMatch(source, /(?:днейот|базыбез|переездамежду|резервдля|daysfrom|baseswith|drivesbetween|bufferfor)/i);
    assert.doesNotMatch(source, /(?:день назначает погода|финал без списка достижений|одной длинной дорогой|зачем оставить время за|human scale|achievement list)/i);
  });
}

test("контекстные фотографии оптимизированы для RSS", async () => {
  for (const relativePath of PHOTO_ASSETS) {
    const file = await stat(join(ROOT, relativePath));
    assert.ok(file.size < 450 * 1024, `${relativePath}: ${file.size} bytes`);
  }
});

test("карта передаётся как конечный анимированный WebP со статичным резервом", async () => {
  for (const [animatedPath, staticPath] of MAP_ASSETS) {
    const animated = await readFile(join(ROOT, animatedPath));
    const still = await readFile(join(ROOT, staticPath));
    const animChunk = animated.indexOf(Buffer.from("ANIM"));

    assert.ok(animChunk >= 0, `${animatedPath}: отсутствует ANIM chunk`);
    assert.ok(animated.readUInt16LE(animChunk + 12) > 0, `${animatedPath}: бесконечный цикл запрещён`);
    assert.equal(still.indexOf(Buffer.from("ANIM")), -1, `${staticPath}: резерв должен быть статичным`);
    assert.ok(animated.length < 300 * 1024, `${animatedPath}: ${animated.length} bytes`);
    assert.ok(still.length < 100 * 1024, `${staticPath}: ${still.length} bytes`);
  }
});

test("вертикальные инфографики оптимизированы для мобильной статьи", async () => {
  for (const relativePath of INFORMATION_GRAPHICS) {
    const file = await stat(join(ROOT, relativePath));
    const bytes = await readFile(join(ROOT, relativePath));
    assert.ok(file.size < 200 * 1024, `${relativePath}: ${file.size} bytes`);
    assert.equal(bytes.indexOf(Buffer.from("ANIM")), -1, `${relativePath}: инфографика должна быть статичной`);
  }
});
