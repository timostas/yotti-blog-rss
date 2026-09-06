import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeYottiArticleUrl } from "./check-semantic-article-links.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATES = new Set(["PASS", "FAIL", "UNAVAILABLE", "CONTRACT_ERROR"]);
const DEFAULT_REQUIRED_VIEWPORTS = [360, 390, 720];
const INLINE_IMAGE_ROLES = new Set(["contextual-photo", "information-graphic", "route-map"]);
const RESPONSIVE_EQUIVALENT_TYPES = new Set(["cdn-width-transform"]);
const VIEWPORT_TELEMETRY_FIELDS = ["viewportHeight", "httpStatus", "finalUrl", "canonicalUrl", "metrics", "baseline", "images"];

function result(state, code, message, details = {}) {
  return { state, code, message, ...details };
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validIsoTimestamp(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
    && Number.isFinite(Date.parse(value));
}

function finiteNumber(value, { positive = false } = {}) {
  return typeof value === "number" && Number.isFinite(value) && (positive ? value > 0 : value >= 0);
}

function profileFingerprint(profile) {
  if (!isObject(profile)) return null;
  const keys = ["tool", "toolVersion", "networkProfile", "cacheMode", "deviceScaleFactor", "rootMarginPx"];
  if (keys.some((key) => !hasOwn(profile, key))) return null;
  return JSON.stringify(Object.fromEntries(keys.map((key) => [key, profile[key]])));
}

function viewportProfileFingerprint(profile, viewportWidth) {
  if (!Number.isInteger(viewportWidth)) return null;
  const fingerprint = profileFingerprint(profile);
  if (fingerprint === null) return null;
  return JSON.stringify({ ...JSON.parse(fingerprint), viewportWidth });
}

function stateFor(results) {
  if (results.some(({ state }) => state === "CONTRACT_ERROR")) return "CONTRACT_ERROR";
  if (results.some(({ state }) => state === "FAIL")) return "FAIL";
  if (results.some(({ state }) => state === "UNAVAILABLE")) return "UNAVAILABLE";
  return "PASS";
}

function normalizePublicUrl(rawUrl, locale, semanticGate) {
  try {
    const normalized = normalizeYottiArticleUrl(rawUrl, locale, semanticGate);
    return normalized ? { normalized } : { error: "URL is not a Yotti Blog detail page" };
  } catch (error) {
    return { error: error.message };
  }
}

function policyGate(context) {
  return context.gate
    ?? context.policy?.quality?.longFormVisualGates?.publicPostSyncPerformanceGates
    ?? null;
}

function semanticGate(context) {
  return context.semanticGate ?? context.policy?.quality?.semanticInternalLinkGates ?? null;
}

function queueItems(context) {
  return context.queue?.items ?? context.queueItems ?? [];
}

function responsiveEquivalent(image) {
  const value = image.responsiveEquivalent;
  return isObject(value)
    && RESPONSIVE_EQUIVALENT_TYPES.has(value.type)
    && value.observed === true;
}

function aspectRatio(width, height) {
  return width / height;
}

function aspectMismatch(first, second) {
  return Math.abs(first - second) / first > 0.01;
}

export function parseEvidenceCliArgs(args) {
  const evidencePaths = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--evidence" || index + 1 >= args.length) {
      throw new Error("usage: node scripts/check-public-page-performance.mjs --evidence <capture.json> [--evidence <capture.json> ...]");
    }
    const path = args[index + 1];
    if (typeof path !== "string" || path.trim() === "" || path.startsWith("-")) {
      throw new Error("--evidence requires a readable JSON file path");
    }
    evidencePaths.push(path);
    index += 1;
  }
  if (evidencePaths.length === 0) throw new Error("at least one --evidence path is required");
  if (new Set(evidencePaths).size !== evidencePaths.length) throw new Error("duplicate --evidence paths are not allowed");
  return { evidencePaths };
}

