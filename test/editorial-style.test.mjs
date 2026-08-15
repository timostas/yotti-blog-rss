import test from "node:test";
import assert from "node:assert/strict";
import { analyzeEditorialStyle } from "../scripts/check-editorial-style.mjs";

test("блокирует характерный GPT-каркас русской статьи", () => {
  const result = analyzeEditorialStyle({
    language: "ru",
    title: "Петра после первого кадра: зачем оставить время за знаменитым фасадом",
    body: `## Ключевые выводы
Главный совет прост: ищите не фотографию, а смену масштаба.
## Итог
Тогда вид становится не финалом, а дверью.`,
  });
  assert.match(result.errors.join("\n"), /заголовок.*GPT-оборот.*универсальный шаблон/s);
});

test("пропускает спокойный редакционный текст", () => {
  const result = analyzeEditorialStyle({
    language: "ru",
    title: "Петра: что посмотреть после Сокровищницы",
    body: `## Что находится за Сокровищницей
За площадью начинается широкая долина. Дальше по маршруту находятся театр, Царские гробницы и бывший центр города.

## На что обратить внимание в Сике
Вдоль прохода сохранились каналы, по которым набатеи направляли воду.`,
  });
  assert.deepEqual(result.errors, []);
});

test("блокирует повторяющиеся английские контрасты", () => {
  const result = analyzeEditorialStyle({
    language: "en",
    title: "Petra beyond the Treasury: a guide to the ancient city",
    body: "It is not a corridor but a street. This is not a monument but a city. The route is not a checklist but a conversation.",
  });
  assert.match(result.errors.join("\n"), /not X but Y.*3/);
});
