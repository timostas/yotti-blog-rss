import test from "node:test";
import assert from "node:assert/strict";
import policy from "../config/editorial-policy.json" with { type: "json" };
import queue from "../content/queue.json" with { type: "json" };
import { validateEditorialQueue } from "../scripts/check-editorial-queue.mjs";

function item(overrides = {}) {
  return {
    id: "internet-in-turkey",
    topicKey: "turkey-internet-guide",
    status: "ready",
    locales: ["ru", "en"],
    model: { name: "gpt-5.6-terra", effort: "low" },
    riskReasons: [],
    generationAttempts: { ru: 1, en: 1 },
    qualityRepairAttempts: 0,
    editorialStandardVersion: 2,
    editorialPasses: { ru: 1, en: 1 },
    scores: { utility: 85, originalValue: 82, factSupport: 95 },
    intentMap: {
      primary: { ru: "интернет в Турции", en: "internet in Turkey" },
      cannibalizationDecision: "new-url: отдельное намерение не занято",
    },
    internalContextLinks: ["https://yotti.net/esim/turkey", "https://yotti.net/blog"],
    creative: "assets/covers/internet-in-turkey.jpg",
    creativeConceptKey: "turkey-street-food-at-blue-hour",
    contentFormat: "culture-food-or-local-experience",
    ...overrides,
  };
}

test("текущая редакционная очередь проходит политику", () => {
  const result = validateEditorialQueue(policy, queue);
  assert.deepEqual(result.errors, []);
});

test("политика разрешает естественные позы людей и блокирует открытый багажник", () => {
  assert.equal(policy.creativeStrategy.allowNaturalBackOrThreeQuarterHumanPose, true);
  assert.equal(policy.creativeStrategy.forbidRearOpenTrunkAsPrimaryVehicleComposition, true);
  assert.equal("forbidBackFacingPersonAsPrimarySubject" in policy.creativeStrategy, false);
  assert.equal("forbidRearFacingVehicleAsPrimaryComposition" in policy.creativeStrategy, false);
});

test("technical-first поток разрешает четыре слота и ручные выпуски без потолка", () => {
  assert.equal(policy.production.targetContentUnitsPerDay, null);
  assert.equal(policy.production.maximumPublishedPagesPerDay, null);
  assert.equal(policy.production.frequencyLimitMode, "unlimited_owner_manual_with_four_scheduled_daily_slots");
  assert.equal(policy.production.frequencyLimitEffectiveFrom, "2026-08-22");
  assert.deepEqual(policy.production.dailyPublicationTimes, ["10:00", "10:30", "20:00", "20:30"]);
  assert.deepEqual(policy.production.localesPerUnit, ["ru", "en"]);
});

test("исправления опубликованного материала сразу готовятся к повторной синхронизации", () => {
  assert.equal(policy.production.publishedCorrectionFlow.preserveSlugAndFeedLink, true);
  assert.equal(policy.production.publishedCorrectionFlow.publishImmediatelyAfterValidation, true);
  assert.equal(policy.production.publishedCorrectionFlow.notifyOwnerWhenReadyForResync, true);
  assert.equal(policy.production.publishedCorrectionFlow.versionCoverAssetUrlOnCorrection, true);
  assert.equal(policy.production.publishedCorrectionFlow.resyncBehavior, "update_existing_item_without_duplicate_for_confirmed_text_changes");
  assert.equal(policy.production.publishedCorrectionFlow.existingCoverBehavior, "rss_resync_does_not_refresh_yotti_cover");
  assert.equal(policy.production.publishedCorrectionFlow.coverCorrectionCompletionGate, "verify_yotti_card_or_require_admin_or_importer_fix");
});

test("блокирует нарушение чередования ближайшего плана", () => {
  const plannedPublications = [
    {
      planOrder: 1,
      id: "first-buy-esim-topic",
      countryCode: "FR",
      region: "western-europe",
      planKind: "buy-esim",
      contentFormat: "connectivity-and-esim",
    },
    {
      planOrder: 2,
      id: "second-search-support-topic",
      scope: "global",
      region: "global",
      planKind: "search-support",
      contentFormat: "connectivity-and-esim",
    },
  ];
  plannedPublications[1].planKind = plannedPublications[0].planKind;
  plannedPublications[1].contentFormat = plannedPublications[0].contentFormat;
  const result = validateEditorialQueue(policy, { schemaVersion: 1, items: [], plannedPublications });
  assert.match(result.errors.join("\n"), /нарушено обязательное чередование/);
});

test("принимает готовую двуязычную единицу", () => {
  const result = validateEditorialQueue(policy, { schemaVersion: 1, items: [item()] });
  assert.deepEqual(result.errors, []);
});

test("блокирует слабый материал и лишнюю попытку", () => {
  const result = validateEditorialQueue(policy, { schemaVersion: 1, items: [item({
    generationAttempts: { ru: 3, en: 1 },
    scores: { utility: 70, originalValue: 60, factSupport: 70 },
  })] });
  assert.match(result.errors.join("\n"), /лимит генераций.*недостаточная полезность.*недостаточная оригинальная.*недостаточная поддержка/s);
});

test("разрешает Sol для ежедневной редакторской работы", () => {
  const result = validateEditorialQueue(policy, { schemaVersion: 1, items: [item({
    model: { name: "gpt-5.6-sol", effort: "high" },
  })] });
  assert.deepEqual(result.errors, []);
});

test("блокирует готовый материал без отдельного редакторского прохода", () => {
  const candidate = item();
  delete candidate.editorialPasses;
  const result = validateEditorialQueue(policy, { schemaVersion: 1, items: [candidate] });
  assert.match(result.errors.join("\n"), /редакторский проход для ru.*редакторский проход для en/s);
});

test("блокирует готовый материал без карты интента и внутренних переходов", () => {
  const candidate = item();
  delete candidate.intentMap;
  delete candidate.internalContextLinks;
  const result = validateEditorialQueue(policy, { schemaVersion: 1, items: [candidate] });
  assert.match(result.errors.join("\n"), /intentMap\.primary\.ru.*intentMap\.primary\.en.*cannibalizationDecision.*внутренние ссылки/s);
});

test("не разрешает повторять концепцию обложки", () => {
  const result = validateEditorialQueue(policy, { schemaVersion: 1, items: [
    item(),
    item({ id: "second-topic", topicKey: "second-topic" }),
  ] });
  assert.match(result.errors.join("\n"), /концепция обложки повторяется/);
});

test("блокирует превышение дневного потолка", () => {
  const limitedPolicy = structuredClone(policy);
  limitedPolicy.production.targetContentUnitsPerDay = 5;
  const items = Array.from({ length: 6 }, (_, index) => item({
    id: `topic-${index}`,
    topicKey: `topic-${index}`,
    creativeConceptKey: `concept-${index}`,
    status: "scheduled",
    schedule: { ru: "2026-09-01T07:00:00Z", en: "2026-09-01T10:00:00Z" },
  }));
  const result = validateEditorialQueue(limitedPolicy, { schemaVersion: 1, items });
  assert.match(result.errors.join("\n"), /запланировано 6 единиц при лимите 5/);
});