export function validateEvidenceContract(evidence, context = {}) {
  const results = [];
  const sourceName = context.sourceName ?? "evidence";
  const gate = policyGate(context);
  const linkGate = semanticGate(context);
  const requiredWidths = gate?.viewportWidths;

  if (!isObject(evidence)) {
    results.push(result("CONTRACT_ERROR", "EVIDENCE_OBJECT", `${sourceName}: evidence must be a JSON object`));
    return { state: "CONTRACT_ERROR", results, pageContexts: [], gate, semanticGate: linkGate };
  }
  if (evidence.schemaVersion !== 1) {
    results.push(result("CONTRACT_ERROR", "SCHEMA_VERSION", `${sourceName}: schemaVersion must equal 1`));
  }
  if (typeof evidence.itemId !== "string" || evidence.itemId.trim() === "") {
    results.push(result("CONTRACT_ERROR", "ITEM_ID", `${sourceName}: itemId must be a non-empty string`));
  }
  if (!validIsoTimestamp(evidence.capturedAt)) {
    results.push(result("CONTRACT_ERROR", "CAPTURED_AT", `${sourceName}: capturedAt must be a valid ISO timestamp`));
  }
  if (!isObject(gate)) {
    results.push(result("CONTRACT_ERROR", "POLICY_GATE", `${sourceName}: publicPostSyncPerformanceGates policy is missing`));
  } else if (!Array.isArray(requiredWidths)
    || requiredWidths.length !== DEFAULT_REQUIRED_VIEWPORTS.length
    || requiredWidths.some((width, index) => width !== DEFAULT_REQUIRED_VIEWPORTS[index])) {
    results.push(result("CONTRACT_ERROR", "POLICY_VIEWPORTS", `${sourceName}: policy viewportWidths must be exactly 360, 390, 720`));
  }
  if (isObject(gate)) {
    for (const key of ["deviceScaleFactor", "maximumInitialViewportTransferBytes", "maximumLcpRegressionRatio", "maximumResponsiveOversupplyRatio"]) {
      if (!finiteNumber(gate[key], { positive: true })) results.push(result("CONTRACT_ERROR", "POLICY_VALUE", `${sourceName}: policy ${key} must be positive`, { field: key }));
    }
    for (const key of ["maximumHorizontalOverflowPx", "maximumClsRegressionAbsolute"]) {
      if (!finiteNumber(gate[key])) results.push(result("CONTRACT_ERROR", "POLICY_VALUE", `${sourceName}: policy ${key} must be nonnegative`, { field: key }));
    }
    for (const key of ["requireSevenUniqueRenderedImages", "requireResponsiveAttributesOrEquivalent", "requireNoDistortedAspectRatio", "requireBelowFoldImagesDeferred"]) {
      if (gate[key] !== true) results.push(result("CONTRACT_ERROR", "POLICY_VALUE", `${sourceName}: policy ${key} must be true`, { field: key }));
    }
  }
  if (!isObject(linkGate)) {
    results.push(result("CONTRACT_ERROR", "SEMANTIC_URL_GATE", `${sourceName}: semanticInternalLinkGates policy is missing`));
  }

  const item = queueItems(context).find(({ id }) => id === evidence.itemId);
  if (!item) results.push(result("CONTRACT_ERROR", "QUEUE_ITEM", `${sourceName}: queue item ${evidence.itemId ?? "UNKNOWN"} was not found`));

  const profile = evidence.captureProfile;
  if (!isObject(profile)) {
    results.push(result("UNAVAILABLE", "CAPTURE_PROFILE", `${sourceName}: captureProfile is unavailable`));
  } else {
    for (const key of ["tool", "toolVersion", "networkProfile", "cacheMode", "deviceScaleFactor", "rootMarginPx"]) {
      if (!hasOwn(profile, key) || profile[key] === "") {
        results.push(result("UNAVAILABLE", "CAPTURE_PROFILE_FIELD", `${sourceName}: captureProfile.${key} is unavailable`, { field: key }));
      }
    }
    for (const key of ["tool", "toolVersion", "networkProfile", "cacheMode"]) {
      if (hasOwn(profile, key) && !(typeof profile[key] === "string" && profile[key].trim())) {
        results.push(result("CONTRACT_ERROR", "CAPTURE_PROFILE_VALUE", `${sourceName}: captureProfile.${key} must be a non-empty string`, { field: key }));
      }
    }
    if (hasOwn(profile, "cacheMode") && profile.cacheMode !== "cold") {
      results.push(result("CONTRACT_ERROR", "CACHE_MODE", `${sourceName}: captureProfile.cacheMode must be cold`));
    }
    if (hasOwn(profile, "deviceScaleFactor") && profile.deviceScaleFactor !== gate?.deviceScaleFactor) {
      results.push(result("CONTRACT_ERROR", "DEVICE_SCALE_FACTOR", `${sourceName}: capture deviceScaleFactor contradicts policy`));
    }
    if (hasOwn(profile, "rootMarginPx") && profile.rootMarginPx !== 0) {
      results.push(result("CONTRACT_ERROR", "ROOT_MARGIN", `${sourceName}: capture rootMarginPx must be 0`));
    }
  }

  if (!Array.isArray(evidence.pages)) {
    results.push(result("UNAVAILABLE", "PAGES", `${sourceName}: pages capture is unavailable`));
  } else if (evidence.pages.length === 0) {
    results.push(result("UNAVAILABLE", "PAGES_EMPTY", `${sourceName}: no pages were captured`));
  }

  const seenLocales = new Set();
  const pageContexts = [];
  for (const [pageIndex, page] of (Array.isArray(evidence.pages) ? evidence.pages : []).entries()) {
    const pageResults = [];
    const locale = page?.locale;
    if (!isObject(page)) {
      pageResults.push(result("CONTRACT_ERROR", "PAGE_OBJECT", `${sourceName}: pages[${pageIndex}] must be an object`, { pageIndex }));
    } else {
      if (!item?.locales?.includes(locale) || !["ru", "en"].includes(locale)) {
        pageResults.push(result("CONTRACT_ERROR", "PAGE_LOCALE", `${sourceName}: pages[${pageIndex}].locale does not belong to the queue item`, { pageIndex, locale }));
      }
      if (seenLocales.has(locale)) {
        pageResults.push(result("CONTRACT_ERROR", "DUPLICATE_LOCALE", `${sourceName}: duplicate page locale ${locale}`, { pageIndex, locale }));
      }
      seenLocales.add(locale);

      const expectedRaw = item?.publicUrls?.[locale];
      const expected = linkGate ? normalizePublicUrl(expectedRaw, locale, linkGate) : { error: "URL gate unavailable" };
      const actual = linkGate ? normalizePublicUrl(page.url, locale, linkGate) : { error: "URL gate unavailable" };
      if (expected.error) {
        pageResults.push(result("CONTRACT_ERROR", "QUEUE_PUBLIC_URL", `${sourceName}: queue publicUrls.${locale} is invalid: ${expected.error}`, { pageIndex, locale }));
      }
      if (actual.error || (expected.normalized && actual.normalized !== expected.normalized)) {
        pageResults.push(result("CONTRACT_ERROR", "PAGE_PUBLIC_URL", `${sourceName}: page.url does not identify queue publicUrls.${locale}`, { pageIndex, locale }));
      }

      if (!["OK", "UNAVAILABLE"].includes(page.captureState)) {
        pageResults.push(result("CONTRACT_ERROR", "CAPTURE_STATE", `${sourceName}: captureState must be OK or UNAVAILABLE`, { pageIndex, locale }));
      } else if (page.captureState === "OK" && page.unavailableReason != null) {
        pageResults.push(result("CONTRACT_ERROR", "CAPTURE_STATE_CONTRADICTION", `${sourceName}: OK page cannot have unavailableReason`, { pageIndex, locale }));
      } else if (page.captureState === "UNAVAILABLE" && !(typeof page.unavailableReason === "string" && page.unavailableReason.trim())) {
        pageResults.push(result("CONTRACT_ERROR", "CAPTURE_STATE_CONTRADICTION", `${sourceName}: UNAVAILABLE page requires unavailableReason`, { pageIndex, locale }));
      } else if (page.captureState === "UNAVAILABLE" && Array.isArray(page.viewports) && page.viewports.length > 0) {
        pageResults.push(result("CONTRACT_ERROR", "CAPTURE_STATE_CONTRADICTION", `${sourceName}: UNAVAILABLE page cannot contain viewport captures`, { pageIndex, locale }));
      }

      const seenWidths = new Set();
      if (page.captureState === "OK" && !Array.isArray(page.viewports)) {
        pageResults.push(result("UNAVAILABLE", "VIEWPORTS", `${sourceName}: viewport capture is unavailable`, { pageIndex, locale }));
      }
      for (const [viewportIndex, viewport] of (Array.isArray(page.viewports) ? page.viewports : []).entries()) {
        if (!isObject(viewport) || !Number.isInteger(viewport.width)) {
          pageResults.push(result("CONTRACT_ERROR", "VIEWPORT_OBJECT", `${sourceName}: viewport width is invalid`, { pageIndex, viewportIndex, locale }));
          continue;
        }
        if (!(requiredWidths ?? []).includes(viewport.width) || seenWidths.has(viewport.width)) {
          pageResults.push(result("CONTRACT_ERROR", "VIEWPORT_IDENTITY", `${sourceName}: unexpected or duplicate viewport ${viewport.width}`, { pageIndex, viewportIndex, locale, viewportWidth: viewport.width }));
        }
        seenWidths.add(viewport.width);
        if (!["OK", "UNAVAILABLE"].includes(viewport.telemetryState)) {
          pageResults.push(result("CONTRACT_ERROR", "TELEMETRY_STATE", `${sourceName}: telemetryState must be OK or UNAVAILABLE`, { pageIndex, viewportIndex, locale, viewportWidth: viewport.width }));
        } else if (viewport.telemetryState === "OK" && viewport.unavailableReason != null) {
          pageResults.push(result("CONTRACT_ERROR", "TELEMETRY_STATE_CONTRADICTION", `${sourceName}: OK telemetry cannot have unavailableReason`, { pageIndex, viewportIndex, locale, viewportWidth: viewport.width }));
        } else if (viewport.telemetryState === "UNAVAILABLE" && !(typeof viewport.unavailableReason === "string" && viewport.unavailableReason.trim())) {
          pageResults.push(result("CONTRACT_ERROR", "TELEMETRY_STATE_CONTRADICTION", `${sourceName}: UNAVAILABLE telemetry requires unavailableReason`, { pageIndex, viewportIndex, locale, viewportWidth: viewport.width }));
        } else if (viewport.telemetryState === "UNAVAILABLE" && VIEWPORT_TELEMETRY_FIELDS.some((field) => hasOwn(viewport, field))) {
          pageResults.push(result("CONTRACT_ERROR", "TELEMETRY_STATE_CONTRADICTION", `${sourceName}: UNAVAILABLE telemetry cannot contain measured fields`, { pageIndex, viewportIndex, locale, viewportWidth: viewport.width }));
        }
      }
    }
    results.push(...pageResults);
    pageContexts.push({
      pageIndex,
      itemId: evidence.itemId,
      queueItem: item,
      expectedUrl: item?.publicUrls?.[locale],
      gate,
      semanticGate: linkGate,
      captureProfile: profile,
      profileFingerprint: profileFingerprint(profile),
      sourceName,
      preResults: [...results.filter((entry) => !hasOwn(entry, "pageIndex")), ...pageResults],
    });
  }

  return { state: stateFor(results), results, pageContexts, gate, semanticGate: linkGate, queueItem: item };
}

