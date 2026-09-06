import { marked } from "marked";

function visibleText(value) {
  return String(value ?? "").replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim();
}

function htmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "iu"));
  return match ? (match[1] ?? match[2] ?? match[3] ?? "").trim() : "";
}

export function extractBodyLinks(markdownBody) {
  const links = [];
  const walk = (tokens) => {
    let htmlLink = null;
    for (const token of tokens ?? []) {
      if (!token) continue;
      if (token.type === "html" && /^<a\b/iu.test(token.raw ?? token.text ?? "")) {
        htmlLink = { href: htmlAttribute(token.raw ?? token.text, "href"), anchor: "" };
        continue;
      }
      if (token.type === "html" && /^<\/a\s*>/iu.test(token.raw ?? token.text ?? "") && htmlLink) {
        links.push({ ...htmlLink, anchor: visibleText(htmlLink.anchor) });
        htmlLink = null;
        continue;
      }
      if (htmlLink) {
        if (!["code", "codespan", "image"].includes(token.type)) htmlLink.anchor += ` ${token.text ?? token.raw ?? ""}`;
        continue;
      }
      if (["code", "codespan", "image"].includes(token.type)) continue;
      if (token.type === "link") {
        links.push({ href: token.href, anchor: visibleText(token.text) });
        continue;
      }
      if (token.type === "html") {
        for (const match of String(token.raw ?? token.text ?? "").matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/giu)) {
          links.push({ href: htmlAttribute(match[1], "href"), anchor: visibleText(match[2]) });
        }
        continue;
      }
      if (Array.isArray(token.tokens)) walk(token.tokens);
      if (Array.isArray(token.items)) walk(token.items);
      if (Array.isArray(token.rows)) walk(token.rows.flat());
    }
  };
  walk(marked.lexer(String(markdownBody ?? "")));
  return links.filter(({ href }) => href);
}

export function normalizeYottiArticleUrl(rawUrl, locale, gate) {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "" || rawUrl.trim().startsWith("#")) return null;
  if (/[\\\0]/u.test(rawUrl) || /%(?:00|23|2e|2f|3f|5c)/iu.test(rawUrl)) {
    throw new Error(`небезопасный URL: ${rawUrl}`);
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`внутренняя ссылка должна быть абсолютным HTTPS URL: ${rawUrl}`);
  }
  const allowedHosts = new Set(gate.allowedHosts ?? ["yotti.net", "www.yotti.net"]);
  if (!allowedHosts.has(url.hostname.toLowerCase())) return null;
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error(`внутренняя ссылка должна быть HTTPS без credentials и port: ${rawUrl}`);
  }
  if (url.search || url.hash) {
    throw new Error(`внутренняя ссылка не должна содержать query или fragment: ${rawUrl}`);
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname).replace(/\/{2,}/gu, "/").replace(/\/$/u, "") || "/";
  } catch {
    throw new Error(`URL содержит некорректное percent-encoding: ${rawUrl}`);
  }
  const expectedPrefix = gate.localeArticlePathPrefixes?.[locale];
  if (!expectedPrefix) throw new Error(`неизвестная locale для внутренних ссылок: ${locale}`);
  const otherPrefixes = Object.entries(gate.localeArticlePathPrefixes ?? {})
    .filter(([key]) => key !== locale)
    .map(([, prefix]) => prefix);
  if (otherPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    throw new Error(`ссылка ведёт на статью другой locale: ${rawUrl}`);
  }
  if (!pathname.startsWith(expectedPrefix)) {
    return null;
  }
  const remainder = pathname.slice(expectedPrefix.length).replace(/^\/+|\/+$/gu, "");
  if (!remainder) return null;
  const firstSegment = remainder.split("/")[0].toLowerCase();
  if (new Set(gate.excludedFirstSegments ?? []).has(firstSegment)) return null;
  const serializedRemainder = remainder.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `https://yotti.net${expectedPrefix}${serializedRemainder}`;
}

