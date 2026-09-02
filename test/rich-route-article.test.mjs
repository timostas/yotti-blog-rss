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
const INLINE_ASSETS = [
  "assets/inline/new-zealand-christchurch-avon-v2.webp",
  "assets/inline/new-zealand-lake-pukaki-v2.webp",
  "assets/inline/new-zealand-queenstown-waterfront-v2.webp",
];

for (const relativePath of ARTICLE_FILES) {
  test(`${relativePath}: содержит полный визуальный ритм маршрута`, async () => {
    const source = await readFile(join(ROOT, relativePath), "utf8");
    const article = parseArticle(source, relativePath, "https://timostas.github.io/yotti-blog-rss");
    const html = renderArticleBody(article);

    assert.ok(article.wordCount >= 1800 && article.wordCount <= 3000, `wordCount=${article.wordCount}`);
    assert.equal((html.match(/class="yotti-photo"/g) || []).length, 3);
    assert.equal((html.match(/<table>/g) || []).length, 2);
    assert.match(html, /class="yotti-route-map"/);
    assert.match(html, /<details class="yotti-toc" open>/);
    assert.match(html, /prefers-reduced-motion: reduce/);
    assert.match(html, /<title id="yotti-nz-map-title-/);
    assert.match(html, /<desc id="yotti-nz-map-desc-/);
  });
}

test("контекстные фотографии оптимизированы для RSS", async () => {
  for (const relativePath of INLINE_ASSETS) {
    const file = await stat(join(ROOT, relativePath));
    assert.ok(file.size < 450 * 1024, `${relativePath}: ${file.size} bytes`);
  }
});
