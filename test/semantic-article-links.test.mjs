import test from "node:test";
import assert from "node:assert/strict";
import policy from "../config/editorial-policy.json" with { type: "json" };
import {
  extractBodyLinks,
  normalizeYottiArticleUrl,
  validateSemanticArticleLinks,
} from "../scripts/check-semantic-article-links.mjs";

const gate = policy.quality.semanticInternalLinkGates;

function article(body, language = "ru") {
  return { language, body };
}

function queueItem({ semanticLinkClass = "focused-technical", contentFormat = "connectivity-and-esim", locale = "ru", links = [] } = {}) {
  return {
    id: "current",
    semanticLinkClass,
    contentFormat,
    publicUrls: { [locale]: locale === "ru" ? "https://yotti.net/blog/current" : "https://yotti.net/en/blog/current" },
    internalArticleLinks: { [locale]: links },
  };
}

test("extractBodyLinks читает Markdown, raw HTML и bare URL, но не code/image", () => {
  const links = extractBodyLinks(`[Первый материал](https://yotti.net/blog/one)
<a href="https://yotti.net/blog/two"><strong>Второй материал</strong></a>
\`[код](https://yotti.net/blog/code)\`
![alt](https://yotti.net/blog/image)
https://yotti.net/blog/bare`);
  assert.deepEqual(links, [
    { href: "https://yotti.net/blog/one", anchor: "Первый материал" },
    { href: "https://yotti.net/blog/two", anchor: "Второй материал" },
    { href: "https://yotti.net/blog/bare", anchor: "https://yotti.net/blog/bare" },
  ]);
});

test("normalizeYottiArticleUrl различает locale и исключает site/product/tag", () => {
  assert.equal(normalizeYottiArticleUrl("https://www.yotti.net/blog/one/", "ru", gate), "https://yotti.net/blog/one");
  assert.equal(normalizeYottiArticleUrl("https://yotti.net/esim/turkey", "ru", gate), null);
  assert.equal(normalizeYottiArticleUrl("https://yotti.net/blog/tag/news", "ru", gate), null);
  assert.throws(() => normalizeYottiArticleUrl("https://yotti.net/en/blog/one", "ru", gate), /другой locale/);
  assert.throws(() => normalizeYottiArticleUrl("/blog/one", "ru", gate), /абсолютным HTTPS/);
  assert.throws(() => normalizeYottiArticleUrl("https://user@yotti.net/blog/one", "ru", gate), /credentials/);
});

test("query, fragment и encoded reserved delimiters fail closed", () => {
  for (const url of [
    "https://yotti.net/blog/one?from=body",
    "https://yotti.net/blog/one#part",
    "https://yotti.net/blog/one%23part",
    "https://yotti.net/blog/one%3Fpart",
  ]) {
    assert.throws(() => normalizeYottiArticleUrl(url, "ru", gate), /query|fragment|небезопасный URL/);
  }
});

test("bare internal URL участвует в exact-set и блокируется как URL-anchor", () => {
  const links = ["https://yotti.net/blog/one", "https://yotti.net/blog/two"];
  const bare = "https://yotti.net/blog/untracked";
  const result = validateSemanticArticleLinks({
    article: article(`[Проверка APN](${links[0]})\n\n[Диагностика сети](${links[1]})\n\n${bare}`),
    queueItem: queueItem({ links }),
    gate,
  });
  assert.ok(result.summary.bodyUrls.includes(bare));
  assert.match(result.errors.join("\n"), /содержательный anchor/);
  assert.match(result.errors.join("\n"), /body-ссылка отсутствует в metadata/);
});

test("body, metadata и public security URLs одинаково отклоняют query/fragment", () => {
  const result = validateSemanticArticleLinks({
    article: article("[Один](https://yotti.net/blog/one?body=1)\n\n[Два](https://yotti.net/blog/two)"),
    queueItem: {
      ...queueItem({ links: ["https://yotti.net/blog/one#metadata", "https://yotti.net/blog/two"] }),
      publicUrls: { ru: "https://yotti.net/blog/current?public=1" },
    },
    gate,
  });
  assert.match(result.errors.join("\n"), /publicUrls\.ru:.*query или fragment/);
  assert.match(result.errors.join("\n"), /internalArticleLinks\.ru:.*query или fragment/);
  assert.match(result.errors.join("\n"), /ссылка не должна содержать query или fragment/);
});

