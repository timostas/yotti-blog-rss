import { cp, readFile, readdir, rm, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import YAML from "yaml";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARTICLES_DIR = join(ROOT_DIR, "articles");
const ASSETS_DIR = join(ROOT_DIR, "assets");
const OUTPUT_DIR = join(ROOT_DIR, "dist");
const TAXONOMY_PATH = join(ROOT_DIR, "config", "editorial-taxonomy.json");
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
  const visibleText = String(markdown)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return visibleText.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export function isPublishable(article, now = new Date()) {
  return article.published && article.publishedAt.getTime() <= now.getTime();
}

function requiredString(metadata, field, sourceName) {
  const value = metadata[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${sourceName}: поле ${field} обязательно`);
  }
  return value.trim();
}

function requiredDateOnly(metadata, field, sourceName) {
  const value = requiredString(metadata, field, sourceName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${sourceName}: поле ${field} должно иметь формат YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${sourceName}: поле ${field} содержит некорректную дату`);
  }
  return value;
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

function optionalIsoDate(metadata, field, sourceName) {
  if (metadata[field] === undefined) return null;
  const value = requiredString(metadata, field, sourceName);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new Error(`${sourceName}: поле ${field} должно быть датой в ISO 8601 с UTC`);
  }
  return date;
}

function parseEditorialMetadata(metadata, article, sourceName) {
  if (metadata.editorial === undefined) return null;
  if (!metadata.editorial || typeof metadata.editorial !== "object" || Array.isArray(metadata.editorial)) {
    throw new Error(`${sourceName}: editorial должен быть объектом`);
  }

  const authorUrl = normalizeUrl(requiredString(metadata.editorial, "authorUrl", sourceName), undefined, "editorial.authorUrl", sourceName);
  const modifiedAt = optionalIsoDate(metadata.editorial, "modifiedAt", sourceName);
  if (modifiedAt && modifiedAt.getTime() < article.publishedAt.getTime()) {
    throw new Error(`${sourceName}: editorial.modifiedAt не может быть раньше publishedAt`);
  }

  const alternate = metadata.editorial.alternate;
  let alternateLink = null;
  if (alternate !== undefined) {
    if (!alternate || typeof alternate !== "object" || Array.isArray(alternate)) {
      throw new Error(`${sourceName}: editorial.alternate должен быть объектом`);
    }
    const language = requiredString(alternate, "language", sourceName);
    if (!/^[a-z]{2}$/.test(language) || language === article.language) {
      throw new Error(`${sourceName}: editorial.alternate.language должен быть другим двухбуквенным кодом языка`);
    }
    alternateLink = {
      language,
      url: normalizeUrl(requiredString(alternate, "url", sourceName), undefined, "editorial.alternate.url", sourceName),
    };
  }

  const imageTitle = requiredString(metadata.editorial, "imageTitle", sourceName);
  const imageDescription = requiredString(metadata.editorial, "imageDescription", sourceName);
  const sourceNotes = metadata.editorial.sourceNotes;
  if (!Array.isArray(sourceNotes) || sourceNotes.length < 2) {
    throw new Error(`${sourceName}: editorial.sourceNotes должен содержать минимум два источника`);
  }
  const normalizedSources = sourceNotes.map((source, index) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new Error(`${sourceName}: editorial.sourceNotes[${index}] должен быть объектом`);
    }
    return {
      title: requiredString(source, "title", sourceName),
      url: normalizeUrl(requiredString(source, "url", sourceName), undefined, `editorial.sourceNotes[${index}].url`, sourceName),
    };
  });
  if (new Set(normalizedSources.map((source) => source.url)).size !== normalizedSources.length) {
    throw new Error(`${sourceName}: editorial.sourceNotes не должен содержать повторяющиеся URL`);
  }

  return { authorUrl, modifiedAt, alternate: alternateLink, imageTitle, imageDescription, sourceNotes: normalizedSources };
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

  let reviewer = null;
  let reviewedAt = null;
  let reviewAfter = null;
  let sources = [];
  if (published) {
    reviewer = requiredString(metadata, "reviewer", sourceName);
    reviewedAt = requiredDateOnly(metadata, "reviewedAt", sourceName);
    reviewAfter = requiredDateOnly(metadata, "reviewAfter", sourceName);
    if (reviewAfter <= reviewedAt) {
      throw new Error(`${sourceName}: reviewAfter должен быть позже reviewedAt`);
    }
    if (reviewAfter < date.toISOString().slice(0, 10)) {
      throw new Error(`${sourceName}: reviewAfter не может быть раньше publishedAt`);
    }
    if (!Array.isArray(metadata.sources) || metadata.sources.length < 2) {
      throw new Error(`${sourceName}: для опубликованной статьи требуется минимум два источника`);
    }
    sources = metadata.sources.map((source, index) => {
      if (typeof source !== "string" || source.trim() === "") {
        throw new Error(`${sourceName}: sources[${index}] должен быть непустой строкой`);
      }
      return normalizeUrl(source.trim(), undefined, `sources[${index}]`, sourceName);
    });
    if (new Set(sources).size !== sources.length) {
      throw new Error(`${sourceName}: sources не должен содержать повторяющиеся URL`);
    }
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

  const article = {
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
    reviewer,
    reviewedAt,
    reviewAfter,
    sources,
  };
  article.editorial = parseEditorialMetadata(metadata, article, sourceName);
  return article;
}