function normalizedAnchor(value) {
  return visibleText(value)
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function isUrlAnchor(value) {
  const anchor = visibleText(value);
  if (/^www\./iu.test(anchor)) return true;
  try {
    const url = new URL(anchor);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateSemanticArticleLinks({ article, queueItem, gate, sourceName = "article.md" }) {
  const errors = [];
  const warnings = [];
  const locale = article.language;
  const semanticClass = queueItem?.semanticLinkClass;
  if (!queueItem) {
    return { errors: [`${sourceName}: не найден элемент content/queue.json`], warnings, summary: { semanticLinkClass: "UNKNOWN", uniqueCount: 0 } };
  }
  if (!(gate.allowedClasses ?? []).includes(semanticClass)) {
    errors.push(`${sourceName}: semanticLinkClass должен быть одним из ${(gate.allowedClasses ?? []).join(", ")}`);
  }
  if (semanticClass === "focused-technical" && !(gate.focusedTechnicalAllowedFormats ?? []).includes(queueItem.contentFormat)) {
    errors.push(`${sourceName}: focused-technical запрещён для contentFormat ${queueItem.contentFormat ?? "UNKNOWN"}`);
  }

  let publicUrl = null;
  try {
    const rawPublicUrl = queueItem.publicUrls?.[locale];
    publicUrl = normalizeYottiArticleUrl(rawPublicUrl, locale, gate);
    if (!publicUrl) errors.push(`${sourceName}: требуется publicUrls.${locale} для detail-страницы Yotti Blog`);
  } catch (error) {
    errors.push(`${sourceName}: publicUrls.${locale}: ${error.message}`);
  }

  const metadataValues = queueItem.internalArticleLinks?.[locale];
  const metadataSet = new Set();
  if (!Array.isArray(metadataValues)) {
    errors.push(`${sourceName}: internalArticleLinks.${locale} должен быть массивом`);
  } else {
    for (const value of metadataValues) {
      try {
        const normalized = normalizeYottiArticleUrl(value, locale, gate);
        if (!normalized) errors.push(`${sourceName}: metadata-ссылка не является detail-страницей Yotti Blog: ${value}`);
        else if (normalized === publicUrl) errors.push(`${sourceName}: metadata содержит self-link ${value}`);
        else if (metadataSet.has(normalized)) errors.push(`${sourceName}: metadata содержит повторную цель ${value}`);
        else metadataSet.add(normalized);
      } catch (error) {
        errors.push(`${sourceName}: internalArticleLinks.${locale}: ${error.message}`);
      }
    }
  }

  const bodySet = new Set();
  const generic = new Set((gate.genericAnchors?.[locale] ?? []).map(normalizedAnchor));
  for (const { href, anchor } of extractBodyLinks(article.body)) {
    let normalized;
    try {
      normalized = normalizeYottiArticleUrl(href, locale, gate);
    } catch (error) {
      errors.push(`${sourceName}: ${error.message}`);
      continue;
    }
    if (!normalized) continue;
    if (normalized === publicUrl) {
      errors.push(`${sourceName}: body содержит self-link ${href}`);
      continue;
    }
    if (!anchor || isUrlAnchor(anchor) || generic.has(normalizedAnchor(anchor))) {
      errors.push(`${sourceName}: ссылка ${href} должна иметь содержательный anchor`);
    }
    bodySet.add(normalized);
  }

  for (const url of metadataSet) {
    if (!bodySet.has(url)) errors.push(`${sourceName}: metadata-ссылка отсутствует в body: ${url}`);
  }
  for (const url of bodySet) {
    if (!metadataSet.has(url)) errors.push(`${sourceName}: body-ссылка отсутствует в metadata: ${url}`);
  }

  const minimum = gate.minimumByClass?.[semanticClass];
  if (Number.isInteger(minimum) && bodySet.size < minimum) {
    errors.push(`${sourceName}: для ${semanticClass} требуется минимум ${minimum} смысловых ссылок на другие статьи; найдено ${bodySet.size}`);
  }
  if (Number.isInteger(minimum) && bodySet.size >= minimum && bodySet.size < gate.advisoryTargetMinimum) {
    warnings.push(`${sourceName}: ${bodySet.size} ссылки проходят hard minimum, редакционная цель — ${gate.advisoryTargetMinimum}–${gate.advisoryTargetMaximum}`);
  }
  if (bodySet.size > gate.advisoryTargetMaximum) {
    warnings.push(`${sourceName}: ${bodySet.size} ссылок выше редакционной цели ${gate.advisoryTargetMinimum}–${gate.advisoryTargetMaximum}; это не hard defect`);
  }

  return {
    errors,
    warnings,
    summary: {
      semanticLinkClass: semanticClass ?? "UNKNOWN",
      uniqueCount: bodySet.size,
      requiredMinimum: Number.isInteger(minimum) ? minimum : "UNKNOWN",
      publicUrl: publicUrl ?? "UNKNOWN",
      bodyUrls: [...bodySet].sort(),
      metadataUrls: [...metadataSet].sort(),
    },
  };
}
