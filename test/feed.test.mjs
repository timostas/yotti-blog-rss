import test from "node:test";
import assert from "node:assert/strict";
import { createFeedXml, countWords, parseArticle } from "../scripts/build-feed.mjs";

const config = {
  title: "Блог Yotti",
  description: "Тестовый RSS",
  language: "ru",
  siteUrl: "https://timostas.github.io/yotti-blog-rss",
  feedPath: "ru/rss.xml",
};

function articleSource(overrides = "") {
  const words = Array.from({ length: 150 }, (_, index) => `слово${index + 1}`).join(" ");
  return `---
title: "Тест & проверка"
slug: "test-post"
description: "Краткое <описание>"
publishedAt: "2026-08-02T18:00:00+03:00"
author: "Редакция Yotti"
language: "ru"
categories:
  - "TR"
published: true
${overrides}---
${words}
`;
}

test("считает русские слова", () => {
  assert.equal(countWords("Один, два и travel-tech."), 4);
});

test("создаёт Tilda-совместимый RSS с постоянной ссылкой", () => {
  const article = parseArticle(articleSource(`cover:
  url: "https://timostas.github.io/yotti-blog-rss/assets/covers/test-post.jpg"
  type: "image/jpeg"
  alt: "Тестовая обложка"
`));
  const xml = createFeedXml(config, [article]);

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
  }, [article]);

  assert.doesNotMatch(englishXml, /<item/);
  assert.match(englishXml, /<language>en<\/language>/);
});

test("не публикует текст короче 150 слов", () => {
  const shortSource = articleSource().replace(/слово\d+(?:\s+|\n)/g, "").replace(/---\n$/, "---\nкороткий текст\n");
  assert.throws(() => parseArticle(shortSource), /требуется не меньше 150/);
});