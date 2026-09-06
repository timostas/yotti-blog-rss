import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArticle } from "../scripts/build-feed.mjs";
import {
  articleAssetPaths,
  checkRepositoryVisuals,
  localAssetPath,
  parseSrcsetCandidates,
  validateArticleVisuals,
} from "../scripts/check-article-visuals.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_URL = "https://timostas.github.io/yotti-blog-rss";
const policy = JSON.parse(await readFile(join(ROOT, "config", "editorial-policy.json"), "utf8"));
const gate = policy.quality.longFormVisualGates;
const sourcePath = "articles/new-zealand-south-island-slow-road-ru.md";
const source = await readFile(join(ROOT, sourcePath), "utf8");
const baseline = parseArticle(source, sourcePath, SITE_URL);

function fakeWebp(width, height) {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

function fakeAnimatedWebp(width, height) {
  const buffer = Buffer.alloc(44);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  buffer[20] = 0x02;
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  buffer.write("ANIM", 30, "ascii");
  buffer.writeUInt32LE(6, 34);
  buffer.writeUInt16LE(0, 42);
  return buffer;
}

async function createResponsiveSet(rootDir, name, width, height, { animatedMaster = false } = {}) {
  const candidates = [384, 720, 960, width];
  for (const candidateWidth of candidates) {
    const candidateHeight = Math.round(height * candidateWidth / width);
    const suffix = candidateWidth === width ? "" : `-${candidateWidth}w`;
    const content = animatedMaster && candidateWidth === width
      ? fakeAnimatedWebp(candidateWidth, candidateHeight)
      : fakeWebp(candidateWidth, candidateHeight);
    await writeFile(join(rootDir, "assets", "test", `${name}${suffix}.webp`), content);
  }
  const url = `${SITE_URL}/assets/test/${name}.webp`;
  const srcset = candidates.map((candidateWidth) => `${SITE_URL}/assets/test/${name}${candidateWidth === width ? "" : `-${candidateWidth}w`}.webp ${candidateWidth}w`).join(", ");
  return { url, srcset };
}

async function responsiveFixture() {
  const rootDir = await mkdtemp(join(tmpdir(), "yotti-responsive-"));
  await mkdir(join(rootDir, "assets", "test"), { recursive: true });
  const cover = await createResponsiveSet(rootDir, "cover", 1600, 900);
  const inline = [];
  for (let index = 1; index <= 6; index += 1) inline.push(await createResponsiveSet(rootDir, `inline-${index}`, 1440, 900));
  const body = inline.map((item, index) => `<figure class="${index < 2 ? "yotti-photo" : "yotti-information-graphic"}">
  <img src="${item.url}" srcset="${item.srcset}" sizes="(max-width: 760px) calc(100vw - 56px), 760px" width="1440" height="900"${index === 0 ? "" : ' loading="lazy"'} decoding="async" alt="Уникальный визуал ${index + 1}">
  <figcaption>Редакционная подпись ${index + 1}</figcaption>
</figure>`).join("\n");
  return {
    rootDir,
    article: {
      ...baseline,
      cover: { ...baseline.cover, type: "image/webp", url: cover.url, width: 1600, height: 900, srcset: cover.srcset, sizes: "(max-width: 760px) calc(100vw - 56px), 760px", alt: "Уникальная обложка" },
      body,
    },
  };
}

async function reducedMotionFixture() {
  const rootDir = await mkdtemp(join(tmpdir(), "yotti-reduced-motion-"));
  await mkdir(join(rootDir, "assets", "test"), { recursive: true });
  const cover = await createResponsiveSet(rootDir, "route-cover", 1600, 900);
  const roles = ["yotti-photo", "yotti-photo", "yotti-photo", "yotti-information-graphic", "yotti-information-graphic"];
  const inline = [];
  for (let index = 0; index < roles.length; index += 1) {
    inline.push(await createResponsiveSet(rootDir, `route-inline-${index + 1}`, 1440, roles[index] === "yotti-photo" ? 960 : 900));
  }
  const route = await createResponsiveSet(rootDir, "route-map-animated", 1440, 900, { animatedMaster: true });
  const fallback = await createResponsiveSet(rootDir, "route-map-static", 1440, 900);
  const figures = inline.map((item, index) => `<figure class="${roles[index]}">
  <img src="${item.url}" srcset="${item.srcset}" sizes="(max-width: 760px) calc(100vw - 56px), 760px" width="1440" height="${roles[index] === "yotti-photo" ? 960 : 900}"${index === 0 ? "" : ' loading="lazy"'} decoding="async" alt="Уникальный маршрутный визуал ${index + 1}">
  <figcaption>Редакционная подпись ${index + 1}</figcaption>
</figure>`);
  figures.push(`<figure class="yotti-route-map">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="${fallback.srcset}">
    <img src="${route.url}" srcset="${route.srcset}" sizes="(max-width: 760px) calc(100vw - 56px), 760px" width="1440" height="900" loading="lazy" decoding="async" alt="Уникальная карта маршрута">
  </picture>
  <figcaption>Маршрут и статичный резерв.</figcaption>
</figure>`);
  return {
    rootDir,
    article: {
      ...baseline,
      cover: { ...baseline.cover, type: "image/webp", url: cover.url, width: 1600, height: 900, srcset: cover.srcset, sizes: "(max-width: 760px) calc(100vw - 56px), 760px", alt: "Уникальная маршрутная обложка" },
      body: figures.join("\n"),
    },
  };
}

function futureReadyArticle() {
  return {
    ...baseline,
    publishedAt: new Date(gate.effectiveFrom),
    body: baseline.body
      .replace(/(<img src="[^"]*new-zealand-route-plan-ru-v5\.webp")/, '$1 loading="lazy"')
      .replace(/(<img src="[^"]*new-zealand-booking-plan-ru-v5\.webp")/, '$1 loading="lazy"')
      .replace(/<img\b(?![^>]*\bdecoding=)/g, '<img decoding="async"'),
  };
}

test("универсальный визуальный шлюз проверяет обе эталонные локали", async () => {
  const report = await checkRepositoryVisuals({ rootDir: ROOT });
  assert.deepEqual(report.errors, []);
  assert.ok(report.checked.length >= 2);
  assert.deepEqual(
    report.checked.filter((item) => item.reference).map((item) => item.sourceName).sort(),
    [
      "articles/new-zealand-south-island-slow-road-en.md",
      "articles/new-zealand-south-island-slow-road-ru.md",
    ],
  );
  assert.ok(report.checked.every((item) => item.totalImages === 7));
  assert.ok(report.checked.every((item) => item.totalBytes < gate.maximumTotalImageBytesIncludingCover));
});

test("будущая статья проходит только с семью WebP и ленивой загрузкой внутренних материалов", async () => {
  const result = await validateArticleVisuals({
    article: futureReadyArticle(),
    contentFormat: "route-or-itinerary",
    gate,
    rootDir: ROOT,
    siteUrl: SITE_URL,
    strict: true,
    sourceName: "future-route-ru.md",
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.summary.totalImages, 7);
  assert.equal(result.summary.eagerInlineImages, 1);
});

test("будущая статья блокируется при нехватке изображения", async () => {
  const article = futureReadyArticle();
  article.body = article.body.replace(/<figure class="yotti-photo">[\s\S]*?<\/figure>/, "");
  const result = await validateArticleVisuals({
    article,
    contentFormat: "route-or-itinerary",
    gate,
    rootDir: ROOT,
    siteUrl: SITE_URL,
    strict: true,
    sourceName: "future-route-ru.md",
  });
  assert.match(result.errors.join("\n"), /ровно 6 встроенных изображений.*ровно 7 изображений.*contextualPhotos=2/s);
});

test("будущая статья блокируется с PNG-обложкой и лишней eager-загрузкой", async () => {
  const article = futureReadyArticle();
  article.cover = { ...article.cover, type: "image/png", url: article.cover.url.replace(/\.webp$/, ".png") };
  article.body = article.body.replace(/ loading="lazy"/g, "");
  const result = await validateArticleVisuals({
    article,
    contentFormat: "route-or-itinerary",
    gate,
    rootDir: ROOT,
    siteUrl: SITE_URL,
    strict: true,
    sourceName: "future-route-ru.md",
  });
  assert.match(result.errors.join("\n"), /loading="lazy".*локальным image\/webp/s);
});

test("будущая статья блокируется без асинхронного декодирования", async () => {
  const article = futureReadyArticle();
  article.body = article.body.replace(' decoding="async"', "");
  const result = await validateArticleVisuals({
    article,
    contentFormat: "route-or-itinerary",
    gate,
    rootDir: ROOT,
    siteUrl: SITE_URL,
    strict: true,
    sourceName: "future-route-ru.md",
  });
  assert.match(result.errors.join("\n"), /требуется decoding="async"/);
});

test("local asset и srcset helpers отвергают traversal, external и x descriptors", () => {
  assert.equal(
    localAssetPath("https://timostas.github.io/yotti-blog-rss/assets/inline/a.webp", SITE_URL),
    "assets/inline/a.webp",
  );
  for (const value of [
    "https://example.com/assets/a.webp",
    "https://timostas.github.io/yotti-blog-rss/%2e%2e/a.webp",
    "https://timostas.github.io/yotti-blog-rss/assets/%5cetc.webp",
    "https://user@timostas.github.io/yotti-blog-rss/assets/a.webp",
  ]) assert.equal(localAssetPath(value, SITE_URL), null);
  assert.deepEqual(parseSrcsetCandidates("https://example.com/a.webp 384w, https://example.com/b.webp 1440w"), [
    { url: "https://example.com/a.webp", width: 384 },
    { url: "https://example.com/b.webp", width: 1440 },
  ]);
  assert.throws(() => parseSrcsetCandidates("https://example.com/a.webp 1x"), /width descriptor/);
  assert.throws(() => parseSrcsetCandidates("https://example.com/a.webp 384w, https://example.com/b.webp 384w"), /повторяющиеся/);
});

test("прямое изменение legacy article включает exact-seven gate", async () => {
  const sourceName = "articles/esim-internet-not-working-ru.md";
  const report = await checkRepositoryVisuals({ rootDir: ROOT, forceArticleFiles: [sourceName] });
  const item = report.checked.find((entry) => entry.sourceName === sourceName);
  assert.ok(item?.reasons.includes("article-change"));
  assert.equal(item?.requireChangedMetadata, true);
  assert.match(report.errors.join("\n"), /ровно 6 встроенных изображений/);
});

test("изменение используемого cover включает все referring article files", async () => {
  const ruName = "articles/esim-internet-not-working-ru.md";
  const enName = "articles/esim-internet-not-working-en.md";
  const ru = parseArticle(await readFile(join(ROOT, ruName), "utf8"), ruName, SITE_URL);
  const coverPath = articleAssetPaths(ru, SITE_URL)[0];
  const report = await checkRepositoryVisuals({ rootDir: ROOT, changedAssetFiles: [coverPath] });
  const selected = report.checked.filter((entry) => entry.reasons.includes("asset-change")).map((entry) => entry.sourceName);
  assert.ok(selected.includes(ruName));
  if (articleAssetPaths(parseArticle(await readFile(join(ROOT, enName), "utf8"), enName, SITE_URL), SITE_URL).includes(coverPath)) {
    assert.ok(selected.includes(enName));
  }
});

test("changed article принимает responsive derivatives как семь логических изображений", async (context) => {
  const fixture = await responsiveFixture();
  context.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  const result = await validateArticleVisuals({
    article: fixture.article,
    contentFormat: "connectivity-and-esim",
    gate,
    rootDir: fixture.rootDir,
    siteUrl: SITE_URL,
    strict: true,
    requireChangedMetadata: true,
    sourceName: "responsive-ru.md",
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.summary.totalImages, 7);
  assert.equal(result.summary.totalBytes, 210);
});

test("changed article блокирует malformed srcset и отсутствующий sizes", async (context) => {
  const fixture = await responsiveFixture();
  context.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  fixture.article.body = fixture.article.body
    .replace(/ srcset="[^"]+"/u, ' srcset="https://example.com/a.webp 1x"')
    .replace(/ sizes="[^"]+"/u, "");
  const result = await validateArticleVisuals({
    article: fixture.article,
    contentFormat: "connectivity-and-esim",
    gate,
    rootDir: fixture.rootDir,
    siteUrl: SITE_URL,
    strict: true,
    requireChangedMetadata: true,
    sourceName: "responsive-ru.md",
  });
  assert.match(result.errors.join("\n"), /корректный sizes/);
  assert.match(result.errors.join("\n"), /width descriptor/);
});

test("только первый inline-визуал может загружаться без lazy", async (context) => {
  const fixture = await responsiveFixture();
  context.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  fixture.article.body = fixture.article.body
    .replace(/(<img[^>]+inline-1\.webp[^>]+)( decoding="async")/u, '$1 loading="lazy"$2')
    .replace(/(<img[^>]+inline-2\.webp[^>]+) loading="lazy"/u, "$1");
  const result = await validateArticleVisuals({
    article: fixture.article,
    contentFormat: "connectivity-and-esim",
    gate,
    rootDir: fixture.rootDir,
    siteUrl: SITE_URL,
    strict: true,
    requireChangedMetadata: true,
    sourceName: "lazy-order-ru.md",
  });
  assert.equal(result.summary.eagerInlineImages, 1);
  assert.match(result.errors.join("\n"), /img 2: после первого inline-визуала требуется loading="lazy"/u);
});

test("changed article блокирует srcset без обязательной responsive-ширины", async (context) => {
  const fixture = await responsiveFixture();
  context.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  fixture.article.body = fixture.article.body.replace(
    `, ${SITE_URL}/assets/test/inline-1-720w.webp 720w`,
    "",
  );
  const result = await validateArticleVisuals({
    article: fixture.article,
    contentFormat: "connectivity-and-esim",
    gate,
    rootDir: fixture.rootDir,
    siteUrl: SITE_URL,
    strict: true,
    requireChangedMetadata: true,
    sourceName: "missing-720w-ru.md",
  });
  assert.match(result.errors.join("\n"), /ровно width-кандидаты 384w, 720w, 960w, 1440w.*найдено 384w, 960w, 1440w/s);
});

test("reduced-motion source проверяет каждый srcset-кандидат", async (context) => {
  const fixture = await reducedMotionFixture();
  context.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  const valid = await validateArticleVisuals({
    article: fixture.article,
    contentFormat: "route-or-itinerary",
    gate,
    rootDir: fixture.rootDir,
    siteUrl: SITE_URL,
    strict: true,
    requireChangedMetadata: true,
    sourceName: "route-responsive-ru.md",
  });
  assert.deepEqual(valid.errors, []);

  fixture.article.body = fixture.article.body.replace(
    `${SITE_URL}/assets/test/route-map-static-720w.webp 720w`,
    `${SITE_URL}/assets/test/route-map-static-broken-720w.webp 720w`,
  );
  const broken = await validateArticleVisuals({
    article: fixture.article,
    contentFormat: "route-or-itinerary",
    gate,
    rootDir: fixture.rootDir,
    siteUrl: SITE_URL,
    strict: true,
    requireChangedMetadata: true,
    sourceName: "route-responsive-ru.md",
  });
  assert.match(broken.errors.join("\n"), /prefers-reduced-motion source srcset 720w.*route-map-static-broken-720w\.webp/s);
});
