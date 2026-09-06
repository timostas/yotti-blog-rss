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

export function localAssetPath(urlValue, siteUrl = DEFAULT_SITE_URL) {
  if (typeof urlValue !== "string" || /[\\\0]/u.test(urlValue) || /%(?:00|2e|5c)/iu.test(urlValue)) return null;
  let url;
  let base;
  try {
    url = new URL(urlValue);
    base = new URL(siteUrl);
  } catch {
    return null;
  }
  if (url.username || url.password || url.origin !== base.origin || url.search || url.hash) return null;
  const repositoryPrefix = base.pathname.replace(/\/$/, "");
  const basePath = `${repositoryPrefix}/assets/`;
  if (!url.pathname.startsWith(basePath)) return null;
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(url.pathname.slice(repositoryPrefix.length + 1));
  } catch {
    return null;
  }
  const segments = decodedPath.split("/");
  if (!decodedPath.startsWith("assets/") || segments.some((segment) => segment === "" || segment === "." || segment === ".." || segment.includes("\\") || segment.includes("\0"))) return null;
  return decodedPath;
}

export function parseSrcsetCandidates(srcset) {
  if (typeof srcset !== "string" || srcset.trim() === "") throw new Error("srcset должен быть непустой строкой");
  const candidates = srcset.split(",").map((entry) => entry.trim()).map((entry) => {
    const parts = entry.split(/\s+/u);
    if (parts.length !== 2 || !/^[1-9]\d*w$/u.test(parts[1])) {
      throw new Error(`некорректный width descriptor в srcset: ${entry}`);
    }
    return { url: parts[0], width: Number.parseInt(parts[1], 10) };
  });
  if (new Set(candidates.map(({ width }) => width)).size !== candidates.length) {
    throw new Error("srcset содержит повторяющиеся width descriptors");
  }
  return candidates;
}

