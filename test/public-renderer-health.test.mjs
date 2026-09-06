import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  checkUrl,
  inspectHtml,
  overallState,
  parseAttributes,
  PILOT_URLS,
} from "../scripts/check-public-renderer-health.mjs";

const passFixture = fileURLToPath(new URL("fixtures/public-renderer/pass.html", import.meta.url));
const failFixture = fileURLToPath(new URL("fixtures/public-renderer/current-fail.html", import.meta.url));

test("fixture passes the structural renderer gate", async () => {
  const reasons = inspectHtml(await readFile(passFixture, "utf8"), PILOT_URLS.ru);
  assert.deepEqual(reasons, []);
});

test("unrelated images outside article do not affect exact-seven count", async () => {
  const html = `${await readFile(passFixture, "utf8")}<img src="/decor.svg" alt="">`;
  assert.deepEqual(inspectHtml(html, PILOT_URLS.ru), []);
});

test("attribute parsing keeps apostrophes inside double-quoted alt text", () => {
  const attributes = parseAttributes(`<img alt="A traveller's phone" width="1440">`);
  assert.equal(attributes.alt, "A traveller's phone");
});

test("current public shape fails with actionable reason codes", async () => {
  const reasons = inspectHtml(await readFile(failFixture, "utf8"), PILOT_URLS.ru);
  const codes = new Set(reasons.map(({ code }) => code));

  assert.ok(codes.has("RESPONSIVE_SRCSET_MISSING"));
  assert.ok(codes.has("RESPONSIVE_SIZES_MISSING"));
  assert.ok(codes.has("COVER_FETCHPRIORITY"));
  assert.ok(codes.has("INLINE_DECODING"));
  assert.ok(codes.has("INLINE_LAZY"));
});

test("fetch failure is UNAVAILABLE and cannot pass the pair", async () => {
  const result = await checkUrl("ru", PILOT_URLS.ru, async () => {
    throw new Error("network unavailable");
  });

  assert.equal(result.state, "UNAVAILABLE");
  assert.equal(result.reasons[0].code, "FETCH_UNAVAILABLE");
  assert.equal(overallState([{ state: "PASS" }, result]), "UNAVAILABLE");
});

test("a confirmed FAIL is the overall state even if another locale is unavailable", () => {
  assert.equal(overallState([{ state: "UNAVAILABLE" }, { state: "FAIL" }]), "FAIL");
});