export function validatePublicPage(page, context = {}) {
  const results = [...(context.preResults ?? [])];
  const locale = page?.locale ?? "UNKNOWN";
  const itemId = context.itemId ?? "UNKNOWN";
  const gate = context.gate ?? {};
  const requiredWidths = gate.viewportWidths ?? DEFAULT_REQUIRED_VIEWPORTS;
  const sourceName = context.sourceName ?? "evidence";
  const common = { itemId, locale };
  const add = (state, code, message, details = {}) => results.push(result(state, code, message, { ...common, ...details }));

  if (!isObject(page)) {
    add("CONTRACT_ERROR", "PAGE_OBJECT", `${sourceName}: page must be an object`);
  } else if (page.captureState === "UNAVAILABLE") {
    add("UNAVAILABLE", "PAGE_CAPTURE", `${sourceName}: page capture unavailable: ${page.unavailableReason}`, { reason: page.unavailableReason });
  } else {
    const viewports = Array.isArray(page.viewports) ? page.viewports : [];
    const byWidth = new Map(viewports.filter(isObject).map((viewport) => [viewport.width, viewport]));
    for (const width of requiredWidths) {
      if (!byWidth.has(width)) add("UNAVAILABLE", "VIEWPORT_MISSING", `${sourceName}: required ${width}px viewport is unavailable`, { viewportWidth: width });
    }

    let expectedLogicalIds = null;
    for (const viewport of viewports) {
      if (!isObject(viewport) || !Number.isInteger(viewport.width)) continue;
      const viewportWidth = viewport.width;
      const detail = { viewportWidth };
      if (viewport.telemetryState === "UNAVAILABLE") {
        add("UNAVAILABLE", "TELEMETRY_UNAVAILABLE", `${sourceName}: ${viewportWidth}px telemetry is unavailable`, detail);
        continue;
      }
      if (viewport.telemetryState !== "OK") continue;

      if (!hasOwn(viewport, "httpStatus")) {
        add("UNAVAILABLE", "HTTP_STATUS_FIELD", `${sourceName}: ${viewportWidth}px HTTP status is unavailable`, detail);
      } else if (!Number.isInteger(viewport.httpStatus) || viewport.httpStatus < 100 || viewport.httpStatus > 599) {
        add("CONTRACT_ERROR", "HTTP_STATUS_VALUE", `${sourceName}: ${viewportWidth}px HTTP status is invalid`, detail);
      } else if (viewport.httpStatus !== 200) {
        add("FAIL", "HTTP_STATUS", `${sourceName}: ${viewportWidth}px HTTP status is not 200`, detail);
      }
      for (const field of ["finalUrl", "canonicalUrl"]) {
        if (!hasOwn(viewport, field)) {
          add("UNAVAILABLE", "URL_TELEMETRY", `${sourceName}: ${viewportWidth}px ${field} is unavailable`, { ...detail, field });
          continue;
        }
        if (typeof viewport[field] !== "string" || viewport[field].trim() === "") {
          add("CONTRACT_ERROR", "URL_TELEMETRY_VALUE", `${sourceName}: ${viewportWidth}px ${field} must be a non-empty URL string`, { ...detail, field });
          continue;
        }
        const actual = normalizePublicUrl(viewport[field], locale, context.semanticGate ?? {});
        const expected = normalizePublicUrl(context.expectedUrl, locale, context.semanticGate ?? {});
        if (actual.error || expected.error || actual.normalized !== expected.normalized) {
          add("FAIL", field === "finalUrl" ? "FINAL_URL" : "CANONICAL_URL", `${sourceName}: ${viewportWidth}px ${field} does not match queue public URL`, { ...detail, actual: viewport[field], expected: context.expectedUrl });
        }
      }

      if (!finiteNumber(viewport.viewportHeight, { positive: true })) {
        if (!hasOwn(viewport, "viewportHeight")) add("UNAVAILABLE", "VIEWPORT_HEIGHT", `${sourceName}: ${viewportWidth}px viewportHeight is unavailable`, detail);
        else add("CONTRACT_ERROR", "VIEWPORT_HEIGHT_VALUE", `${sourceName}: ${viewportWidth}px viewportHeight must be positive`, detail);
      }

      const metricNames = ["lcpMs", "cls", "initialViewportTransferBytes", "scrollWidth", "clientWidth"];
      if (!isObject(viewport.metrics)) {
        add("UNAVAILABLE", "METRICS", `${sourceName}: ${viewportWidth}px metrics are unavailable`, detail);
      }
      for (const field of metricNames) {
        if (!isObject(viewport.metrics) || !hasOwn(viewport.metrics, field)) {
          add("UNAVAILABLE", "METRIC_FIELD", `${sourceName}: ${viewportWidth}px metrics.${field} is unavailable`, { ...detail, field });
        } else if (!finiteNumber(viewport.metrics[field], { positive: ["lcpMs", "scrollWidth", "clientWidth"].includes(field) })) {
          add("CONTRACT_ERROR", "METRIC_VALUE", `${sourceName}: ${viewportWidth}px metrics.${field} is invalid`, { ...detail, field });
        }
      }

      const metrics = viewport.metrics ?? {};
      if (finiteNumber(metrics.initialViewportTransferBytes) && metrics.initialViewportTransferBytes > gate.maximumInitialViewportTransferBytes) {
        add("FAIL", "TRANSFER_BUDGET", `${sourceName}: ${viewportWidth}px initial transfer exceeds budget`, { ...detail, actual: metrics.initialViewportTransferBytes, maximum: gate.maximumInitialViewportTransferBytes });
      }
      if (finiteNumber(metrics.scrollWidth, { positive: true }) && finiteNumber(metrics.clientWidth, { positive: true })
        && metrics.scrollWidth - metrics.clientWidth > gate.maximumHorizontalOverflowPx) {
        add("FAIL", "HORIZONTAL_OVERFLOW", `${sourceName}: ${viewportWidth}px has horizontal overflow`, { ...detail, actual: metrics.scrollWidth - metrics.clientWidth, maximum: gate.maximumHorizontalOverflowPx });
      }

      if (!isObject(viewport.baseline)) {
        add("UNAVAILABLE", "BASELINE", `${sourceName}: ${viewportWidth}px baseline is unavailable`, detail);
      } else {
        for (const field of ["lcpMs", "cls", "profileFingerprint"]) {
          if (!hasOwn(viewport.baseline, field)) add("UNAVAILABLE", "BASELINE_FIELD", `${sourceName}: ${viewportWidth}px baseline.${field} is unavailable`, { ...detail, field });
        }
        if (hasOwn(viewport.baseline, "lcpMs") && !finiteNumber(viewport.baseline.lcpMs, { positive: true })) {
          add("CONTRACT_ERROR", "BASELINE_VALUE", `${sourceName}: ${viewportWidth}px baseline.lcpMs is invalid`, { ...detail, field: "lcpMs" });
        }
        if (hasOwn(viewport.baseline, "cls") && !finiteNumber(viewport.baseline.cls)) {
          add("CONTRACT_ERROR", "BASELINE_VALUE", `${sourceName}: ${viewportWidth}px baseline.cls is invalid`, { ...detail, field: "cls" });
        }
        const expectedProfileFingerprint = viewportProfileFingerprint(context.captureProfile, viewportWidth);
        let comparableProfile = false;
        if (hasOwn(viewport.baseline, "profileFingerprint") && !(typeof viewport.baseline.profileFingerprint === "string" && viewport.baseline.profileFingerprint.trim())) {
          add("CONTRACT_ERROR", "BASELINE_VALUE", `${sourceName}: ${viewportWidth}px baseline.profileFingerprint is invalid`, { ...detail, field: "profileFingerprint" });
        } else if (hasOwn(viewport.baseline, "profileFingerprint") && expectedProfileFingerprint === null) {
          add("UNAVAILABLE", "BASELINE_PROFILE", `${sourceName}: ${viewportWidth}px capture profile is unavailable for baseline comparison`, detail);
        } else if (hasOwn(viewport.baseline, "profileFingerprint") && viewport.baseline.profileFingerprint !== expectedProfileFingerprint) {
          add("UNAVAILABLE", "BASELINE_PROFILE", `${sourceName}: ${viewportWidth}px baseline profile does not match capture profile`, detail);
        } else if (hasOwn(viewport.baseline, "profileFingerprint")) {
          comparableProfile = true;
        }
        if (comparableProfile) {
          if (finiteNumber(metrics.lcpMs, { positive: true }) && finiteNumber(viewport.baseline.lcpMs, { positive: true })
            && metrics.lcpMs > viewport.baseline.lcpMs * (1 + gate.maximumLcpRegressionRatio)) {
            add("FAIL", "LCP_REGRESSION", `${sourceName}: ${viewportWidth}px LCP regression exceeds limit`, { ...detail, actual: metrics.lcpMs, baseline: viewport.baseline.lcpMs });
          }
          if (finiteNumber(metrics.cls) && finiteNumber(viewport.baseline.cls)
            && metrics.cls - viewport.baseline.cls > gate.maximumClsRegressionAbsolute) {
            add("FAIL", "CLS_REGRESSION", `${sourceName}: ${viewportWidth}px CLS regression exceeds limit`, { ...detail, actual: metrics.cls, baseline: viewport.baseline.cls });
          }
        }
      }

      if (!Array.isArray(viewport.images)) {
        add("UNAVAILABLE", "IMAGES", `${sourceName}: ${viewportWidth}px image telemetry is unavailable`, detail);
        continue;
      }
      const logicalIds = viewport.images.map((image) => image?.logicalId).filter((value) => typeof value === "string" && value);
      const uniqueIds = new Set(logicalIds);
      const logicalIdsComplete = logicalIds.length === viewport.images.length;
      if (gate.requireSevenUniqueRenderedImages && viewport.images.length !== 7) {
        add("FAIL", "EXACT_SEVEN_IMAGES", `${sourceName}: ${viewportWidth}px must render exactly seven unique images`, { ...detail, imageCount: viewport.images.length, uniqueCount: uniqueIds.size });
      } else if (gate.requireSevenUniqueRenderedImages && logicalIdsComplete && uniqueIds.size !== 7) {
        add("FAIL", "EXACT_SEVEN_IMAGES", `${sourceName}: ${viewportWidth}px must render exactly seven unique images`, { ...detail, imageCount: viewport.images.length, uniqueCount: uniqueIds.size });
      }
      const coverCount = viewport.images.filter((image) => image?.role === "cover").length;
      const inlineCount = viewport.images.filter((image) => INLINE_IMAGE_ROLES.has(image?.role)).length;
      const rolesComplete = viewport.images.every((image) => isObject(image) && hasOwn(image, "role") && (image.role === "cover" || INLINE_IMAGE_ROLES.has(image.role)));
      if (rolesComplete && (coverCount !== 1 || inlineCount !== 6)) {
        add("FAIL", "IMAGE_ROLES", `${sourceName}: ${viewportWidth}px must contain one cover and six inline images`, { ...detail, coverCount, inlineCount });
      }
      const sortedIds = [...uniqueIds].sort();
      if (logicalIdsComplete && expectedLogicalIds === null) expectedLogicalIds = sortedIds;
      else if (logicalIdsComplete && JSON.stringify(expectedLogicalIds) !== JSON.stringify(sortedIds)) {
        add("FAIL", "LOGICAL_IMAGE_SET", `${sourceName}: ${viewportWidth}px logical image set differs across viewports`, detail);
      }

      for (const [imageIndex, image] of viewport.images.entries()) {
        const imageDetail = { ...detail, imageIndex, logicalId: image?.logicalId ?? "UNKNOWN", currentSrc: image?.currentSrc, transferBytes: image?.transferBytes };
        if (!isObject(image)) {
          add("CONTRACT_ERROR", "IMAGE_OBJECT", `${sourceName}: ${viewportWidth}px image ${imageIndex} is invalid`, imageDetail);
          continue;
        }
        for (const field of ["role", "logicalId", "src", "currentSrc", "srcset", "sizes", "declaredWidth", "declaredHeight", "naturalWidth", "naturalHeight", "renderedWidth", "renderedHeight", "transferBytes", "requestedBeforeScroll", "initialTop", "altPresent", "captionPresent"]) {
          if (!hasOwn(image, field)) add("UNAVAILABLE", "IMAGE_FIELD", `${sourceName}: ${viewportWidth}px ${image.logicalId ?? imageIndex}.${field} is unavailable`, { ...imageDetail, field });
        }
        if (hasOwn(image, "role") && image.role !== "cover" && !INLINE_IMAGE_ROLES.has(image.role)) add("CONTRACT_ERROR", "IMAGE_ROLE", `${sourceName}: invalid image role`, imageDetail);
        if (hasOwn(image, "logicalId") && (typeof image.logicalId !== "string" || !image.logicalId)) add("CONTRACT_ERROR", "LOGICAL_ID", `${sourceName}: image logicalId must be non-empty`, imageDetail);
        if (image.altPresent === false) add("FAIL", "ALT_TEXT", `${sourceName}: ${image.logicalId} has no alt text`, imageDetail);
        if (INLINE_IMAGE_ROLES.has(image.role) && image.captionPresent === false) add("FAIL", "CAPTION", `${sourceName}: ${image.logicalId} has no caption`, imageDetail);
        for (const field of ["altPresent", "captionPresent"]) {
          if (hasOwn(image, field) && typeof image[field] !== "boolean") add("CONTRACT_ERROR", "IMAGE_BOOLEAN", `${sourceName}: ${image.logicalId}.${field} must be boolean`, { ...imageDetail, field });
        }
        for (const field of ["src", "currentSrc"]) {
          if (hasOwn(image, field) && typeof image[field] !== "string") add("CONTRACT_ERROR", "IMAGE_URL_VALUE", `${sourceName}: ${image.logicalId}.${field} must be a string`, { ...imageDetail, field });
          else if (hasOwn(image, field) && image[field].trim() === "") add("FAIL", "IMAGE_URL_EMPTY", `${sourceName}: ${image.logicalId}.${field} is empty`, { ...imageDetail, field });
        }
        if (gate.requireResponsiveAttributesOrEquivalent) {
          const hasRecordedEquivalent = hasOwn(image, "responsiveEquivalent") && image.responsiveEquivalent != null;
          if (hasRecordedEquivalent && !responsiveEquivalent(image)) {
            add("CONTRACT_ERROR", "RESPONSIVE_EQUIVALENT", `${sourceName}: ${image.logicalId}.responsiveEquivalent is invalid or unsupported`, imageDetail);
          }
          for (const field of ["srcset", "sizes"]) {
            if (hasOwn(image, field) && typeof image[field] !== "string") {
              add("CONTRACT_ERROR", "RESPONSIVE_ATTRIBUTE_VALUE", `${sourceName}: ${image.logicalId}.${field} must be a string`, { ...imageDetail, field });
            } else if (hasOwn(image, field) && image[field].trim() === "" && !responsiveEquivalent(image)) {
              add("FAIL", "RESPONSIVE_ATTRIBUTE", `${sourceName}: ${image.logicalId}.${field} is empty without a recorded equivalent`, { ...imageDetail, field });
            }
          }
        }
        for (const field of ["declaredWidth", "declaredHeight", "naturalWidth", "naturalHeight", "renderedWidth", "renderedHeight"]) {
          if (hasOwn(image, field) && !finiteNumber(image[field], { positive: true })) add("CONTRACT_ERROR", "IMAGE_DIMENSION", `${sourceName}: ${image.logicalId}.${field} must be positive`, { ...imageDetail, field });
        }
        if (hasOwn(image, "transferBytes") && !finiteNumber(image.transferBytes)) add("CONTRACT_ERROR", "IMAGE_TRANSFER", `${sourceName}: ${image.logicalId}.transferBytes is invalid`, imageDetail);
        if (hasOwn(image, "requestedBeforeScroll") && typeof image.requestedBeforeScroll !== "boolean") add("CONTRACT_ERROR", "IMAGE_REQUEST_STATE", `${sourceName}: ${image.logicalId}.requestedBeforeScroll must be boolean`, imageDetail);
        if (hasOwn(image, "initialTop") && !finiteNumber(image.initialTop)) add("CONTRACT_ERROR", "IMAGE_INITIAL_TOP", `${sourceName}: ${image.logicalId}.initialTop is invalid`, imageDetail);

        if (gate.requireNoDistortedAspectRatio
          && ["declaredWidth", "declaredHeight", "naturalWidth", "naturalHeight", "renderedWidth", "renderedHeight"].every((field) => finiteNumber(image[field], { positive: true }))) {
          const natural = aspectRatio(image.naturalWidth, image.naturalHeight);
          const declared = aspectRatio(image.declaredWidth, image.declaredHeight);
          const rendered = aspectRatio(image.renderedWidth, image.renderedHeight);
          if (aspectMismatch(natural, declared) || aspectMismatch(natural, rendered)) {
            add("FAIL", "ASPECT_RATIO", `${sourceName}: ${image.logicalId} aspect ratio differs by more than 1%`, imageDetail);
          }
        }
        if (finiteNumber(image.naturalWidth, { positive: true }) && finiteNumber(image.renderedWidth, { positive: true })) {
          const maximum = Math.ceil(image.renderedWidth * (context.captureProfile?.deviceScaleFactor ?? gate.deviceScaleFactor) * gate.maximumResponsiveOversupplyRatio);
          if (image.naturalWidth > maximum) add("FAIL", "RESPONSIVE_OVERSUPPLY", `${sourceName}: ${image.logicalId} currentSrc is oversized`, { ...imageDetail, naturalWidth: image.naturalWidth, maximum });
        }
        if (gate.requireBelowFoldImagesDeferred && image.requestedBeforeScroll === true
          && finiteNumber(image.initialTop) && finiteNumber(viewport.viewportHeight, { positive: true })
          && image.initialTop >= viewport.viewportHeight + (context.captureProfile?.rootMarginPx ?? 0)) {
          add("FAIL", "BELOW_FOLD_EAGER", `${sourceName}: ${image.logicalId} was requested before scroll while below the viewport`, imageDetail);
        }
      }
    }
  }

  const state = stateFor(results);
  return {
    itemId,
    locale,
    url: page?.url ?? null,
    state,
    outcome: state === "PASS" ? "PASS" : state === "UNAVAILABLE" ? "INCOMPLETE" : "FAIL",
    results: results.length > 0 ? results : [result("PASS", "PAGE", `${sourceName}: page passed`, common)],
  };
}

