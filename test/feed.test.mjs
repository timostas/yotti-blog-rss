import test from "node:test";
import assert from "node:assert/strict";
import { createFeedXml, countWords, parseArticle, validateArticleCategories } from "../scripts/build-feed.mjs";
import taxonomy from "../config/editorial-taxonomy.json" with { type: "json" };

const config = {
  title: "Блог Yotti",
  description: "Тестовый RSS",
  language: "ru",
  siteUrl: "https://timostas.github.io/yotti-blog-rss",
  feedPath: "ru/rss.xml",
};
const AFTER_PUBLISH = new Date("2026-08-03T00:00:00Z");

function articleSource(overrides = "") {
  const words = Array.from({ length: 150 }, (_, index) => `слово${index + 1}`).join(" ");
  return `---
title: "Тест & проверка"
slug: "test-post"
description: "Краткое <описание>"
publishedAt: "2026-08-02T18:00:00+03:00"
author: "Редакция Yotti"
reviewer: "Проверяющий редактор"
reviewedAt: "2026-08-01"
reviewAfter: "2026-09-01"
language: "ru"
categories:
  - "TR"
sources:
  - "https://example.gov/source-one"
  - "https://example.gov/source-two"
published: true
${overrides}---
${words}
`;
}

test("считает русские слова", () => {
  assert.equal(countWords("Один, два и travel-tech."), 4);
});

test("принимает только каноническую тематическую рубрику", () => {
  const article = parseArticle(articleSource());
  article.categories = ["Еда и культура", "GE"];
  assert.doesNotThrow(() => validateArticleCategories(article, taxonomy, "georgia-food-route-2026-ru.md"));

  article.categories = ["Еда и местная культура", "GE"];
  assert.throws(() => validateArticleCategories(article, taxonomy, "georgia-food-route-2026-ru.md"), /неизвестная рубрика/);
});

test("создаёт Tilda-совместимый RSS с постоянной ссылкой", () => {
  const article = parseArticle(articleSource(`cover:
  url: "https://timostas.github.io/yotti-blog-rss/assets/covers/test-post.jpg"
  type: "image/jpeg"
  alt: "Тестовая обложка"
`));
  const xml = createFeedXml(config, [article], AFTER_PUBLISH);

  assert.match(xml, /<rss version="2\.0"/);
  assert.match(xml, /<item turbo="true">/);
  assert.match(xml, /<title>Тест &amp; проверка<\/title>/);
  assert.match(xml, /<link>https:\/\/timostas\.github\.io\/yotti-blog-rss\/ru\/articles\/test-post\.html<\/link>/);
  assert.match(xml, /<category>TR<\/category>/);
  assert.match(xml, /<enclosure url="https:\/\/timostas\.github\.io\/yotti-blog-rss\/assets\/covers\/test-post\.jpg" type="image\/jpeg"\/>/);
  assert.match(xml, /<figure><img alt="Тестовая обложка" src="https:\/\/timostas\.github\.io\/yotti-blog-rss\/assets\/covers\/test-post\.jpg"\/><\/figure>/);
  assert.match(xml, /<description>Краткое &lt;описание&gt;<\/description>/);
  assert.match(xml, /<turbo:content><!\[CDATA\[/);
});

test("не смешивает русские статьи с английской лентой", () => {
  const article = parseArticle(articleSource());
  const englishXml = createFeedXml({
    ...config,
    title: "Yotti Blog",
    description: "English feed",
    language: "en",
    feedPath: "en/rss.xml",
  }, [article], AFTER_PUBLISH);

  assert.doesNotMatch(englishXml, /<item/);
  assert.match(englishXml, /<language>en<\/language>/);
});

test("не публикует текст короче 150 слов", () => {
  const shortSource = articleSource().replace(/слово\d+(?:\s+|\n)/g, "").replace(/---\n$/, "---\nкороткий текст\n");
  assert.throws(() => parseArticle(shortSource), /требуется не меньше 150/);
});

test("не публикует статью раньше publishedAt", () => {
  const article = parseArticle(articleSource());
  const before = createFeedXml(config, [article], new Date("2026-08-02T14:59:59Z"));
  const after = createFeedXml(config, [article], new Date("2026-08-02T15:00:00Z"));

  assert.doesNotMatch(before, /<item/);
  assert.match(after, /<item turbo="true">/);
});

test("не публикует статью без проверяющего редактора", () => {
  const source = articleSource().replace('reviewer: "Проверяющий редактор"\n', "");
  assert.throws(() => parseArticle(source), /поле reviewer обязательно/);
});

test("не публикует статью без двух источников", () => {
  const source = articleSource().replace('  - "https://example.gov/source-two"\n', "");
  assert.throws(() => parseArticle(source), /требуется минимум два источника/);
});

test("не принимает устаревшую дату перепроверки", () => {
  const source = articleSource().replace('reviewAfter: "2026-09-01"', 'reviewAfter: "2026-07-31"');
  assert.throws(() => parseArticle(source), /reviewAfter должен быть позже reviewedAt/);
});