export function articleAssetPaths(article, siteUrl = DEFAULT_SITE_URL) {
  const paths = new Set();
  const addUrl = (value) => {
    const path = localAssetPath(value, siteUrl);
    if (path) paths.add(path);
  };
  const addSrcset = (value) => {
    if (!value) return;
    let candidates;
    try {
      candidates = parseSrcsetCandidates(value);
    } catch {
      candidates = value.split(",").map((entry) => ({ url: entry.trim().split(/\s+/u)[0] }));
    }
    for (const candidate of candidates) addUrl(candidate.url);
  };
  if (article.cover) {
    addUrl(article.cover.url);
    addSrcset(article.cover.srcset);
  }
  const visual = extractVisuals(article.body);
  for (const figure of visual.figures) {
    for (const tag of figure.imageTags) {
      addUrl(attribute(tag, "src"));
      addSrcset(attribute(tag, "srcset"));
    }
    for (const tag of figure.sourceTags) addSrcset(attribute(tag, "srcset"));
  }
  for (const tag of visual.outsideHtmlImages) {
    addUrl(attribute(tag, "src"));
    addSrcset(attribute(tag, "srcset"));
  }
  for (const url of visual.markdownImages) addUrl(url);
  return [...paths];
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

function byteLimitForRole(role, gate) {
  if (role === "cover") return gate.maximumCoverBytes;
  if (role === "information-graphic") return gate.maximumInformationGraphicBytes;
  if (role === "route-map") return gate.maximumAnimatedMapBytes;
  if (role === "static-map-fallback") return gate.maximumStaticMapFallbackBytes;
  return gate.maximumContextualImageBytes;
}

function validSizes(value) {
  if (typeof value !== "string" || value.trim() === "" || value.trim().toLowerCase() === "auto") return false;
  const length = String.raw`(?:calc\([^)]*\)|(?:0|[0-9]*\.?[0-9]+)(?:px|vw|vh|vmin|vmax|rem|em|%))`;
  return value.split(",").every((clause) => new RegExp(`^(?:\\([^)]*\\)\\s+)?${length}$`, "iu").test(clause.trim()));
}

async function validateResponsiveImage({
  src,
  srcset,
  sizes,
  baseAsset,
  role,
  gate,
  rootDir,
  siteUrl,
  label,
  errors,
  requireSizes = true,
  requireStatic = false,
}) {
  if (!srcset) {
    errors.push(`${label}: для изменённой статьи обязателен srcset`);
    return;
  }
  if (requireSizes && (!sizes || !validSizes(sizes))) {
    errors.push(`${label}: для изменённой статьи обязателен корректный sizes`);
  }
  let candidates;
  try {
    candidates = parseSrcsetCandidates(srcset);
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
    return;
  }
  const expectedWidths = [
    ...(gate.requiredChangedSrcsetDerivativeWidths || []),
    ...(gate.requireChangedSrcsetMasterWidth && baseAsset ? [baseAsset.width] : []),
  ].filter((width, index, values) => values.indexOf(width) === index).sort((a, b) => a - b);
  const actualWidths = candidates.map(({ width }) => width).sort((a, b) => a - b);
  if (expectedWidths.length > 0 && (
    expectedWidths.length !== actualWidths.length
    || expectedWidths.some((width, index) => actualWidths[index] !== width)
  )) {
    errors.push(`${label}: srcset должен содержать ровно width-кандидаты ${expectedWidths.map((width) => `${width}w`).join(", ")}; найдено ${actualWidths.map((width) => `${width}w`).join(", ")}`);
  }
  const basePath = localAssetPath(src, siteUrl);
  const inspected = [];
  for (const candidate of candidates) {
    const path = localAssetPath(candidate.url, siteUrl);
    if (!path || extname(path).toLowerCase() !== ".webp") {
      errors.push(`${label}: каждый srcset-кандидат должен быть локальным WebP из assets/`);
      continue;
    }
    const asset = await inspectAsset(rootDir, path, `${label} srcset ${candidate.width}w`, errors);
    if (!asset) continue;
    inspected.push({ ...candidate, path, asset });
    if (requireStatic && asset.animated) {
      errors.push(`${label}: srcset-кандидат ${path} для prefers-reduced-motion должен быть статичным WebP`);
    }
    if (gate.requireChangedSrcCandidateIntrinsicWidthMatch && asset.width !== candidate.width) {
      errors.push(`${label}: descriptor ${candidate.width}w не равен intrinsic width ${asset.width}px для ${path}`);
    }
    if (gate.requireChangedSrcCandidateAspectRatioMatch && baseAsset) {
      const expectedHeight = Math.round(baseAsset.height * asset.width / baseAsset.width);
      if (Math.abs(asset.height - expectedHeight) > 1) {
        errors.push(`${label}: srcset-кандидат ${path} меняет пропорцию базового изображения`);
      }
    }
    const byteLimit = byteLimitForRole(role, gate);
    if (asset.size > byteLimit) {
      errors.push(`${label}: srcset-кандидат ${path} весит ${asset.size} байт и превышает лимит ${byteLimit}`);
    }
  }
  const baseCandidate = inspected.find(({ path }) => path === basePath);
  if (!baseCandidate || !baseAsset || baseCandidate.width !== baseAsset.width) {
    errors.push(`${label}: базовый src должен присутствовать в srcset с intrinsic width descriptor`);
  } else if (baseCandidate.width !== Math.max(...candidates.map(({ width }) => width))) {
    errors.push(`${label}: базовый src должен быть самым широким srcset-кандидатом`);
  }
}

function formatComposition(gate, contentFormat, errors, label) {
  const composition = gate.compositionByFormat?.[contentFormat];
  if (!composition) errors.push(`${label}: для формата ${contentFormat} не задана визуальная композиция`);
  return composition;
}

export async function validateArticleVisuals({ article, contentFormat, gate, rootDir = ROOT_DIR, siteUrl = DEFAULT_SITE_URL, strict = true, requireChangedMetadata = false, sourceName = "article.md" }) {
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
    if (requireChangedMetadata && gate.forbidChangedInlineImageStyle && attribute(tag, "style")) {
      errors.push(`${label}: inline style изображения запрещён в изменённой статье`);
    }
    const lazy = attribute(tag, "loading").toLowerCase() === "lazy";
    if (!lazy) eagerInlineImages += 1;
    if (strict && index > 0 && !lazy) {
      errors.push(`${label}: после первого inline-визуала требуется loading="lazy"`);
    }
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
    if (requireChangedMetadata && figure.role === "contextual-photo") {
      const aspectRatio = asset.width / asset.height;
      if (aspectRatio < gate.minimumChangedContextualImageAspectRatio || aspectRatio > gate.maximumChangedContextualImageAspectRatio) {
        errors.push(`${label}: пропорция contextual photo ${aspectRatio.toFixed(2)} вне диапазона ${gate.minimumChangedContextualImageAspectRatio}-${gate.maximumChangedContextualImageAspectRatio}`);
      }
    }
    const byteLimit = byteLimitForRole(figure.role, gate);
    if (asset.size > byteLimit) errors.push(`${label}: ${asset.size} байт превышает лимит ${byteLimit}`);

    if (requireChangedMetadata && gate.requireChangedResponsiveMarkup) {
      await validateResponsiveImage({
        src,
        srcset: attribute(tag, "srcset"),
        sizes: attribute(tag, "sizes"),
        baseAsset: asset,
        role: figure.role,
        gate,
        rootDir,
        siteUrl,
        label,
        errors,
      });
    }

    if (figure.role === "route-map") {
      if (!asset.animated) errors.push(`${label}: маршрутная карта должна быть анимированным WebP`);
      if (gate.requireInfiniteAnimatedMapLoop && asset.loopCount !== 0) {
        errors.push(`${label}: анимация должна повторяться непрерывно (loop=0), сейчас loop=${asset.loopCount}`);
      }
      if (gate.requireStaticMapFallback) {
        const fallbackTag = figure.sourceTags.find((source) => /prefers-reduced-motion\s*:\s*reduce/i.test(attribute(source, "media")));
        const fallbackSrcset = fallbackTag ? attribute(fallbackTag, "srcset") : "";
        if (!fallbackTag || !fallbackSrcset) {
          errors.push(`${label}: отсутствует локальный статичный WebP для prefers-reduced-motion`);
        } else if (requireChangedMetadata && gate.requireChangedResponsiveMarkup) {
          let fallbackMasterUrl = "";
          try {
            fallbackMasterUrl = parseSrcsetCandidates(fallbackSrcset).find(({ width }) => width === asset.width)?.url || "";
          } catch {
            // validateResponsiveImage reports the precise parse error below.
          }
          await validateResponsiveImage({
            src: fallbackMasterUrl,
            srcset: fallbackSrcset,
            sizes: "",
            baseAsset: asset,
            role: "static-map-fallback",
            gate,
            rootDir,
            siteUrl,
            label: `${label} prefers-reduced-motion source`,
            errors,
            requireSizes: false,
            requireStatic: true,
          });
        } else {
          const fallbackUrl = fallbackSrcset.split(/\s+/u)[0];
          const fallbackPath = localAssetPath(fallbackUrl, siteUrl);
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
        if (requireChangedMetadata && gate.requireChangedCoverDimensions) {
          if (!Number.isInteger(article.cover.width) || !Number.isInteger(article.cover.height)) {
            errors.push(`${sourceName}: для изменённой статьи обязательны cover.width и cover.height`);
          } else if (article.cover.width !== cover.width || article.cover.height !== cover.height) {
            errors.push(`${sourceName}: cover metadata ${article.cover.width}x${article.cover.height} не равны intrinsic ${cover.width}x${cover.height}`);
          }
          const aspectRatio = cover.width / cover.height;
          if (aspectRatio < gate.minimumChangedCoverAspectRatio || aspectRatio > gate.maximumChangedCoverAspectRatio) {
            errors.push(`${sourceName}: пропорция cover ${aspectRatio.toFixed(2)} вне диапазона ${gate.minimumChangedCoverAspectRatio}-${gate.maximumChangedCoverAspectRatio}`);
          }
        }
        if (requireChangedMetadata && gate.requireChangedResponsiveMarkup) {
          await validateResponsiveImage({
            src: article.cover.url,
            srcset: article.cover.srcset,
            sizes: article.cover.sizes,
            baseAsset: cover,
            role: "cover",
            gate,
            rootDir,
            siteUrl,
            label: `${sourceName}: cover`,
            errors,
          });
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

export async function checkRepositoryVisuals({ rootDir = ROOT_DIR, now = new Date(), forceArticleFiles = [], changedAssetFiles = [] } = {}) {
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
  const forcedArticles = new Set(forceArticleFiles);
  const changedAssets = new Set(changedAssetFiles);
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
    const directlyChanged = forcedArticles.has(sourceName);
    const assetImpacted = articleAssetPaths(article, feedConfig.siteUrl).some((assetPath) => changedAssets.has(assetPath));
    const changeScoped = directlyChanged || assetImpacted;
    if (!isReference && !isFuture && !changeScoped) continue;
    const item = items.get(id);
    if (!item) {
      errors.push(`${sourceName}: не найден элемент очереди ${id} для определения contentFormat`);
      continue;
    }
    if (!gate.applicableFormats.includes(item.contentFormat)) continue;
    const reasons = [
      ...(isReference ? ["reference"] : []),
      ...(isFuture ? ["future"] : []),
      ...(directlyChanged ? ["article-change"] : []),
      ...(assetImpacted ? ["asset-change"] : []),
    ];
    const strict = isFuture || changeScoped;
    const result = await validateArticleVisuals({
      article,
      contentFormat: item.contentFormat,
      gate,
      rootDir,
      siteUrl: feedConfig.siteUrl,
      strict,
      requireChangedMetadata: changeScoped,
      sourceName,
    });
    errors.push(...result.errors);
    checked.push({ sourceName, id, contentFormat: item.contentFormat, reference: isReference, reasons, strict, requireChangedMetadata: changeScoped, ...result.summary });
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
