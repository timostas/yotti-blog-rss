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

test("смешанный поток разрешает четыре слота и не более одной connectivity-единицы", () => {
  assert.equal(policy.production.targetContentUnitsPerDay, null);
  assert.equal(policy.production.maximumPublishedPagesPerDay, null);
  assert.equal(policy.production.scheduledContentUnitsPerDay, 4);
  assert.equal(policy.production.scheduledPagesPerDay, 8);
  assert.equal(policy.production.frequencyLimitMode, "unlimited_owner_manual_with_four_scheduled_daily_slots");
  assert.equal(policy.production.frequencyLimitEffectiveFrom, "2026-08-22");
  assert.deepEqual(policy.production.dailyPublicationTimes, ["10:00", "10:30", "20:00", "20:30"]);
  assert.deepEqual(policy.production.localesPerUnit, ["ru", "en"]);
  assert.deepEqual(policy.contentStrategy.connectivityRotation, {
    windowUnits: 4,
    maximumUnits: 1,
    effectiveFrom: "2026-08-31T00:00:00+03:00",
  });
  assert.equal(policy.contentStrategy.allowTechnicalFirstQueue, false);
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

test("блокирует больше одной connectivity-единицы в любом окне из четырёх", () => {
  const plannedPublications = Array.from({ length: 4 }, (_, index) => ({
    planOrder: index + 1,
    id: `editorial-topic-${index + 1}`,
    countryCode: ["HR", "DK", "OM", "CH"][index],
    region: ["southern-europe", "northern-europe", "middle-east", "central-europe"][index],
    planKind: "editorial",
    contentFormat: "route-or-itinerary",
    searchQuery: { ru: `маршрут ${index + 1}`, en: `itinerary ${index + 1}` },
    semanticIntent: { primary: `intent-${index + 1}`, secondary: ["one", "two"] },
    workingTitle: { ru: `Тема ${index + 1}`, en: `Topic ${index + 1}` },
    readerPromise: "Самостоятельная читательская польза.",
    creativeConceptKey: `rotation-concept-${index + 1}`,
    creativeBrief: "Самостоятельный сюжет обложки.",
  }));
  for (const index of [0, 3]) {
    plannedPublications[index].planKind = "buy-esim";
    plannedPublications[index].contentFormat = "connectivity-and-esim";
    plannedPublications[index].searchQuery = { ru: "купить есим для страны", en: "buy eSIM for country" };
  }
  const result = validateEditorialQueue(policy, { schemaVersion: 1, items: [], plannedPublications });
  assert.match(result.errors.join("\n"), /материалов о связи 2 при максимуме 1/);
});

test("блокирует обход ротации через прямые scheduled-публикации", () => {
  const items = Array.from({ length: 4 }, (_, index) => item({
    id: `scheduled-topic-${index + 1}`,
    topicKey: `scheduled-topic-${index + 1}`,
    creativeConceptKey: `scheduled-concept-${index + 1}`,
    status: "scheduled",
    contentFormat: index === 0 || index === 3 ? "connectivity-and-esim" : "route-or-itinerary",
    schedule: Object.fromEntries(
      ["ru", "en"].map((locale) => [locale, `2026-09-01T${String(7 + index).padStart(2, "0")}:00:00Z`]),
    ),
  }));
  const result = validateEditorialQueue(policy, { schemaVersion: 1, items, plannedPublications: [], reservePublications: [] });
  assert.match(result.errors.join("\n"), /материалов о связи 2 при максимуме 1/);
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

test("блокирует маршрутный гид без усиленного брифа", () => {
  const result = validateEditorialQueue(policy, { schemaVersion: 1, items: [item({
    contentFormat: "route-or-itinerary",
  })] });
  assert.match(result.errors.join("\n"), /обязателен enhancedGuide/);
});

test("принимает маршрутный гид с решением, модулями и источниками", () => {
  const result = validateEditorialQueue(policy, { schemaVersion: 1, items: [item({
    contentFormat: "route-or-itinerary",
    enhancedGuide: {
      decisionSpine: "Маршрут для первой поездки с тремя базами и минимумом переездов.",
      routeStops: ["Город A", "Город B", "Город C"],
      readerJobs: ["выбрать базы", "распределить ночи", "проверить переезды", "спланировать связь", "подготовить запасной путь"],
      informationModules: ["route-table", "route-map", "budget-or-data-table"],
      authoritativeSourceCount: 4,
      volatileClaimSourceMapComplete: true,
      animatedVisual: true,
      visualFallback: "Таблица маршрута и статичная схема.",
      reducedMotionPlan: "Все точки и линия показаны без движения.",
    },
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
