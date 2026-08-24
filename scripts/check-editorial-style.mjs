import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const execFileAsync = promisify(execFile);

const RULES = {
  ru: {
    title: [
      /после первого кадра/iu,
      /зачем оставить время/iu,
      /петра,? кроме сокровищницы/iu,
    ],
    phrases: [
      /главный совет прост/iu,
      /смен(?:а|у|ить) масштаба/iu,
      /не финал(?:ом)?,? а двер/iu,
      /перв(?:ая|ой) глав(?:а|ой)/iu,
      /не ставить точку/iu,
      /совершите самое важное действие/iu,
      /начинается настоящее путешествие/iu,
      /не измеряйте (?:день|поездку|путешествие)/iu,
      /позвольте (?:городу|месту|маршруту|ландшафту)/iu,
      /город раскрывается/iu,
    ],
    genericHeadings: new Set(["ключевые выводы", "итог", "частые вопросы"]),
    contrast: /\bне\s+[^.!?\n]{1,90},?\s+а\s+/giu,
    contrastLabel: "«не X, а Y»",
  },
  en: {
    title: [
      /after the first photograph/iu,
      /why the city deserves more/iu,
    ],
    phrases: [
      /the short version/iu,
      /not the end of the story/iu,
      /threshold,? not (?:its|the) finish line/iu,
      /first chapter/iu,
      /the real (?:journey|itinerary) begins/iu,
      /do not judge (?:the|a) (?:day|trip|visit)/iu,
      /let the (?:city|place|landscape|route)/iu,
      /the city reveals itself/iu,
      /more than a checklist/iu,
    ],
    genericHeadings: new Set(["key takeaways", "the short version", "conclusion", "frequently asked questions"]),
    contrast: /\bnot\s+[^.!?\n]{1,90}\s+but\s+/giu,
    contrastLabel: "“not X but Y”",
  },
};

function articleParts(source, fileName) {
  const match = source.replaceAll("\r\n", "\n").match(/^---\n([\s\S]*?)\n---\n([\s\S]+)$/);
  if (!match) throw new Error(`${fileName}: не найден корректный YAML front matter`);
  const metadata = YAML.parse(match[1]);
  return { title: String(metadata?.title || ""), language: metadata?.language, body: match[2].trim() };
}

export function analyzeEditorialStyle({ title, language, body }) {
  const rules = RULES[language];
  if (!rules) return { errors: [], warnings: [] };

  const errors = [];
  const warnings = [];
  const visibleText = `${title}\n${body}`;
  if (language === "ru" && /\beSIM\b/u.test(visibleText)) {
    errors.push("в русской статье используйте написание «есим», а не «eSIM»");
  }
  if (language === "en" && /есим/iu.test(visibleText)) {
    errors.push("в английской статье используйте написание “eSIM”, а не «есим»");
  }
  if (language === "ru" && /https:\/\/(?:www\.)?yotti\.net\/en\//iu.test(body)) {
    errors.push("русская статья ведёт на английскую страницу Yotti");
  }
  if (
    language === "en" &&
    /https:\/\/(?:www\.)?yotti\.net\/(?:esim\/|catalog(?:\b|\/)|how-it-works(?:\b|\/))/iu.test(body)
  ) {
    errors.push("английская статья ведёт на русскую страницу Yotti");
  }
  for (const pattern of rules.title) {
    if (pattern.test(title)) errors.push(`заголовок содержит машинную или неестественную формулу: «${title}»`);
  }
  for (const pattern of rules.phrases) {
    const match = body.match(pattern);
    if (match) errors.push(`характерный GPT-оборот: «${match[0]}»`);
  }

  const contrasts = body.match(rules.contrast) ?? [];
  if (contrasts.length > 2) {
    errors.push(`слишком много симметричных противопоставлений ${rules.contrastLabel}: ${contrasts.length}`);
  }

  const headings = [...body.matchAll(/^#{2,3}\s+(.+)$/gmu)].map((match) => match[1].trim().toLowerCase());
  const genericHeadingCount = headings.filter((heading) => rules.genericHeadings.has(heading)).length;
  if (genericHeadingCount > 1) {
    errors.push(`универсальный шаблон использует ${genericHeadingCount} служебных раздела вместо структуры по материалу`);
  } else if (genericHeadingCount === 1) {
    warnings.push("проверьте, действительно ли универсальный служебный раздел нужен этой статье");
  }

  return { errors: [...new Set(errors)], warnings };
}

async function changedArticleFiles(base) {
  if (!base || /^0+$/.test(base)) return [];
  const { stdout } = await execFileAsync("git", ["diff", "--name-only", base, "HEAD", "--", "articles/*.md"]);
  return stdout.split("\n").map((line) => line.trim()).filter(Boolean);
}

async function main() {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf("--base");
  let files;
  if (baseIndex >= 0) {
    const base = args[baseIndex + 1];
    if (!base) throw new Error("после --base требуется Git SHA");
    files = await changedArticleFiles(base);
  } else {
    files = args.filter((arg) => !arg.startsWith("--"));
    if (files.length === 0) throw new Error("укажите изменённые Markdown-статьи или --base <Git SHA>");
  }

  const reports = [];
  for (const file of files) {
    const source = await readFile(resolve(file), "utf8");
    const result = analyzeEditorialStyle(articleParts(source, file));
    reports.push({ file, ...result });
  }

  if (files.length === 0) {
    console.log("Изменённых статей для стилевой проверки нет.");
    return;
  }

  for (const report of reports) {
    for (const warning of report.warnings) console.log(`WARN ${report.file}: ${warning}`);
    for (const error of report.errors) console.error(`ERROR ${report.file}: ${error}`);
  }
  const errorCount = reports.reduce((total, report) => total + report.errors.length, 0);
  console.log(`Проверено статей: ${reports.length}; блокирующих стилевых ошибок: ${errorCount}`);
  if (errorCount > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
