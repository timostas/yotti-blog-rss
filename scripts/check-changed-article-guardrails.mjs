import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArticle } from "./build-feed.mjs";
import { checkRepositoryVisuals } from "./check-article-visuals.mjs";
import { validateSemanticArticleLinks } from "./check-semantic-article-links.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARTICLE_PATTERN = /^articles\/[^/]+\.md$/u;
const ASSET_PATTERN = /^assets\/.+/u;
const PUBLISH_RELEVANT_STATUSES = new Set(["ready", "scheduled", "published"]);

function validScopedPath(value) {
  return typeof value === "string"
    && !isAbsolute(value)
    && !value.includes("..")
    && !/[\\\0]/u.test(value)
    && (ARTICLE_PATTERN.test(value) || ASSET_PATTERN.test(value));
}

export function parseCliArgs(args) {
  let base = null;
  let files = null;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--base") {
      if (base !== null || files !== null || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("используйте ровно один scope: --base <commit> или --files <paths...>");
      base = args[index + 1];
      if (base.startsWith("-") || /[\s\\\0]/u.test(base)) throw new Error("--base должен быть безопасным git commit/ref");
      index += 1;
    } else if (argument === "--files") {
      if (base !== null || files !== null) throw new Error("используйте ровно один scope: --base <commit> или --files <paths...>");
      files = args.slice(index + 1);
      if (files.length === 0 || files.some((file) => file.startsWith("--"))) throw new Error("после --files требуется хотя бы один допустимый path");
      index = args.length;
    } else {
      throw new Error(`неизвестный аргумент: ${argument}`);
    }
  }
  if ((base === null) === (files === null)) throw new Error("используйте ровно один scope: --base <commit> или --files <paths...>");
  if (files && files.some((file) => !validScopedPath(file))) throw new Error("--files принимает только относительные articles/*.md и assets/** без traversal");
  return base !== null ? { mode: "base", base } : { mode: "files", files: [...new Set(files)] };
}

export function parseNameStatusZ(buffer) {
  const fields = Buffer.isBuffer(buffer) ? buffer.toString("utf8").split("\0") : String(buffer).split("\0");
  if (fields.at(-1) === "") fields.pop();
  const entries = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (!/^[ACDMRTUXB][0-9]*$/u.test(status)) throw new Error(`некорректный git name-status token: ${status}`);
    if (/^[RC]/u.test(status)) {
      if (index + 1 >= fields.length) throw new Error("неполная rename/copy запись git diff");
      entries.push({ status, oldPath: fields[index++], path: fields[index++] });
    } else {
      if (index >= fields.length) throw new Error("неполная запись git diff");
      entries.push({ status, path: fields[index++] });
    }
  }
  return entries;
}

