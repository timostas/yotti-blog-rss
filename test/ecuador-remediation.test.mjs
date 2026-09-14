import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseArticle, createArticleHtml } from '../scripts/build-feed.mjs';
import { inspectWebp } from '../scripts/check-article-visuals.mjs';

const root = new URL('../', import.meta.url);
const id = 'buy-esim-ecuador-quito-galapagos';
for (const locale of ['ru', 'en']) {
  test(`Ecuador ${locale}: stable identity and source-readable correction`, async () => {
    const source = await readFile(new URL(`articles/${id}-${locale}.md`, root), 'utf8');
    const article = parseArticle(source, `${id}-${locale}.md`);
    assert.equal(article.slug, `${id}-${locale}`);
    assert.equal(article.publishedAt.toISOString(), '2026-09-13T14:22:00.000Z');
    const previousRevision = new Date(locale === 'ru' ? '2026-09-14T05:07:28.000Z' : '2026-09-14T04:21:39.000Z');
    assert.ok(article.editorial.modifiedAt > previousRevision, 'literary revision has a later modifiedAt, not a new publishedAt');
    const queue = JSON.parse(await readFile(new URL('content/queue.json', root), 'utf8'));
    const revision = queue.items.find(item => item.id === id).qualityNotes.literaryRevision;
    assert.equal(article.editorial.modifiedAt.toISOString(), revision.modifiedAt);
    assert.equal((source.match(/<figure /g) || []).length, 6);
    assert.match(source, /prefers-reduced-motion: reduce/);
    assert.match(source, /galapagos\.gob\.ec/);
    assert.match(source, /support\.google\.com\/maps/);
    assert.doesNotMatch(source, /<\/(?:strong|a|em)>[\p{L}\p{N}]/u);
  });

  test(`Ecuador ${locale}: every animation candidate loops and has a static alternative`, async () => {
    for (const width of [384, 720, 960, 1200]) {
      const suffix = width === 1200 ? '' : `-${width}w`;
      const paths = ['activation', 'activation-static'].map(name =>
        new URL(`assets/inline/ecuador-v2-${name}-${locale}${suffix}.webp`, root));
      const buffers = await Promise.all(paths.map(p => readFile(p)));
      const [animated, still] = buffers.map(b => inspectWebp(b));
      assert.equal(animated.width, width);
      assert.equal(still.width, width);
      assert.equal(animated.height, still.height);
      assert.equal(animated.animated, true);
      assert.equal(animated.loopCount, 0);
      assert.equal(still.animated, false);
      for (const buffer of buffers) assert.ok(buffer.length <= 102400);
      let duration = 0, frames = 0;
      const buffer = buffers[0];
      for (let p = 12; p + 8 <= buffer.length;) {
        const type = buffer.toString('ascii', p, p + 4);
        const size = buffer.readUInt32LE(p + 4);
        if (type === 'ANMF') { frames++; duration += buffer.readUIntLE(p + 20, 3); }
        p += 8 + size + (size % 2);
      }
      assert.equal(frames, 4);
      assert.equal(duration, 12000);
    }
  });
}

test('information graphics avoid default 40px figure margins in technical preview', async () => {
  const source = await readFile(new URL(`articles/${id}-ru.md`, root), 'utf8');
  const config = JSON.parse(await readFile(new URL('feed.config.json', root), 'utf8'));
  const html = createArticleHtml({siteUrl:config.siteUrl,...config.feeds[0]}, parseArticle(source));
  assert.match(html, /\.yotti-information-graphic\{margin:28px 0\}/);
});

test('Ecuador post-sync: known canonical EN URL and accurate RU arrival alt', async () => {
  const queue = JSON.parse(await readFile(new URL('content/queue.json', root), 'utf8'));
  const item = queue.items.find(item => item.id === id);
  assert.equal(item.publicUrls.en, 'https://yotti.net/en/blog/ecuador/buy-an-esim-for-ecuador-connectivity-in-quito-and-the-gal-pagos');
  const source = await readFile(new URL(`articles/${id}-ru.md`, root), 'utf8');
  assert.match(source, /город Пуэрто-Бакерисо-Морено находится на том же острове/);
  assert.doesNotMatch(source, /прибытие на остров Пуэрто-Бакерисо-Морено/);
});