export function summarizePublicPageResults(pageResults) {
  const counts = Object.fromEntries([...STATES].map((state) => [state, pageResults.filter((page) => page.state === state).length]));
  const failing = counts.FAIL > 0 || counts.CONTRACT_ERROR > 0;
  const incomplete = !failing && (counts.UNAVAILABLE > 0 || pageResults.length === 0);
  return {
    overall: failing ? "FAIL" : incomplete ? "INCOMPLETE" : "PASS",
    exitCode: failing ? 1 : 0,
    counts,
    pageResults,
  };
}

export async function runPublicPageCheck(options = {}) {
  const rootDir = options.rootDir ?? ROOT_DIR;
  let evidencePaths;
  try {
    evidencePaths = options.evidencePaths ?? parseEvidenceCliArgs(options.args ?? process.argv.slice(2)).evidencePaths;
  } catch (error) {
    return { overall: "CONTRACT_ERROR", exitCode: 2, counts: {}, pageResults: [], cliError: error.message };
  }

  let policy = options.policy;
  let queue = options.queue;
  const evidenceRecords = [];
  try {
    policy ??= JSON.parse(await readFile(resolve(rootDir, "config/editorial-policy.json"), "utf8"));
    queue ??= JSON.parse(await readFile(resolve(rootDir, "content/queue.json"), "utf8"));
    for (const evidencePath of evidencePaths) {
      const absolutePath = resolve(rootDir, evidencePath);
      evidenceRecords.push({ sourceName: evidencePath, evidence: JSON.parse(await readFile(absolutePath, "utf8")) });
    }
  } catch (error) {
    return { overall: "CONTRACT_ERROR", exitCode: 2, counts: {}, pageResults: [], cliError: `cannot read JSON input: ${error.message}` };
  }

  const pageResults = [];
  const identities = new Set();
  const itemLocales = new Map();
  const fingerprints = new Set();
  for (const { sourceName, evidence } of evidenceRecords) {
    const contract = validateEvidenceContract(evidence, { policy, queue, sourceName });
    if (contract.pageContexts.length === 0 && contract.queueItem && contract.state === "UNAVAILABLE") {
      const locales = itemLocales.get(evidence.itemId) ?? new Set();
      for (const locale of contract.queueItem.locales ?? []) {
        if (!contract.queueItem.publicUrls?.[locale]) continue;
        locales.add(locale);
        identities.add(`${evidence.itemId}\0${locale}`);
        pageResults.push({
          itemId: evidence.itemId,
          locale,
          url: contract.queueItem.publicUrls[locale],
          state: "UNAVAILABLE",
          outcome: "INCOMPLETE",
          results: [...contract.results, result("UNAVAILABLE", "PAGE_MISSING", `page capture for ${evidence.itemId}/${locale} is unavailable`, { itemId: evidence.itemId, locale })],
        });
      }
      itemLocales.set(evidence.itemId, locales);
    } else if (contract.pageContexts.length === 0) {
      pageResults.push({
        itemId: evidence?.itemId ?? "UNKNOWN",
        locale: "UNKNOWN",
        url: null,
        state: contract.state,
        outcome: contract.state === "UNAVAILABLE" ? "INCOMPLETE" : "FAIL",
        results: contract.results,
      });
    }
    for (const [index, page] of (Array.isArray(evidence?.pages) ? evidence.pages : []).entries()) {
      const pageContext = contract.pageContexts[index] ?? { preResults: contract.results };
      const identity = `${evidence.itemId}\0${page?.locale}`;
      if (identities.has(identity)) {
        pageContext.preResults = [...(pageContext.preResults ?? []), result("CONTRACT_ERROR", "DUPLICATE_PAGE_IDENTITY", `${sourceName}: duplicate itemId/locale capture`, { itemId: evidence.itemId, locale: page?.locale })];
      }
      identities.add(identity);
      const locales = itemLocales.get(evidence.itemId) ?? new Set();
      locales.add(page?.locale);
      itemLocales.set(evidence.itemId, locales);
      pageResults.push(validatePublicPage(page, pageContext));
    }
    const fingerprint = profileFingerprint(evidence?.captureProfile);
    if (fingerprint) fingerprints.add(fingerprint);
  }

  if (fingerprints.size > 1) {
    pageResults.push({ itemId: "MULTIPLE", locale: "UNKNOWN", url: null, state: "CONTRACT_ERROR", outcome: "FAIL", results: [result("CONTRACT_ERROR", "PROFILE_CONTRADICTION", "evidence files use contradictory capture profiles")] });
  }
  for (const [itemId, locales] of itemLocales) {
    const item = queue.items?.find(({ id }) => id === itemId);
    for (const locale of item?.locales ?? []) {
      if (item.publicUrls?.[locale] && !locales.has(locale)) {
        pageResults.push({ itemId, locale, url: item.publicUrls[locale], state: "UNAVAILABLE", outcome: "INCOMPLETE", results: [result("UNAVAILABLE", "PAGE_MISSING", `page capture for ${itemId}/${locale} is unavailable`, { itemId, locale })] });
      }
    }
  }
  return summarizePublicPageResults(pageResults);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = await runPublicPageCheck();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.exitCode;
}
