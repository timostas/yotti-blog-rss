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
  "assets/inline/new-zealand-christchurch-avon-v5.webp",
  "assets/inline/new-zealand-lake-pukaki-v5.webp",
  "assets/inline/new-zealand-queenstown-waterfront-v5.webp",
];
const MAP_ASSETS = [
  ["assets/inline/new-zealand-road-map-ru-animated-v6.webp", "assets/inline/new-zealand-road-map-ru-static-v5.webp"],
  ["assets/inline/new-zealand-road-map-en-animated-v6.webp", "assets/inline/new-zealand-road-map-en-static-v5.webp"],
];
const INFORMATION_GRAPHICS = [
  "assets/inline/new-zealand-route-plan-ru-v5.webp",
  "assets/inline/new-zealand-route-plan-en-v5.webp",
  "assets/inline/new-zealand-booking-plan-ru-v5.webp",
  "assets/inline/new-zealand-booking-plan-en-v5.webp",
];
const INTERACTIVE_MAPS = [
  "assets/interactive/new-zealand-south-island-map-ru-v5.html",
  "assets/interactive/new-zealand-south-island-map-en-v5.html",
];
const COVER_ASSET = "assets/covers/new-zealand-south-island-slow-road-v5.webp";

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
    assert.match(html, /new-zealand-road-map-(?:ru|en)-animated-v6\.webp/);
    assert.match(html, /new-zealand-road-map-(?:ru|en)-static-v5\.webp/);
    assert.match(html, /new-zealand-route-plan-(?:ru|en)-v5\.webp/);
    assert.match(html, /new-zealand-booking-plan-(?:ru|en)-v5\.webp/);
    assert.equal((html.match(/https:\/\/www\.yotti\.net\/(?:en\/)?blog\/new-zealand\/[^\"]+#:~:text=/g) || []).length, 5);
    assert.doesNotMatch(html, /timostas\.github\.io\/yotti-blog-rss\/assets\/interactive/);
    assert.match(html, /width="1200" height="900"/);
    assert.match(html, /width="1440" height="870"/);
    assert.match(html, /width="1440" height="760"/);
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

test("карта передаётся как компактный дорожный WebP с бесконечным повтором", async () => {
  for (const [animatedPath, staticPath] of MAP_ASSETS) {
    const animated = await readFile(join(ROOT, animatedPath));
    const still = await readFile(join(ROOT, staticPath));
    const animChunk = animated.indexOf(Buffer.from("ANIM"));

    assert.ok(animChunk >= 0, `${animatedPath}: отсутствует ANIM chunk`);
    const loops = animated.readUInt16LE(animChunk + 12);
    assert.equal(loops, 0, `${animatedPath}: loops=${loops}`);
    assert.equal(still.indexOf(Buffer.from("ANIM")), -1, `${staticPath}: резерв должен быть статичным`);
    assert.ok(animated.length < 300 * 1024, `${animatedPath}: ${animated.length} bytes`);
    assert.ok(still.length < 100 * 1024, `${staticPath}: ${still.length} bytes`);
  }
});

test("компактные инфографики оптимизированы для статьи", async () => {
  for (const relativePath of INFORMATION_GRAPHICS) {
    const file = await stat(join(ROOT, relativePath));
    const bytes = await readFile(join(ROOT, relativePath));
    assert.ok(file.size < 200 * 1024, `${relativePath}: ${file.size} bytes`);
    assert.equal(bytes.indexOf(Buffer.from("ANIM")), -1, `${relativePath}: инфографика должна быть статичной`);
  }
});

test("интерактивные карты доступны с клавиатуры и уважают reduced motion", async () => {
  for (const relativePath of INTERACTIVE_MAPS) {
    const html = await readFile(join(ROOT, relativePath), "utf8");
    assert.match(html, /<svg viewBox="0 0 1200 900" role="img"/);
    assert.equal((html.match(/class="stop stop-/g) || []).length, 5);
    assert.equal((html.match(/https:\/\/yotti\.net\//g) || []).length, 5);
    assert.match(html, /prefers-reduced-motion:reduce/);
    assert.match(html, /\.road\{animation:none;stroke-dashoffset:0\}/);
    assert.match(html, /\.\.\/inline\/new-zealand-road-map-(?:ru|en)-base-v5\.webp/);
    assert.doesNotMatch(html, /tabindex=/);
  }
});

test("медиабюджет статьи не превышает 1,2 МБ", async () => {
  const cover = await stat(join(ROOT, COVER_ASSET));
  assert.ok(cover.size < 400 * 1024, `${COVER_ASSET}: ${cover.size} bytes`);
  for (const locale of ["ru", "en"]) {
    const paths = [
      COVER_ASSET,
      `assets/inline/new-zealand-road-map-${locale}-animated-v6.webp`,
      `assets/inline/new-zealand-route-plan-${locale}-v5.webp`,
      `assets/inline/new-zealand-booking-plan-${locale}-v5.webp`,
      ...PHOTO_ASSETS,
    ];
    const sizes = await Promise.all(paths.map(async (relativePath) => (await stat(join(ROOT, relativePath))).size));
    const total = sizes.reduce((sum, size) => sum + size, 0);
    assert.ok(total < 1.2 * 1024 * 1024, `${locale}: ${total} bytes`);
  }
});
