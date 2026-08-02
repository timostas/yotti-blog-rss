import { cp, readFile, readdir, rm, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import YAML from "yaml";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARTICLES_DIR = join(ROOT_DIR, "articles");
const ASSETS_DIR = join(ROOT_DIR, "assets");
const OUTPUT_DIR = join(ROOT_DIR, "dist");
const MIN_WORD_COUNT = 150;

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function asCdata(value) {
  return `<![CDATA[${String(value).replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

export function countWords(markdown) {
  return markdown.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function requiredString(metadata, field, sourceName) {
  const value = metadata[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${sourceName}: поле ${field} обязательно`);
  }
  return value.trim();
}

function normalizeUrl(value, siteUrl, field, sourceName) {
  let url;
  try {
    url = new URL(value, siteUrl);
  } catch {
    throw new Error(`${sourceName}: поле ${field} должно содержать URL`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${sourceName}: поле ${field} должно использовать HTTPS`);
  }
  return url.toString();
}

export function parseArticle(source, sourceName = "article.md", siteUrl = "https://example.com") {
  const normalized = source.replaceAll("\r\n", "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]+)$/);
  if (!match) {
    throw new Error(`${sourceName}: не найден корректный YAML front matter`);
  }

  const metadata = YAML.parse(match[1]);
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(`${sourceName}: front matter должен быть объектом`);
  }

  const published = metadata.published === true;
  const title = requiredString(metadata, "title", sourceName);
  const slug = requiredString(metadata, "slug", sourceName);
  const description = requiredString(metadata, "description", sourceName);
  const author = requiredString(metadata, "author", sourceName);
  const language = requiredString(metadata, "language", sourceName);
  const publishedAt = requiredString(metadata, "publishedAt", sourceName);
  const body = match[2].trim();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${sourceName}: slug должен состоять из строчных латинских букв, цифр и дефисов`);
  }

  if (!/^[a-z]{2}$/.test(language)) {
    throw new Error(`${sourceName}: language должен быть двухбуквенным кодом, например ru или en`);
  }

  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${sourceName}: publishedAt содержит некорректную дату`);
  }

  const categories = metadata.categories ?? [];
  if (!Array.isArray(categories) || categories.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${sourceName}: categories должен быть массивом непустых строк`);
  }

  const wordCount = countWords(body);
  if (published && wordCount < MIN_WORD_COUNT) {
    throw new Error(`${sourceName}: опубликованная статья содержит ${wordCount} слов; требуется не меньше ${MIN_WORD_COUNT}`);
  }

  let cover = null;
  if (metadata.cover !== undefined) {
    if (!metadata.cover || typeof metadata.cover !== "object" || Array.isArray(metadata.cover)) {
      throw new Error(`${sourceName}: cover должен быть объектом`);
    }
    const type = requiredString(metadata.cover, "type", sourceName);
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(type)) {
      throw new Error(`${sourceName}: cover.type должен быть image/jpeg, image/png или image/webp`);
    }
    cover = {
      url: normalizeUrl(requiredString(metadata.cover, "url", sourceName), siteUrl, "cover.url", sourceName),
      type,
      alt: typeof metadata.cover.alt === "string" ? metadata.cover.alt.trim() : "",
    };
  }

  return {
    title,
    slug,
    description,
    author,
    language,
    publishedAt: date,
    categories: categories.map((item) => item.trim()),
    published,
    body,
    wordCount,
    cover,
  };
}

function validateConfig(config) {
  const sourceName = "feed.config.json";
  const title = requiredString(config, "title", sourceName);
  const description = requiredString(config, "description", sourceName);
  const language = requiredString(config, "language", sourceName);
  const feedPath = requiredString(config, "feedPath", sourceName);
  const siteUrl = normalizeUrl(requiredString(config, "siteUrl", sourceName), undefined, "siteUrl", sourceName);
  const normalizedFeedPath = feedPath.replace(/^\/+/, "");
  if (normalizedFeedPath === "" || normalizedFeedPath.endsWith("/")) {
    throw new Error(`${sourceName}: feedPath должен указывать на XML-файл`);
  }
  return { title, description, language, feedPath: normalizedFeedPath, siteUrl: siteUrl.replace(/\/$/, "") };
}

function articleUrl(config, article) {
  return new URL(`${article.language}/articles/${article.slug}.html`, `${config.siteUrl}/`).toString();
}

export function renderArticleBody(article) {
  return marked.parse(article.body, { async: false }).trim();
}

