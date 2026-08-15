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
    scores: { utility: 85, originalValue: 82, factSupport: 95 },
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

test("не разрешает повторять концепцию обложки", () => {
  const result = validateEditorialQueue(policy, { schemaVersion: 1, items: [
    item(),
    item({ id: "second-topic", topicKey: "second-topic" }),
  ] });
  assert.match(result.errors.join("\n"), /концепция обложки повторяется/);
});

test("блокирует превышение дневного потолка", () => {
  const items = Array.from({ length: 6 }, (_, index) => item({
    id: `topic-${index}`,
    topicKey: `topic-${index}`,
    creativeConceptKey: `concept-${index}`,
    status: "scheduled",
    schedule: { ru: "2026-09-01T07:00:00Z", en: "2026-09-01T10:00:00Z" },
  }));
  const result = validateEditorialQueue(policy, { schemaVersion: 1, items });
  assert.match(result.errors.join("\n"), new RegExp(`запланировано 6 единиц при лимите ${policy.production.targetContentUnitsPerDay}`));
});