export function validateArticleCategories(article, taxonomy, sourceName = "article.md") {
  if (!taxonomy || taxonomy.schemaVersion !== 1 || !taxonomy.formats || typeof taxonomy.formats !== "object") {
    throw new Error("config/editorial-taxonomy.json: требуется корректный справочник рубрик");
  }
  const localeCategories = new Set(Object.values(taxonomy.formats).map((format) => format?.[article.language]).filter(Boolean));
  const legacyCategories = new Set(taxonomy.rules?.legacyCategoriesAllowedOnlyForExistingContractTests || []);
  const isContractTest = /(?:^|[-_])test(?:[-_.]|$)/.test(sourceName);
  const editorialCategories = article.categories.filter((category) => localeCategories.has(category));
  const countryCodes = article.categories.filter((category) => /^[A-Z]{2}$/.test(category));
  const invalidCategories = article.categories.filter((category) => !localeCategories.has(category) && !/^[A-Z]{2}$/.test(category) && !(isContractTest && legacyCategories.has(category)));

  if (invalidCategories.length > 0) {
    throw new Error(`${sourceName}: неизвестная рубрика: ${invalidCategories.join(", ")}`);
  }
  if (isContractTest && article.categories.every((category) => legacyCategories.has(category) || /^[A-Z]{2}$/.test(category))) {
    return;
  }
  if (editorialCategories.length !== taxonomy.rules.editorialCategoryCount) {
    throw new Error(`${sourceName}: нужна ровно одна каноническая тематическая рубрика для ${article.language}`);
  }
  if (countryCodes.length > 1) {
    throw new Error(`${sourceName}: допускается не более одного кода страны`);
  }
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

function formatEditorialDate(date, language) {
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function sourceLabel(sourceUrl) {
  const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
  const knownSources = new Map([
    ["yotti.net", "Yotti"],
    ["support.apple.com", "Apple Support"],
    ["support.google.com", "Google Help"],
    ["apple.com", "Apple"],
    ["google.com", "Google"],
    ["samsung.com", "Samsung"],
    ["gsma.com", "GSMA"],
  ]);
  return knownSources.get(hostname) ?? hostname;
}

function articleSourceNotes(article) {
  if (article.editorial?.sourceNotes) return article.editorial.sourceNotes;
  return article.sources.map((url) => ({ title: sourceLabel(url), url }));
}

function renderEditorialByline(article) {
  const ru = article.language === "ru";
  const authorUrl = article.editorial?.authorUrl ?? (ru ? "https://yotti.net/about" : "https://yotti.net/en/about");
  const authorLabel = ru ? "Автор" : "Author";
  const publishedLabel = ru ? "Опубликовано" : "Published";
  const reviewedLabel = ru ? "Проверено редакцией" : "Editorially reviewed";
  const reviewedAt = new Date(`${article.reviewedAt}T00:00:00.000Z`);

  return `<aside><p><strong>${authorLabel}:</strong> <a href="${escapeXml(authorUrl)}">${escapeXml(article.author)}</a><br>${publishedLabel}: <time datetime="${escapeXml(article.publishedAt.toISOString())}">${escapeXml(formatEditorialDate(article.publishedAt, article.language))}</time> · ${reviewedLabel}: <time datetime="${escapeXml(reviewedAt.toISOString())}">${escapeXml(formatEditorialDate(reviewedAt, article.language))}</time></p></aside>`;
}

function renderEditorialSources(article) {
  const ru = article.language === "ru";
  const sourcesHeading = ru ? "Источники" : "Sources";
  const sourceLead = ru
    ? "Факты и рекомендации сверены по следующим материалам:"
    : "Facts and recommendations were checked against the following references:";
  const sources = articleSourceNotes(article)
    .map((source) => `<li><a href="${escapeXml(source.url)}">${escapeXml(source.title)}</a></li>`)
    .join("");

  return `<section><h2>${sourcesHeading}</h2><p>${sourceLead}</p><ul>${sources}</ul></section>`;
}

export function createFeedXml(configInput, articles, now = new Date()) {
  const config = validateConfig(configInput);
  const publishedArticles = articles
    .filter((article) => isPublishable(article, now) && article.language === config.language)
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
    const content = `<header><h1>${escapeXml(article.title)}</h1></header>${coverFigure}${renderEditorialByline(article)}${renderArticleBody(article)}${renderEditorialSources(article)}`;
    const richMetadata = article.editorial ? [
      `      <dc:creator>${escapeXml(article.author)}</dc:creator>`,
      `      <dc:publisher>Yotti</dc:publisher>`,
      `      <dc:date>${article.publishedAt.toISOString()}</dc:date>`,
      `      <dc:language>${escapeXml(article.language)}</dc:language>`,
      `      <dc:rights>© Yotti</dc:rights>`,
      `      <content:encoded>${asCdata(content)}</content:encoded>`,
      article.editorial.modifiedAt ? `      <dcterms:modified>${article.editorial.modifiedAt.toISOString()}</dcterms:modified>` : "",
      article.editorial.modifiedAt ? `      <atom:updated>${article.editorial.modifiedAt.toISOString()}</atom:updated>` : "",
      article.editorial.alternate ? `      <atom:link rel="alternate" hreflang="${escapeXml(article.editorial.alternate.language)}" href="${escapeXml(article.editorial.alternate.url)}"/>` : "",
      article.cover ? `      <media:content url="${escapeXml(article.cover.url)}" type="${escapeXml(article.cover.type)}" medium="image"><media:title type="plain">${escapeXml(article.editorial.imageTitle)}</media:title><media:description type="plain">${escapeXml(article.editorial.imageDescription)}</media:description><media:credit role="author">${escapeXml(article.author)}</media:credit></media:content>` : "",
      article.cover ? `      <media:thumbnail url="${escapeXml(article.cover.url)}"><media:title type="plain">${escapeXml(article.editorial.imageTitle)}</media:title><media:description type="plain">${escapeXml(article.editorial.imageDescription)}</media:description></media:thumbnail>` : "",
      `      <media:keywords>${escapeXml(article.categories.join(", "))}</media:keywords>`,
    ].filter(Boolean) : [];

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
      ...richMetadata,
      `      <turbo:content>${asCdata(content)}</turbo:content>`,
      "    </item>",
    ].filter(Boolean).join("\n");
  }).join("\n");

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rss version="2.0" xmlns:yandex="http://news.yandex.ru" xmlns:turbo="http://turbo.yandex.ru" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(config.title)}</title>`,
    `    <link>${escapeXml(config.siteUrl)}</link>`,
    `    <description>${escapeXml(config.description)}</description>`,
    `    <language>${escapeXml(config.language)}</language>`,
    `    <atom:link href="${escapeXml(new URL(config.feedPath, `${config.siteUrl}/`).toString())}" rel="self" type="application/rss+xml"/>`,
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
    ? `<figure class="article-cover"><img src="${escapeXml(article.cover.url)}" alt="${escapeXml(article.cover.alt)}" width="1200" height="675"></figure>`
    : "";

  return [
    "<!doctype html>",
    `<html lang="${escapeXml(config.language)}">`,
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeXml(article.title)}</title>`,
    `  <meta name="description" content="${escapeXml(article.description)}">`,
    `  <meta property="article:published_time" content="${escapeXml(article.publishedAt.toISOString())}">`,
    article.editorial?.modifiedAt ? `  <meta property="article:modified_time" content="${escapeXml(article.editorial.modifiedAt.toISOString())}">` : "",
    article.editorial?.alternate ? `  <link rel="alternate" hreflang="${escapeXml(article.editorial.alternate.language)}" href="${escapeXml(article.editorial.alternate.url)}">` : "",
    `  <link rel="canonical" href="${escapeXml(canonicalUrl)}">`,
    article.cover ? `  <meta property="og:image" content="${escapeXml(article.cover.url)}">` : "",
    "  <style>",
    "    :root{color-scheme:light;--page:#f8f6f1;--paper:#fff;--ink:#1c2926;--muted:#68736f;--rule:#dbe2df;--coral:#df6047;--pine:#246b63}",
    "    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--page);color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;font-size:18px;line-height:1.68;text-rendering:optimizeLegibility}",
    "    main{width:min(100% - 32px,760px);margin:0 auto;padding:64px 0 96px}h1{margin:0 0 20px;font-size:clamp(2.25rem,7vw,4rem);line-height:1.02;letter-spacing:-.045em}h2{margin:64px 0 18px;font-size:clamp(1.55rem,4vw,2.1rem);line-height:1.18;letter-spacing:-.025em}h3{margin:34px 0 12px;font-size:1.2rem;line-height:1.3}p{margin:0 0 1.25em}a{color:#175f58;text-decoration-thickness:.08em;text-underline-offset:.18em}ul,ol{padding-left:1.25em}li+li{margin-top:.45em}",
    "    img,svg{max-width:100%;height:auto}.article-cover{margin:32px 0 44px}.article-cover img,main>figure img,.yotti-photo img{display:block;width:100%;border-radius:24px}figcaption{margin:.75rem auto 0;max-width:92%;color:var(--muted);font-size:.88rem;line-height:1.5;text-align:center;font-style:italic}",
    "    aside{margin:28px 0;padding:18px 22px;border-left:4px solid var(--coral);border-radius:0 16px 16px 0;background:#f0f4f1;color:#43504c}aside p:last-child{margin-bottom:0}",
    "    table{width:100%;border-collapse:separate;border-spacing:0;margin:26px 0;border:1px solid var(--rule);border-radius:18px;overflow:hidden;background:var(--paper);font-size:.9rem;line-height:1.45}th,td{padding:14px 16px;text-align:left;vertical-align:top;border-bottom:1px solid var(--rule)}th{background:#edf3ef;font-weight:700}tr:last-child td{border-bottom:0}",
    "    .yotti-table-scroll{overflow-x:auto;margin:28px 0;border-radius:18px}.yotti-table-scroll table{margin:0;min-width:620px}.yotti-route-feature>p:first-of-type{font-size:1.16rem;line-height:1.58;color:#35423e}.yotti-photo{margin:44px 0}.yotti-route-map{margin:40px 0}.yotti-toc{margin:30px 0}.yotti-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:28px 0}.yotti-choice-card{padding:22px;border:1px solid var(--rule);border-radius:20px;background:var(--paper)}",
    "    @media(max-width:640px){body{font-size:17px}main{width:min(100% - 24px,760px);padding:36px 0 64px}h2{margin-top:48px}.yotti-choice-grid{grid-template-columns:1fr}.article-cover,.yotti-photo,.yotti-route-map{margin-left:-2px;margin-right:-2px}th,td{padding:12px 13px}}",
    "    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}",
    "  </style>",
    "</head>",
    "<body>",
    "<main>",
    `  <h1>${escapeXml(article.title)}</h1>`,
    renderEditorialByline(article),
    cover,
    renderArticleBody(article),
    renderEditorialSources(article),
    "</main>",
    "</body>",
    "</html>",
    "",
  ].filter(Boolean).join("\n");
}

async function build() {
  const buildTime = new Date();
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
  const taxonomy = JSON.parse(await readFile(TAXONOMY_PATH, "utf8"));
  articles.forEach((article, index) => validateArticleCategories(article, taxonomy, articleFiles[index]));

  const unknownLanguages = articles
    .map((article) => article.language)
    .filter((language) => !feedLanguages.includes(language));
  if (unknownLanguages.length > 0) {
    throw new Error(`Статьи содержат языки без RSS-настройки: ${[...new Set(unknownLanguages)].join(", ")}`);
  }

  const publishedArticles = articles.filter((article) => isPublishable(article, buildTime));
  if (!OUTPUT_DIR.endsWith("/dist")) {
    throw new Error(`Отказ очищать неожиданный каталог: ${OUTPUT_DIR}`);
  }
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await cp(ASSETS_DIR, join(OUTPUT_DIR, "assets"), { recursive: true });
  await Promise.all(feedConfigs.map(async (config) => {
    const feedOutputPath = join(OUTPUT_DIR, config.feedPath);
    await mkdir(dirname(feedOutputPath), { recursive: true });
    await writeFile(feedOutputPath, createFeedXml(config, articles, buildTime), "utf8");
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
