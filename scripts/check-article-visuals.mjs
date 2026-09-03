import { readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArticle } from "./build-feed.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SITE_URL = "https://timostas.github.io/yotti-blog-rss";

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match ? (match[1] ?? match[2] ?? "").trim() : "";
}

function figureRole(openingTag) {
  const classes = new Set(attribute(openingTag, "class").split(/\s+/).filter(Boolean));
  if (classes.has("yotti-route-map")) return "route-map";
  if (classes.has("yotti-information-graphic")) return "information-graphic";
  if (classes.has("yotti-photo")) return "contextual-photo";
  return "unknown";
}

export function extractVisuals(body) {
  const figures = [];
  const figurePattern = /(<figure\b[^>]*>)([\s\S]*?)<\/figure>/gi;
  let match;
  while ((match = figurePattern.exec(body)) !== null) {
    const [, openingTag, content] = match;
    const imageTags = content.match(/<img\b[^>]*>/gi) || [];
    const sourceTags = content.match(/<source\b[^>]*>/gi) || [];
    figures.push({
      role: figureRole(openingTag),
      imageTags,
      sourceTags,
      caption: content.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1]
        ?.replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim() ?? "",
    });
  }
  const outsideFigures = body.replace(figurePattern, " ");
  return {
    figures,
    outsideHtmlImages: outsideFigures.match(/<img\b[^>]*>/gi) || [],
    markdownImages: [...body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((entry) => entry[1]),
  };
}

function localAssetPath(urlValue, siteUrl = DEFAULT_SITE_URL) {
  const url = new URL(urlValue);
  const base = new URL(siteUrl);
  const basePath = `${base.pathname.replace(/\/$/, "")}/assets/`;
  if (url.origin !== base.origin || !url.pathname.startsWith(basePath)) return null;
  const relativePath = decodeURIComponent(url.pathname.slice(base.pathname.replace(/\/$/, "").length + 1));
  if (!relativePath.startsWith("assets/") || relativePath.includes("..")) return null;
  return relativePath;
}

export function inspectWebp(buffer, label = "image.webp") {
  if (buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error(`${label}: файл не является WebP`);
  }
  let width = null;
  let height = null;
  let animated = false;
  let loopCount = null;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const chunk = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + size > buffer.length) break;
    if (chunk === "VP8X" && size >= 10) {
      animated = (buffer[data] & 0x02) !== 0;
      width = 1 + buffer.readUIntLE(data + 4, 3);
      height = 1 + buffer.readUIntLE(data + 7, 3);
    } else if (chunk === "VP8 " && size >= 10 && buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      width ??= buffer.readUInt16LE(data + 6) & 0x3fff;
      height ??= buffer.readUInt16LE(data + 8) & 0x3fff;
    } else if (chunk === "VP8L" && size >= 5 && buffer[data] === 0x2f) {
      width ??= 1 + buffer[data + 1] + ((buffer[data + 2] & 0x3f) << 8);
      height ??= 1 + ((buffer[data + 2] & 0xc0) >> 6) + (buffer[data + 3] << 2) + ((buffer[data + 4] & 0x0f) << 10);
    } else if (chunk === "ANIM" && size >= 6) {
      animated = true;
      loopCount = buffer.readUInt16LE(data + 4);
    }
    offset = data + size + (size % 2);
  }
  if (!width || !height) throw new Error(`${label}: не удалось прочитать размеры WebP`);
  return { width, height, animated, loopCount };
}

async function inspectAsset(rootDir, relativePath, label, errors) {
  const absolutePath = resolve(rootDir, relativePath);
  if (!absolutePath.startsWith(`${resolve(rootDir)}/`)) {
    errors.push(`${label}: путь изображения выходит за пределы репозитория`);
    return null;
  }
  try {
    const [file, bytes] = await Promise.all([stat(absolutePath), readFile(absolutePath)]);
    return { path: relativePath, size: file.size, ...inspectWebp(bytes, label) };
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
    return null;
  }
}

function formatComposition(gate, contentFormat, errors, label) {
  const composition = gate.compositionByFormat?.[contentFormat];
  if (!composition) errors.push(`${label}: для формата ${contentFormat} не задана визуальная композиция`);
  return composition;
}