export function classifyChangedPaths(entries) {
  const forceArticleFiles = new Set();
  const changedAssetFiles = new Set();
  const removedArticleFiles = new Set();
  let queueChanged = false;
  for (const entry of entries) {
    const paths = [entry.oldPath, entry.path].filter(Boolean);
    if (paths.includes("content/queue.json")) queueChanged = true;
    if (/^D/u.test(entry.status) && ARTICLE_PATTERN.test(entry.path)) removedArticleFiles.add(entry.path);
    if (/^R/u.test(entry.status) && ARTICLE_PATTERN.test(entry.oldPath)) removedArticleFiles.add(entry.oldPath);
    if (!/^D/u.test(entry.status) && ARTICLE_PATTERN.test(entry.path)) forceArticleFiles.add(entry.path);
    for (const path of paths) if (ASSET_PATTERN.test(path)) changedAssetFiles.add(path);
  }
  return {
    forceArticleFiles: [...forceArticleFiles].sort(),
    changedAssetFiles: [...changedAssetFiles].sort(),
    removedArticleFiles: [...removedArticleFiles].sort(),
    queueChanged,
  };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function differs(left, right) {
  return JSON.stringify(stable(left)) !== JSON.stringify(stable(right));
}

export function diffQueueSecurityFields(baseQueue, headQueue) {
  const baseItems = new Map((baseQueue?.items ?? []).map((item) => [item.id, item]));
  const headItems = new Map((headQueue?.items ?? []).map((item) => [item.id, item]));
  const scoped = [];
  for (const id of [...new Set([...baseItems.keys(), ...headItems.keys()])].sort()) {
    const before = baseItems.get(id);
    const after = headItems.get(id);
    const locales = new Set();
    const declaredLocales = new Set([...(before?.locales ?? []), ...(after?.locales ?? [])].filter((locale) => ["ru", "en"].includes(locale)));
    if (!before || !after || differs(before.semanticLinkClass, after.semanticLinkClass) || differs(before.contentFormat, after.contentFormat) || differs(before.locales, after.locales)) {
      for (const locale of declaredLocales) locales.add(locale);
    }
    for (const locale of declaredLocales) {
      if (differs(before?.publicUrls?.[locale], after?.publicUrls?.[locale]) || differs(before?.internalArticleLinks?.[locale], after?.internalArticleLinks?.[locale])) locales.add(locale);
    }
    if (locales.size > 0) scoped.push({ id, locales: [...locales].sort(), before, after });
  }
  return scoped;
}

function git(rootDir, args, encoding = "utf8") {
  return new Promise((resolvePromise, reject) => {
    execFile("git", args, { cwd: rootDir, encoding: encoding === "buffer" ? null : encoding }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
      } else resolvePromise(stdout);
    });
  });
}

function articleId(article, sourceName) {
  return article.slug.endsWith(`-${article.language}`)
    ? article.slug.slice(0, -article.language.length - 1)
    : basename(sourceName, ".md").replace(/-(?:ru|en)$/u, "");
}

