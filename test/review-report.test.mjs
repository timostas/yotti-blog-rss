import test from "node:test";
import assert from "node:assert/strict";
import { createReviewReport } from "../scripts/check-reviews.mjs";

function article(title, reviewAfter, published = true) {
  return {
    title,
    language: "ru",
    published,
    reviewer: "Редактор Yotti",
    reviewAfter,
  };
}

test("отчёт разделяет просроченные, срочные и актуальные статьи", () => {
  const report = createReviewReport([
    article("Просроченная", "2026-08-02"),
    article("Скоро проверить", "2026-08-10"),
    article("Актуальная", "2026-09-01"),
    article("Черновик", "2026-08-01", false),
  ], new Date("2026-08-03T12:00:00Z"));

  assert.match(report, /Опубликовано статей: 3/);
  assert.match(report, /Просрочено: 1/);
  assert.match(report, /ближайшие 14 дней: 1/);
  assert.match(report, /Просрочено \| 2026-08-02/);
  assert.match(report, /Скоро \| 2026-08-10/);
  assert.match(report, /2026-09-01 \| Актуально/);
  assert.doesNotMatch(report, /Черновик/);
});

test("отчёт явно сообщает, когда внимания не требуется", () => {
  const report = createReviewReport([
    article("Актуальная", "2026-09-01"),
  ], new Date("2026-08-03T00:00:00Z"));

  assert.match(report, /Нет статей, требующих перепроверки/);
});
