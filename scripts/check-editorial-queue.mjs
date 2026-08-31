import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ACTIVE_STATUSES = new Set(["research", "draft", "review", "ready", "scheduled"]);
const ALLOWED_STATUSES = new Set(["idea", ...ACTIVE_STATUSES, "published", "paused", "rejected"]);

function dateKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function requiresHumanEditorialPass(policy, item) {
  if (item.status === "ready" || item.status === "scheduled") return true;
  if (item.status !== "published") return false;
  const enforcementTime = new Date(policy.quality.humanEditorialEnforcementStartedAt).getTime();
  if (!Number.isFinite(enforcementTime)) return true;
  return policy.production.localesPerUnit.some((locale) => {
    const scheduledTime = new Date(item.schedule?.[locale]).getTime();
    return Number.isFinite(scheduledTime) && scheduledTime >= enforcementTime;
  });
}

export function validateEditorialQueue(policy, queue) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const topicKeys = new Set();
  const creativeConceptKeys = new Set();
  const scheduledByDate = new Map();

  if (queue.schemaVersion !== 1 || !Array.isArray(queue.items)) {
    return { errors: ["content/queue.json: ожидаются schemaVersion 1 и массив items"], warnings, summary: {} };
  }

  for (const [index, item] of queue.items.entries()) {
    const label = item?.id || `items[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${label}: элемент очереди должен быть объектом`);
      continue;
    }
    if (typeof item.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) {
      errors.push(`${label}: id должен быть постоянным slug`);
    } else if (ids.has(item.id)) {
      errors.push(`${label}: повторяющийся id`);
    } else {
      ids.add(item.id);
    }
    if (typeof item.topicKey !== "string" || item.topicKey.trim() === "") {
      errors.push(`${label}: topicKey обязателен`);
    } else {
      const normalizedTopic = item.topicKey.trim().toLowerCase();
      if (topicKeys.has(normalizedTopic)) errors.push(`${label}: тема дублирует другой элемент очереди`);
      topicKeys.add(normalizedTopic);
    }
    if (!ALLOWED_STATUSES.has(item.status)) errors.push(`${label}: неизвестный status`);
    if (item.status === "ready" || item.status === "scheduled") {
      if (!policy.contentStrategy.formats.some((format) => format.key === item.contentFormat)) {
        errors.push(`${label}: неизвестный или отсутствующий contentFormat`);
      }
      if (typeof item.creativeConceptKey !== "string" || item.creativeConceptKey.trim() === "") {
        errors.push(`${label}: creativeConceptKey обязателен`);
      } else {
        const normalizedConcept = item.creativeConceptKey.trim().toLowerCase();
        if (creativeConceptKeys.has(normalizedConcept)) errors.push(`${label}: концепция обложки повторяется`);
        creativeConceptKeys.add(normalizedConcept);
      }
    }
    if (!Array.isArray(item.locales) || item.locales.join(",") !== policy.production.localesPerUnit.join(",")) {
      errors.push(`${label}: locales должны точно соответствовать политике`);
    }

    const attempts = item.generationAttempts || {};
    for (const locale of policy.production.localesPerUnit) {
      if ((attempts[locale] || 0) > policy.budget.maximumGenerationAttemptsPerLocale) {
        errors.push(`${label}: превышен лимит генераций для ${locale}`);
      }
    }
    if ((item.qualityRepairAttempts || 0) > policy.budget.maximumQualityRepairAttempts) {
      errors.push(`${label}: превышен лимит автоматических исправлений`);
    }

    if (requiresHumanEditorialPass(policy, item)) {
      if (item.editorialStandardVersion !== policy.quality.editorialStandardVersion) {
        errors.push(`${label}: требуется актуальная версия редакционного стандарта`);
      }
      for (const locale of policy.production.localesPerUnit) {
        if (item.editorialPasses?.[locale] !== policy.quality.requiredHumanEditorialPassesPerLocale) {
          errors.push(`${label}: требуется отдельный человеческий редакторский проход для ${locale}`);
        }
      }
    }

    if (item.status === "ready" || item.status === "scheduled") {
      const scores = item.scores || {};
      if (scores.utility < policy.quality.minimumUtilityScore) errors.push(`${label}: недостаточная полезность`);
      if (scores.originalValue < policy.quality.minimumOriginalValueScore) errors.push(`${label}: недостаточная оригинальная ценность`);
      if (scores.factSupport < policy.quality.minimumFactSupportScore) errors.push(`${label}: недостаточная поддержка фактами`);
      if (typeof item.creative !== "string" || item.creative.trim() === "") errors.push(`${label}: отсутствует готовый креатив`);
      if (policy.quality.requireIntentMapBeforeDraft) {
        const primary = item.intentMap?.primary || {};
        for (const locale of policy.production.localesPerUnit) {
          if (typeof primary[locale] !== "string" || primary[locale].trim() === "") {
            errors.push(`${label}: intentMap.primary.${locale} обязателен`);
          }
        }
        if (typeof item.intentMap?.cannibalizationDecision !== "string" || item.intentMap.cannibalizationDecision.trim() === "") {
          errors.push(`${label}: intentMap.cannibalizationDecision обязателен`);
        }
      }
      if (Number.isInteger(policy.quality.minimumInternalContextLinks) && policy.quality.minimumInternalContextLinks > 0) {
        const links = item.internalContextLinks;
        if (!Array.isArray(links) || new Set(links.filter((link) => typeof link === "string" && link.trim() !== "")).size < policy.quality.minimumInternalContextLinks) {
          errors.push(`${label}: требуется минимум ${policy.quality.minimumInternalContextLinks} уникальные внутренние ссылки`);
        }
      }
    }

    if (item.status === "scheduled") {
      const dates = policy.production.localesPerUnit.map((locale) => dateKey(item.schedule?.[locale]));
      if (dates.some((date) => date === null)) {
        errors.push(`${label}: для scheduled нужны корректные даты всех языков`);
      } else if (new Set(dates).size !== 1) {
        warnings.push(`${label}: RU и EN запланированы на разные UTC-даты`);
      } else {
        scheduledByDate.set(dates[0], (scheduledByDate.get(dates[0]) || 0) + 1);
      }
    }
  }

  const dailyLimit = policy.production.targetContentUnitsPerDay;
  for (const [date, count] of scheduledByDate) {
    if (Number.isInteger(dailyLimit) && dailyLimit > 0 && count > dailyLimit) {
      errors.push(`${date}: запланировано ${count} единиц при лимите ${policy.production.targetContentUnitsPerDay}`);
    }
  }

  const plannedPublications = queue.plannedPublications ?? [];
  if (!Array.isArray(plannedPublications)) {
    errors.push("content/queue.json: plannedPublications должен быть массивом");
  } else if (plannedPublications.length > 0) {
    const countryCodes = new Set();
    const planIds = new Set(ids);
    const planOrders = new Set();
    const allCreativeConcepts = new Set(queue.items
      .map((item) => item.creativeConceptKey?.trim().toLowerCase())
      .filter(Boolean));
    const sortedPlan = [...plannedPublications].sort((a, b) => a.planOrder - b.planOrder);

    for (const [index, item] of sortedPlan.entries()) {
      const label = item?.id || `plannedPublications[${index}]`;
      const expectedOrder = index + 1;
      if (!Number.isInteger(item?.planOrder) || item.planOrder < 1 || planOrders.has(item.planOrder)) {
        errors.push(`${label}: planOrder должен быть уникальным положительным целым числом`);
      } else {
        planOrders.add(item.planOrder);
        if (item.planOrder !== expectedOrder) errors.push(`${label}: план должен иметь непрерывный порядок от 1`);
      }
      if (typeof item?.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || planIds.has(item.id)) {
        errors.push(`${label}: id плана должен быть уникальным slug`);
      } else {
        planIds.add(item.id);
      }
      if (item?.planKind === "buy-esim" || item?.planKind === "editorial") {
        if (typeof item?.countryCode !== "string" || !/^[A-Z]{2}$/.test(item.countryCode) || countryCodes.has(item.countryCode)) {
          errors.push(`${label}: countryCode должен быть уникальным ISO-кодом для страновой темы`);
        } else {
          countryCodes.add(item.countryCode);
        }
      } else if (item?.planKind === "search-support" && (item?.scope !== "global" || item?.countryCode !== undefined)) {
        errors.push(`${label}: search-support должен иметь scope global и не содержать countryCode`);
      } else if (!new Set(["buy-esim", "search-support", "editorial"]).has(item?.planKind)) {
        errors.push(`${label}: planKind должен быть buy-esim, search-support или editorial`);
      }
      if (typeof item?.region !== "string" || item.region.trim() === "") errors.push(`${label}: region обязателен`);
      if (!policy.contentStrategy.formats.some((format) => format.key === item?.contentFormat)) {
        errors.push(`${label}: неизвестный contentFormat`);
      }
      if (item?.planKind === "buy-esim" && item.contentFormat !== "connectivity-and-esim") {
        errors.push(`${label}: buy-esim должен использовать connectivity-and-esim`);
      }
      if (item?.planKind === "search-support" && item.contentFormat !== "connectivity-and-esim") {
        errors.push(`${label}: search-support должен использовать connectivity-and-esim`);
      }
      if (item?.planKind === "editorial" && item.contentFormat === "connectivity-and-esim") {
        errors.push(`${label}: editorial должен использовать туристический или lifestyle-формат`);
      }
      if (!item?.searchQuery?.ru?.toLowerCase().startsWith("купить есим для") && item?.planKind === "buy-esim") {
        errors.push(`${label}: RU-запрос должен начинаться с «купить есим для»`);
      }
      if (!item?.searchQuery?.en?.toLowerCase().startsWith("buy esim for") && item?.planKind === "buy-esim") {
        errors.push(`${label}: EN-запрос должен начинаться с «buy eSIM for»`);
      }
      for (const locale of policy.production.localesPerUnit) {
        if (typeof item?.workingTitle?.[locale] !== "string" || item.workingTitle[locale].trim() === "") {
          errors.push(`${label}: рабочий заголовок ${locale} обязателен`);
        }
      }
      if (typeof item?.readerPromise !== "string" || item.readerPromise.trim() === "") errors.push(`${label}: readerPromise обязателен`);
      if (typeof item?.creativeBrief !== "string" || item.creativeBrief.trim() === "") errors.push(`${label}: creativeBrief обязателен`);
      if (typeof item?.semanticIntent?.primary !== "string" || item.semanticIntent.primary.trim() === "") {
        errors.push(`${label}: semanticIntent.primary обязателен`);
      }
      if (!Array.isArray(item?.semanticIntent?.secondary) || item.semanticIntent.secondary.filter((query) => typeof query === "string" && query.trim() !== "").length < 2) {
        errors.push(`${label}: semanticIntent.secondary должен содержать минимум два запроса`);
      }
      const creativeKey = item?.creativeConceptKey?.trim().toLowerCase();
      if (!creativeKey || allCreativeConcepts.has(creativeKey)) {
        errors.push(`${label}: creativeConceptKey должен быть уникальным относительно очереди и плана`);
      } else {
        allCreativeConcepts.add(creativeKey);
      }
    }

    for (let index = 2; index < sortedPlan.length; index += 1) {
      if (sortedPlan[index].region === sortedPlan[index - 1].region && sortedPlan[index].region === sortedPlan[index - 2].region) {
        errors.push(`${sortedPlan[index].id}: регион повторяется более двух раз подряд`);
      }
    }

  }

  const reservePublications = queue.reservePublications ?? [];
  if (!Array.isArray(reservePublications)) {
    errors.push("content/queue.json: reservePublications должен быть массивом");
  } else {
    const unavailableIds = new Set([
      ...ids,
      ...(Array.isArray(plannedPublications) ? plannedPublications.map((item) => item?.id).filter(Boolean) : []),
    ]);
    const reserveIds = new Set();
    for (const [index, item] of reservePublications.entries()) {
      const label = item?.id || `reservePublications[${index}]`;
      if (typeof item?.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) {
        errors.push(`${label}: id резерва должен быть постоянным slug`);
      } else if (unavailableIds.has(item.id) || reserveIds.has(item.id)) {
        errors.push(`${label}: id резерва должен быть уникальным и отсутствовать в активной очереди`);
      } else {
        reserveIds.add(item.id);
      }
      if (item?.contentFormat !== "connectivity-and-esim") {
        errors.push(`${label}: технический резерв должен использовать connectivity-and-esim`);
      }
      if (item?.planKind !== "search-support") {
        errors.push(`${label}: технический резерв должен иметь planKind search-support`);
      }
    }
  }

  const connectivityRotation = policy.contentStrategy.connectivityRotation;
  if (connectivityRotation && Number.isInteger(connectivityRotation.windowUnits) && Number.isInteger(connectivityRotation.maximumUnits)) {
    const effectiveFrom = new Date(connectivityRotation.effectiveFrom).getTime();
    if (!Number.isFinite(effectiveFrom)) {
      errors.push("contentStrategy.connectivityRotation.effectiveFrom должен быть корректной датой");
    } else {
      const releasedUnits = queue.items
        .filter((item) => item.status === "published" || item.status === "scheduled")
        .map((item) => {
          const timestamps = policy.production.localesPerUnit
            .map((locale) => new Date(item.schedule?.[locale]).getTime())
            .filter(Number.isFinite);
          return { ...item, rotationTimestamp: timestamps.length ? Math.min(...timestamps) : Number.NaN };
        })
        .filter((item) => Number.isFinite(item.rotationTimestamp) && item.rotationTimestamp >= effectiveFrom)
        .sort((a, b) => a.rotationTimestamp - b.rotationTimestamp);
      const plannedUnits = Array.isArray(plannedPublications)
        ? [...plannedPublications].sort((a, b) => a.planOrder - b.planOrder)
        : [];
      const rotationSequence = [...releasedUnits, ...plannedUnits];
      for (let index = 0; index <= rotationSequence.length - connectivityRotation.windowUnits; index += 1) {
        const window = rotationSequence.slice(index, index + connectivityRotation.windowUnits);
        const connectivityCount = window.filter((item) => item.contentFormat === "connectivity-and-esim").length;
        if (connectivityCount > connectivityRotation.maximumUnits) {
          errors.push(`публикации ${index + 1}-${index + connectivityRotation.windowUnits} после ${connectivityRotation.effectiveFrom}: материалов о связи ${connectivityCount} при максимуме ${connectivityRotation.maximumUnits}`);
        }
      }
    }
  }

  return {
    errors,
    warnings,
    summary: {
      total: queue.items.length,
      active: queue.items.filter((item) => ACTIVE_STATUSES.has(item.status)).length,
      scheduled: queue.items.filter((item) => item.status === "scheduled").length,
      planned: Array.isArray(plannedPublications) ? plannedPublications.length : 0,
      reserved: Array.isArray(reservePublications) ? reservePublications.length : 0,
    },
  };
}

export function renderQueueReport(result) {
  const lines = [
    "# Редакционная очередь",
    "",
    `- Всего: ${result.summary.total ?? 0}`,
    `- В работе: ${result.summary.active ?? 0}`,
    `- Запланировано: ${result.summary.scheduled ?? 0}`,
    `- В плане публикаций: ${result.summary.planned ?? 0}`,
    `- В резерве: ${result.summary.reserved ?? 0}`,
    `- Ошибок: ${result.errors.length}`,
    `- Предупреждений: ${result.warnings.length}`,
  ];
  if (result.errors.length) lines.push("", "## Блокирующие ошибки", "", ...result.errors.map((error) => `- ${error}`));
  if (result.warnings.length) lines.push("", "## Предупреждения", "", ...result.warnings.map((warning) => `- ${warning}`));
  return `${lines.join("\n")}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const policy = JSON.parse(await readFile(join(ROOT_DIR, "config/editorial-policy.json"), "utf8"));
  const queue = JSON.parse(await readFile(join(ROOT_DIR, "content/queue.json"), "utf8"));
  const result = validateEditorialQueue(policy, queue);
  console.log(renderQueueReport(result));
  if (result.errors.length) process.exitCode = 1;
}