export async function runChangedArticleGuardrails({ rootDir = ROOT_DIR, cli = null } = {}) {
  const errors = [];
  const warnings = [];
  let parsed;
  try {
    parsed = cli ?? parseCliArgs(process.argv.slice(2));
  } catch (error) {
    return { exitCode: 2, errors: [error.message], warnings, checked: [] };
  }

  let entries;
  let baseIsAllZero = false;
  try {
    if (parsed.mode === "files") {
      entries = parsed.files.map((path) => ({ status: "M", path }));
    } else {
      baseIsAllZero = /^0+$/u.test(parsed.base);
      if (!baseIsAllZero) await git(rootDir, ["cat-file", "-e", `${parsed.base}^{commit}`]);
      const output = baseIsAllZero
        ? await git(rootDir, ["diff-tree", "--root", "--no-commit-id", "-r", "--name-status", "-z", "HEAD", "--", "articles", "assets", "content/queue.json"], "buffer")
        : await git(rootDir, ["diff", "--name-status", "-z", "--find-renames", parsed.base, "HEAD", "--", "articles", "assets", "content/queue.json"], "buffer");
      entries = parseNameStatusZ(output);
    }
  } catch (error) {
    return { exitCode: 2, errors: [`git/base contract: ${String(error.stderr || error.message).trim()}`], warnings, checked: [] };
  }

  const classified = classifyChangedPaths(entries);
  for (const path of classified.removedArticleFiles) errors.push(`${path}: удаление или rename-away опубликованной статьи не поддерживается`);
  const forced = new Set(classified.forceArticleFiles);

  let queue;
  let feedConfig;
  let policy;
  try {
    [queue, feedConfig, policy] = await Promise.all([
      readFile(join(rootDir, "content", "queue.json"), "utf8").then(JSON.parse),
      readFile(join(rootDir, "feed.config.json"), "utf8").then(JSON.parse),
      readFile(join(rootDir, "config", "editorial-policy.json"), "utf8").then(JSON.parse),
    ]);
  } catch (error) {
    return { exitCode: 2, errors: [...errors, `не удалось прочитать config/queue: ${error.message}`], warnings, checked: [] };
  }

  if (classified.queueChanged && parsed.mode === "base") {
    try {
      const baseQueue = baseIsAllZero
        ? { items: [] }
        : JSON.parse(await git(rootDir, ["show", `${parsed.base}:content/queue.json`]));
      for (const change of diffQueueSecurityFields(baseQueue, queue)) {
        const item = change.after;
        if (!item) {
          errors.push(`content/queue.json: удалён security-relevant item ${change.id}`);
          continue;
        }
        for (const locale of change.locales) {
          const sourceName = `articles/${change.id}-${locale}.md`;
          const queueIsPublishRelevant = PUBLISH_RELEVANT_STATUSES.has(change.before?.status)
            || PUBLISH_RELEVANT_STATUSES.has(change.after?.status);
          let frontMatterIsPublished = false;
          try {
            const article = parseArticle(await readFile(join(rootDir, sourceName), "utf8"), sourceName, feedConfig.siteUrl);
            frontMatterIsPublished = article.published;
          } catch (error) {
            if (error?.code !== "ENOENT") {
              // A malformed existing article must remain inside the forced path so
              // the normal checker reports the parse failure instead of allowing
              // a queue-status downgrade to hide it.
              frontMatterIsPublished = true;
            }
          }
          if (queueIsPublishRelevant || frontMatterIsPublished) forced.add(sourceName);
        }
      }
    } catch (error) {
      return { exitCode: 2, errors: [...errors, `не удалось сравнить security fields очереди: ${error.message}`], warnings, checked: [] };
    }
  }

  let visualReport;
  try {
    visualReport = await checkRepositoryVisuals({
      rootDir,
      forceArticleFiles: [...forced],
      changedAssetFiles: classified.changedAssetFiles,
    });
    errors.push(...visualReport.errors);
  } catch (error) {
    return { exitCode: 2, errors: [...errors, `визуальный checker не выполнился: ${error.message}`], warnings, checked: [] };
  }

  const changeScoped = new Set([
    ...forced,
    ...visualReport.checked.filter((item) => item.reasons?.includes("asset-change")).map((item) => item.sourceName),
  ]);
  const items = new Map((queue.items ?? []).map((item) => [item.id, item]));
  const checked = [];
  for (const sourceName of [...changeScoped].sort()) {
    let article;
    try {
      article = parseArticle(await readFile(join(rootDir, sourceName), "utf8"), sourceName, feedConfig.siteUrl);
    } catch (error) {
      errors.push(`${sourceName}: ${error.message}`);
      continue;
    }
    const id = articleId(article, sourceName);
    const queueItem = items.get(id);
    const linkResult = validateSemanticArticleLinks({ article, queueItem, gate: policy.quality.semanticInternalLinkGates, sourceName });
    errors.push(...linkResult.errors);
    warnings.push(...linkResult.warnings);
    const visual = visualReport.checked.find((item) => item.sourceName === sourceName);
    checked.push({
      sourceName,
      reasons: visual?.reasons ?? ["queue-change"],
      strict: visual?.strict ?? true,
      totalImages: visual?.totalImages ?? "UNKNOWN",
      totalBytes: visual?.totalBytes ?? "UNKNOWN",
      semanticLinkClass: linkResult.summary.semanticLinkClass,
      semanticArticleLinks: linkResult.summary.uniqueCount,
      requiredSemanticArticleLinks: linkResult.summary.requiredMinimum,
    });
  }
  return { exitCode: errors.length > 0 ? 1 : 0, errors, warnings, checked, classified };
}

async function main() {
  const report = await runChangedArticleGuardrails();
  console.log("# Change-scoped article guardrails");
  for (const item of report.checked) {
    console.log(`- ${item.sourceName}: reasons=${item.reasons.join(",")}; images=${item.totalImages}; bytes=${item.totalBytes}; class=${item.semanticLinkClass}; links=${item.semanticArticleLinks}/${item.requiredSemanticArticleLinks}`);
  }
  for (const warning of report.warnings) console.log(`WARN ${warning}`);
  for (const error of report.errors) console.error(`ERROR ${error}`);
  console.log(`Проверено изменённых статей: ${report.checked.length}; блокирующих ошибок: ${report.errors.length}`);
  process.exitCode = report.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
