#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const PILOT_URLS = {
  ru: "https://yotti.net/blog/esim-vidit-set-no-internet-ne-rabotaet-gde-iskat-prichinu",
  en: "https://yotti.net/en/blog/esim-has-signal-but-no-internet-what-to-check",
};

function reason(code, message) {
  return { code, message };
}

export function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)) {
    attributes[match[1].toLowerCase()] = match[3];
  }
  return attributes;
}

function findCanonical(html) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    if ((attributes.rel ?? "").toLowerCase() === "canonical") {
      return attributes.href;
    }
  }
  return undefined;
}

function articleMarkup(html) {
  return html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
}

function tags(markup, name) {
  return [...markup.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

export function inspectHtml(html, expectedUrl) {
  const reasons = [];
  const add = (code, message) => reasons.push(reason(code, message));
  const canonical = findCanonical(html);

  if (!canonical) add("CANONICAL_MISSING", "canonical link is missing");
  else if (canonical !== expectedUrl) add("CANONICAL_MISMATCH", `canonical=${canonical}`);

  const article = articleMarkup(html);
  if (!article) {
    add("ARTICLE_MISSING", "article element is missing");
    return reasons;
  }

  const images = tags(article, "img").map(parseAttributes);
  const figures = tags(article, "figure");
  const captions = tags(article, "figcaption");

  if (images.length !== 7) add("IMAGE_COUNT", `expected 7 article images, found ${images.length}`);
  if (figures.length !== 6) add("FIGURE_COUNT", `expected 6 inline figures, found ${figures.length}`);
  if (captions.length !== 6) add("CAPTION_COUNT", `expected 6 inline captions, found ${captions.length}`);

  images.forEach((attributes, index) => {
    const label = index === 0 ? "cover" : `inline ${index}`;
    if (!(attributes.alt ?? "").trim()) add("ALT_MISSING", `${label} alt is empty`);
    if (!attributes.srcset) add("RESPONSIVE_SRCSET_MISSING", `${label} srcset is missing`);
    if (!attributes.sizes) add("RESPONSIVE_SIZES_MISSING", `${label} sizes is missing`);
    if (!attributes.width || !attributes.height) add("DIMENSIONS_MISSING", `${label} dimensions are missing`);

    if (index === 0) {
      if (attributes.loading === "lazy") add("COVER_LAZY", "cover must not be lazy");
      if (attributes.fetchpriority !== "high") {
        add("COVER_FETCHPRIORITY", "cover fetchpriority=high is required");
      }
      return;
    }

    if (attributes.decoding !== "async") {
      add("INLINE_DECODING", `${label} decoding=async is required`);
    }
    if (index >= 2 && attributes.loading !== "lazy") {
      add("INLINE_LAZY", `${label} loading=lazy is required`);
    }
  });

  return reasons;
}

export async function checkUrl(locale, url, fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(30_000),
    });
    const html = await response.text();
    const reasons = [];

    if (response.status !== 200) reasons.push(reason("HTTP_STATUS", `HTTP ${response.status}`));
    if (response.url !== url) reasons.push(reason("FINAL_URL_MISMATCH", `final=${response.url}`));
    if (!(response.headers?.get?.("content-type") ?? "").includes("text/html")) {
      reasons.push(reason("CONTENT_TYPE", "response is not text/html"));
    }
    reasons.push(...inspectHtml(html, url));

    return { locale, url, state: reasons.length ? "FAIL" : "PASS", reasons };
  } catch (error) {
    return {
      locale,
      url,
      state: "UNAVAILABLE",
      reasons: [reason("FETCH_UNAVAILABLE", error instanceof Error ? error.message : String(error))],
    };
  }
}

export function overallState(results) {
  if (results.some((result) => result.state === "FAIL")) return "FAIL";
  if (results.some((result) => result.state === "UNAVAILABLE")) return "UNAVAILABLE";
  return "PASS";
}

async function main() {
  const fixtureIndex = process.argv.indexOf("--fixture");
  if (fixtureIndex !== -1) {
    const fixturePath = process.argv[fixtureIndex + 1];
    if (!fixturePath) throw new Error("--fixture requires a file path");
    const html = await readFile(fixturePath, "utf8");
    const reasons = inspectHtml(html, PILOT_URLS.ru);
    const output = { state: reasons.length ? "FAIL" : "PASS", reasons };
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = output.state === "PASS" ? 0 : 1;
    return;
  }

  const results = await Promise.all(
    Object.entries(PILOT_URLS).map(([locale, url]) => checkUrl(locale, url)),
  );
  const output = { state: overallState(results), results };
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = output.state === "PASS" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
