import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArticle } from "./build-feed.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARTICLES_DIR = join(ROOT_DIR, "articles");
const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 14;

function utcDay(value) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function reviewStatus(article, now, dueSoonDays) {
  const daysLeft = Math.round((Date.parse(`${article.reviewAfter}T00:00:00Z`) - utcDay(now)) / DAY_MS);
  if (daysLeft < 0) return { key: "overdue", label: "Просрочено", daysLeft };
  if (daysLeft <= dueSoonDays) return { key: "due-soon", label: "Скоро", daysLeft };
  return { key: "current", label: "Актуально", daysLeft };
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function createReviewReport(articles, now = new Date(), dueSoonDays = DUE_SOON_DAYS) {
  const rows = articles
    .filter((article) => article.published)
    .map((article) => ({ article, status: reviewStatus(article, now, dueSoonDays) }))
    .sort((a, b) => {
      const priority = { overdue: 0, "due-soon": 1, current: 2 };
      return priority[a.status.key] - priority[b.status.key]
        || a.article.reviewAfter.localeCompare(b.article.reviewAfter)
        || a.article.title.localeCompare(b.article.title);
    });

  const overdue = rows.filter((row) => row.status.key === "overdue").length;
  const dueSoon = rows.filter((row) => row.status.key === "due-soon").length;
  const attention = rows.filter((row) => row.status.key !== "current");
  const generatedAt = now.toISOString();

  const lines = [
    "# Отчёт о перепроверке статей",
    "",
    `Сформирован: ${generatedAt}`,
    "",
    `- Опубликовано статей: ${rows.length}`,
    `- Просрочено: ${overdue}`,
    `- Требуют проверки в ближайшие ${dueSoonDays} дней: ${dueSoon}`,
    "",
    "## Требуют внимания",
    "",
  ];

  if (attention.length === 0) {
    lines.push("Нет статей, требующих перепроверки в ближайшее время.", "");
  } else {
    lines.push("| Статус | Срок | Язык | Статья | Проверяющий |", "|---|---|---|---|---|");
    for (const { article, status } of attention) {
      lines.push(`| ${status.label} | ${article.reviewAfter} | ${article.language} | ${escapeCell(article.title)} | ${escapeCell(article.reviewer)} |`);
    }
    lines.push("");
  }

  lines.push("## Все опубликованные статьи", "", "| Срок | Статус | Язык | Статья |", "|---|---|---|---|");
  for (const { article, status } of rows) {
    lines.push(`| ${article.reviewAfter} | ${status.label} | ${article.language} | ${escapeCell(article.title)} |`);
  }
  lines.push("");
  return lines.join("\n");
}

async function loadArticles() {
  const config = JSON.parse(await readFile(join(ROOT_DIR, "feed.config.json"), "utf8"));
  const files = (await readdir(ARTICLES_DIR)).filter((name) => extname(name) === ".md").sort();
  return Promise.all(files.map(async (name) => {
    const source = await readFile(join(ARTICLES_DIR, name), "utf8");
    return parseArticle(source, name, config.siteUrl);
  }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const now = process.env.REVIEW_REPORT_DATE
    ? new Date(`${process.env.REVIEW_REPORT_DATE}T00:00:00Z`)
    : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("REVIEW_REPORT_DATE должен иметь формат YYYY-MM-DD");
  }
  console.log(createReviewReport(await loadArticles(), now));
}