export function createFeedXml(configInput, articles) {
  const config = validateConfig(configInput);
  const publishedArticles = articles
    .filter((article) => article.published && article.language === config.language)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const duplicateSlugs = publishedArticles
    .map((article) => article.slug)
    .filter((slug, index, all) => all.indexOf(slug) !== index);
  if (duplicateSlugs.length > 0) {
    throw new Error(`Найдены повторяющиеся slug: ${[...new Set(duplicateSlugs)].join(", ")}`);
  }

  const lastBuildDate = publishedArticles[0]?.publishedAt.toUTCString();
  const items = publishedArticles.map((article) => {
    const link = articleUrl(config, article);
    const categories = article.categories
      .map((category) => `      <category>${escapeXml(category)}</category>`)
      .join("\n");
    const enclosure = article.cover
      ? `\n      <enclosure url="${escapeXml(article.cover.url)}" type="${escapeXml(article.cover.type)}"/>`
      : "";
    const coverFigure = article.cover
      ? `<figure><img alt="${escapeXml(article.cover.alt)}" src="${escapeXml(article.cover.url)}"/></figure>`
      : "";
    const content = `<header><h1>${escapeXml(article.title)}</h1></header>${coverFigure}${renderArticleBody(article)}`;

    return [
      '    <item turbo="true">',
      `      <title>${escapeXml(article.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <amplink>${escapeXml(link)}</amplink>`,
      `      <pubDate>${article.publishedAt.toUTCString()}</pubDate>`,
      `      <author>${escapeXml(article.author)}</author>`,
      categories,
      enclosure.trimStart(),
      `      <description>${escapeXml(article.description)}</description>`,
      `      <turbo:content>${asCdata(content)}</turbo:content>`,
      "    </item>",
    ].filter(Boolean).join("\n");
  }).join("\n");

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rss version="2.0" xmlns:yandex="http://news.yandex.ru" xmlns:turbo="http://turbo.yandex.ru" xmlns:media="http://search.yahoo.com/mrss/">',
    "  <channel>",
    `    <title>${escapeXml(config.title)}</title>`,
    `    <link>${escapeXml(config.siteUrl)}</link>`,
    `    <description>${escapeXml(config.description)}</description>`,
    `    <language>${escapeXml(config.language)}</language>`,
    lastBuildDate ? `    <lastBuildDate>${lastBuildDate}</lastBuildDate>` : "",
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export function createArticleHtml(configInput, article) {
  const config = validateConfig(configInput);
  const canonicalUrl = articleUrl(config, article);
  const cover = article.cover
    ? `<p><img src="${escapeXml(article.cover.url)}" alt="${escapeXml(article.cover.alt)}" width="1200" height="675"></p>`
    : "";

  return [
    "<!doctype html>",
    `<html lang="${escapeXml(config.language)}">`,
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeXml(article.title)}</title>`,
    `  <meta name="description" content="${escapeXml(article.description)}">`,
    `  <link rel="canonical" href="${escapeXml(canonicalUrl)}">`,
    "</head>",
    "<body>",
    "<main>",
    `  <h1>${escapeXml(article.title)}</h1>`,
    `  <p><time datetime="${escapeXml(article.publishedAt.toISOString())}">${escapeXml(article.publishedAt.toISOString())}</time> · ${escapeXml(article.author)}</p>`,
    cover,
    renderArticleBody(article),
    "</main>",
    "</body>",
    "</html>",
    "",
  ].filter(Boolean).join("\n");
}

async function build() {
  const rootConfig = JSON.parse(await readFile(join(ROOT_DIR, "feed.config.json"), "utf8"));
  if (!Array.isArray(rootConfig.feeds) || rootConfig.feeds.length !== 2) {
    throw new Error("feed.config.json: требуется ровно две настройки feeds — ru и en");
  }
  const feedConfigs = rootConfig.feeds.map((feed) => validateConfig({ ...feed, siteUrl: rootConfig.siteUrl }));
  const feedLanguages = feedConfigs.map((feed) => feed.language);
  if (new Set(feedLanguages).size !== feedLanguages.length || !feedLanguages.includes("ru") || !feedLanguages.includes("en")) {
    throw new Error("feed.config.json: feeds должны содержать уникальные языки ru и en");
  }
  const articleFiles = (await readdir(ARTICLES_DIR))
    .filter((name) => extname(name) === ".md")
    .sort();
  const articles = await Promise.all(articleFiles.map(async (name) => {
    const source = await readFile(join(ARTICLES_DIR, name), "utf8");
    return parseArticle(source, name, rootConfig.siteUrl);
  }));

  const unknownLanguages = articles
    .map((article) => article.language)
    .filter((language) => !feedLanguages.includes(language));
  if (unknownLanguages.length > 0) {
    throw new Error(`Статьи содержат языки без RSS-настройки: ${[...new Set(unknownLanguages)].join(", ")}`);
  }

  const publishedArticles = articles.filter((article) => article.published);
  if (!OUTPUT_DIR.endsWith("/dist")) {
    throw new Error(`Отказ очищать неожиданный каталог: ${OUTPUT_DIR}`);
  }
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await cp(ASSETS_DIR, join(OUTPUT_DIR, "assets"), { recursive: true });
  await Promise.all(feedConfigs.map(async (config) => {
    const feedOutputPath = join(OUTPUT_DIR, config.feedPath);
    await mkdir(dirname(feedOutputPath), { recursive: true });
    await writeFile(feedOutputPath, createFeedXml(config, articles), "utf8");
  }));
  await Promise.all(publishedArticles.map(async (article) => {
    const config = feedConfigs.find((feed) => feed.language === article.language);
    const articleOutputPath = join(OUTPUT_DIR, article.language, "articles", `${article.slug}.html`);
    await mkdir(dirname(articleOutputPath), { recursive: true });
    await writeFile(articleOutputPath, createArticleHtml(config, article), "utf8");
  }));

  console.log(`Собрано статей: ${publishedArticles.length}`);
  for (const config of feedConfigs) {
    console.log(`RSS ${config.language.toUpperCase()}: ${join(OUTPUT_DIR, config.feedPath)}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
}