test("focused-technical: две точные ссылки проходят с advisory WARN", () => {
  const links = ["https://yotti.net/blog/one", "https://yotti.net/blog/two"];
  const result = validateSemanticArticleLinks({
    article: article(`[Проверка APN](${links[0]}) и [диагностика сети](${links[1]}).`),
    queueItem: queueItem({ links }),
    gate,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.summary.uniqueCount, 2);
});

test("standard требует три ссылки, а 3–5 остаётся чистой целью", () => {
  const two = ["https://yotti.net/blog/one", "https://yotti.net/blog/two"];
  const failed = validateSemanticArticleLinks({
    article: article(`[Маршрут один](${two[0]}) [маршрут два](${two[1]})`),
    queueItem: queueItem({ semanticLinkClass: "standard", contentFormat: "destination-inspiration", links: two }),
    gate,
  });
  assert.match(failed.errors.join("\n"), /минимум 3/);

  const three = [...two, "https://yotti.net/blog/three"];
  const passed = validateSemanticArticleLinks({
    article: article(three.map((url, index) => `[Связанный маршрут ${index + 1}](${url})`).join(" ")),
    queueItem: queueItem({ semanticLinkClass: "standard", contentFormat: "destination-inspiration", links: three }),
    gate,
  });
  assert.deepEqual(passed.errors, []);
  assert.deepEqual(passed.warnings, []);
});

test("шесть релевантных ссылок не блокируют статью", () => {
  const links = Array.from({ length: 6 }, (_, index) => `https://yotti.net/blog/guide-${index + 1}`);
  const result = validateSemanticArticleLinks({
    article: article(links.map((url, index) => `[Полезный материал ${index + 1}](${url})`).join(" ")),
    queueItem: queueItem({ semanticLinkClass: "standard", contentFormat: "destination-inspiration", links }),
    gate,
  });
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join("\n"), /не hard defect/);
});

test("metadata/body drift, generic anchor и wrong locale блокируются", () => {
  const result = validateSemanticArticleLinks({
    article: article(`[здесь](https://yotti.net/blog/one) [English](https://yotti.net/en/blog/two)`),
    queueItem: queueItem({ links: ["https://yotti.net/blog/one", "https://yotti.net/blog/metadata-only"] }),
    gate,
  });
  assert.match(result.errors.join("\n"), /содержательный anchor/);
  assert.match(result.errors.join("\n"), /другой locale/);
  assert.match(result.errors.join("\n"), /metadata-ссылка отсутствует в body/);
});

test("self блокируется и не считается, duplicate не двоится, product не считается", () => {
  const links = ["https://yotti.net/blog/one", "https://yotti.net/blog/two"];
  const result = validateSemanticArticleLinks({
    article: article(`[Один](${links[0]}) [тот же материал](${links[0]}) [Два](${links[1]}) [self](https://yotti.net/blog/current) [product](https://yotti.net/esim/turkey)`),
    queueItem: queueItem({ links }),
    gate,
  });
  assert.match(result.errors.join("\n"), /body содержит self-link/);
  assert.equal(result.summary.uniqueCount, 2);
});

test("semanticLinkClass обязателен и focused class ограничен technical format", () => {
  const missing = validateSemanticArticleLinks({ article: article("text"), queueItem: queueItem({ semanticLinkClass: null }), gate });
  assert.match(missing.errors.join("\n"), /semanticLinkClass/);
  const wrongFormat = validateSemanticArticleLinks({
    article: article("text"),
    queueItem: queueItem({ contentFormat: "destination-inspiration" }),
    gate,
  });
  assert.match(wrongFormat.errors.join("\n"), /focused-technical запрещён/);
});