export async function validateArticleVisuals({ article, contentFormat, gate, rootDir = ROOT_DIR, siteUrl = DEFAULT_SITE_URL, strict = true, sourceName = "article.md" }) {
  const errors = [];
  const visual = extractVisuals(article.body);
  if (!article.cover) errors.push(`${sourceName}: обязательна обложка`);
  if (visual.outsideHtmlImages.length > 0 || visual.markdownImages.length > 0) {
    errors.push(`${sourceName}: каждое встроенное изображение должно находиться в figure с ролью и figcaption`);
  }
  if (/<table\b/i.test(article.body) && gate.forbidRawTables) {
    errors.push(`${sourceName}: сырые HTML-таблицы запрещены; используйте адаптивную WebP-инфографику и текстовый эквивалент`);
  }
  if (visual.figures.some((figure) => figure.imageTags.length !== 1)) {
    errors.push(`${sourceName}: каждый figure должен содержать ровно один img`);
  }
  const imageEntries = visual.figures.flatMap((figure) => figure.imageTags.map((tag) => ({ figure, tag })));
  if (imageEntries.length !== gate.requiredInlineImages) {
    errors.push(`${sourceName}: требуется ровно ${gate.requiredInlineImages} встроенных изображений; найдено ${imageEntries.length}`);
  }
  if ((article.cover ? 1 : 0) + imageEntries.length !== gate.requiredTotalImagesIncludingCover) {
    errors.push(`${sourceName}: требуется ровно ${gate.requiredTotalImagesIncludingCover} изображений вместе с обложкой`);
  }
  const composition = formatComposition(gate, contentFormat, errors, sourceName);
  if (composition) {
    const counts = {
      contextualPhotos: imageEntries.filter(({ figure }) => figure.role === "contextual-photo").length,
      informationGraphics: imageEntries.filter(({ figure }) => figure.role === "information-graphic").length,
      routeMaps: imageEntries.filter(({ figure }) => figure.role === "route-map").length,
    };
    for (const [key, required] of Object.entries(composition)) {
      if (counts[key] !== required) errors.push(`${sourceName}: ${key}=${counts[key]}, требуется ${required}`);
    }
  }
  if (visual.figures.some((figure) => figure.role === "unknown")) {
    errors.push(`${sourceName}: разрешены только yotti-photo, yotti-information-graphic и yotti-route-map`);
  }
  if (gate.requireInlineFigureCaption && visual.figures.some((figure) => !figure.caption)) {
    errors.push(`${sourceName}: у каждого встроенного изображения обязателен figcaption`);
  }

  const allAssets = [];
  const altTexts = [];
  const imagePaths = [];
  let eagerInlineImages = 0;
  for (const [index, { figure, tag }] of imageEntries.entries()) {
    const label = `${sourceName}: img ${index + 1}`;
    const src = attribute(tag, "src");
    const alt = attribute(tag, "alt");
    const declaredWidth = Number.parseInt(attribute(tag, "width"), 10);
    const declaredHeight = Number.parseInt(attribute(tag, "height"), 10);
    if (!src) errors.push(`${label}: отсутствует src`);
    if (!alt) errors.push(`${label}: отсутствует содержательный alt`);
    else altTexts.push(alt.toLocaleLowerCase(article.language));
    if (strict && gate.requireAsyncDecoding && attribute(tag, "decoding").toLowerCase() !== "async") {
      errors.push(`${label}: требуется decoding="async"`);
    }
    if (attribute(tag, "loading").toLowerCase() !== "lazy") eagerInlineImages += 1;
    const relativePath = src ? localAssetPath(src, siteUrl) : null;
    if (gate.requireLocalWebpAssets && (!relativePath || extname(relativePath).toLowerCase() !== ".webp")) {
      errors.push(`${label}: требуется локальный WebP из assets/ этого RSS-репозитория`);
      continue;
    }
    const asset = await inspectAsset(rootDir, relativePath, label, errors);
    if (!asset) continue;
    imagePaths.push(relativePath);
    allAssets.push({ ...asset, role: figure.role });
    if (gate.requireDeclaredAndIntrinsicDimensions) {
      if (!Number.isInteger(declaredWidth) || !Number.isInteger(declaredHeight)) {
        errors.push(`${label}: обязательны числовые width и height`);
      } else if (declaredWidth !== asset.width || declaredHeight !== asset.height) {
        errors.push(`${label}: объявлено ${declaredWidth}x${declaredHeight}, файл имеет ${asset.width}x${asset.height}`);
      }
    }
    if (asset.width < gate.minimumInlineImageWidth || asset.width > gate.maximumInlineImageWidth) {
      errors.push(`${label}: ширина ${asset.width}px вне диапазона ${gate.minimumInlineImageWidth}-${gate.maximumInlineImageWidth}px`);
    }
    if (figure.role === "information-graphic") {
      const aspectRatio = asset.width / asset.height;
      if (aspectRatio < gate.minimumInformationGraphicAspectRatio || aspectRatio > gate.maximumInformationGraphicAspectRatio) {
        errors.push(`${label}: пропорция ${aspectRatio.toFixed(2)} вне диапазона ${gate.minimumInformationGraphicAspectRatio}-${gate.maximumInformationGraphicAspectRatio}`);
      }
    }
    const byteLimit = figure.role === "information-graphic"
      ? gate.maximumInformationGraphicBytes
      : figure.role === "route-map" && asset.animated
        ? gate.maximumAnimatedMapBytes
        : gate.maximumContextualImageBytes;
    if (asset.size > byteLimit) errors.push(`${label}: ${asset.size} байт превышает лимит ${byteLimit}`);

    if (figure.role === "route-map") {
      if (!asset.animated) errors.push(`${label}: маршрутная карта должна быть анимированным WebP`);
      if (gate.requireInfiniteAnimatedMapLoop && asset.loopCount !== 0) {
        errors.push(`${label}: анимация должна повторяться непрерывно (loop=0), сейчас loop=${asset.loopCount}`);
      }
      if (gate.requireStaticMapFallback) {
        const fallbackTag = figure.sourceTags.find((source) => /prefers-reduced-motion\s*:\s*reduce/i.test(attribute(source, "media")));
        const fallbackUrl = fallbackTag ? attribute(fallbackTag, "srcset").split(/\s+/)[0] : "";
        const fallbackPath = fallbackUrl ? localAssetPath(fallbackUrl, siteUrl) : null;
        if (!fallbackPath) {
          errors.push(`${label}: отсутствует локальный статичный WebP для prefers-reduced-motion`);
        } else {
          const fallback = await inspectAsset(rootDir, fallbackPath, `${label} static fallback`, errors);
          if (fallback) {
            if (fallback.animated) errors.push(`${label}: reduced-motion резерв не должен содержать анимацию`);
            if (fallback.size > gate.maximumStaticMapFallbackBytes) {
              errors.push(`${label}: статичный резерв ${fallback.size} байт превышает лимит ${gate.maximumStaticMapFallbackBytes}`);
            }
          }
        }
      }
    }
  }

  if (strict && eagerInlineImages > gate.maximumEagerInlineImages) {
    errors.push(`${sourceName}: без loading="lazy" разрешено максимум ${gate.maximumEagerInlineImages} встроенное изображение; найдено ${eagerInlineImages}`);
  }
  if (article.cover) {
    const coverPath = localAssetPath(article.cover.url, siteUrl);
    if (article.cover.type !== "image/webp" || !coverPath || extname(coverPath).toLowerCase() !== ".webp") {
      errors.push(`${sourceName}: обложка должна быть локальным image/webp из assets/ этого RSS-репозитория`);
    } else {
      const cover = await inspectAsset(rootDir, coverPath, `${sourceName}: cover`, errors);
      if (cover) {
        imagePaths.push(coverPath);
        allAssets.push({ ...cover, role: "cover" });
        if (cover.size > gate.maximumCoverBytes) errors.push(`${sourceName}: обложка ${cover.size} байт превышает лимит ${gate.maximumCoverBytes}`);
        if (cover.width < gate.minimumCoverWidth || cover.width > gate.maximumCoverWidth) {
          errors.push(`${sourceName}: ширина обложки ${cover.width}px вне диапазона ${gate.minimumCoverWidth}-${gate.maximumCoverWidth}px`);
        }
      }
    }
    if (!article.cover.alt) errors.push(`${sourceName}: у обложки обязателен alt`);
    else altTexts.push(article.cover.alt.toLocaleLowerCase(article.language));
  }

  if (gate.requireUniqueImageAssets && new Set(imagePaths).size !== imagePaths.length) {
    errors.push(`${sourceName}: все семь изображений должны использовать разные файлы`);
  }
  if (gate.requireUniqueAltText && new Set(altTexts).size !== altTexts.length) {
    errors.push(`${sourceName}: alt обложки и встроенных изображений должны быть уникальными`);
  }

  const totalBytes = allAssets.reduce((sum, asset) => sum + asset.size, 0);
  if (totalBytes > gate.maximumTotalImageBytesIncludingCover) {
    errors.push(`${sourceName}: общий вес ${totalBytes} байт превышает лимит ${gate.maximumTotalImageBytesIncludingCover}`);
  }
  return { errors, summary: { totalImages: (article.cover ? 1 : 0) + imageEntries.length, inlineImages: imageEntries.length, totalBytes, eagerInlineImages } };
}

export async function checkRepositoryVisuals({ rootDir = ROOT_DIR, now = new Date() } = {}) {
  const [policy, queue, feedConfig, files] = await Promise.all([
    readFile(join(rootDir, "config", "editorial-policy.json"), "utf8").then(JSON.parse),
    readFile(join(rootDir, "content", "queue.json"), "utf8").then(JSON.parse),
    readFile(join(rootDir, "feed.config.json"), "utf8").then(JSON.parse),
    readdir(join(rootDir, "articles")),
  ]);
  const gate = policy.quality.longFormVisualGates;
  if (!gate) return { errors: ["config/editorial-policy.json: отсутствует quality.longFormVisualGates"], checked: [] };
  const effectiveFrom = new Date(gate.effectiveFrom);
  if (Number.isNaN(effectiveFrom.getTime())) return { errors: ["quality.longFormVisualGates.effectiveFrom некорректен"], checked: [] };
  const items = new Map(queue.items.map((item) => [item.id, item]));
  const referenceIds = new Set(gate.referenceArticleIds || []);
  const errors = [];
  const checked = [];
  for (const filename of files.filter((file) => file.endsWith(".md")).sort()) {
    const sourceName = `articles/${filename}`;
    const source = await readFile(join(rootDir, sourceName), "utf8");
    let article;
    try {
      article = parseArticle(source, sourceName, feedConfig.siteUrl);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    const id = article.slug.endsWith(`-${article.language}`)
      ? article.slug.slice(0, -article.language.length - 1)
      : basename(filename, ".md").replace(/-(?:ru|en)$/, "");
    const isReference = referenceIds.has(id);
    const isFuture = article.published && article.publishedAt.getTime() >= effectiveFrom.getTime();
    if (!isReference && !isFuture) continue;
    const item = items.get(id);
    if (!item) {
      errors.push(`${sourceName}: не найден элемент очереди ${id} для определения contentFormat`);
      continue;
    }
    if (!gate.applicableFormats.includes(item.contentFormat)) continue;
    const result = await validateArticleVisuals({ article, contentFormat: item.contentFormat, gate, rootDir, siteUrl: feedConfig.siteUrl, strict: isFuture, sourceName });
    errors.push(...result.errors);
    checked.push({ sourceName, id, contentFormat: item.contentFormat, reference: isReference, ...result.summary });
  }
  return { errors, checked, checkedAt: now.toISOString() };
}

async function main() {
  const report = await checkRepositoryVisuals();
  console.log("# Визуальный шлюз статей");
  for (const item of report.checked) {
    console.log(`- ${item.sourceName}: ${item.totalImages} изображений, ${item.totalBytes} байт${item.reference ? " (эталон)" : ""}`);
  }
  if (report.errors.length > 0) {
    console.error(`\nОшибок: ${report.errors.length}`);
    for (const error of report.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("- Ошибок: 0");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
