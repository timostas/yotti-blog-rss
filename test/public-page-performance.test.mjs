import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseEvidenceCliArgs,
  runPublicPageCheck,
  summarizePublicPageResults,
  validateEvidenceContract,
  validatePublicPage,
} from "../scripts/check-public-page-performance.mjs";

const GATE = {
  viewportWidths: [360, 390, 720],
  deviceScaleFactor: 1,
  maximumInitialViewportTransferBytes: 1572864,
  maximumHorizontalOverflowPx: 0,
  maximumLcpRegressionRatio: 0.15,
  maximumClsRegressionAbsolute: 0.02,
  maximumResponsiveOversupplyRatio: 1.25,
  requireSevenUniqueRenderedImages: true,
  requireResponsiveAttributesOrEquivalent: true,
  requireNoDistortedAspectRatio: true,
  requireBelowFoldImagesDeferred: true,
};

const SEMANTIC_GATE = {
  allowedHosts: ["yotti.net", "www.yotti.net"],
  localeArticlePathPrefixes: { ru: "/blog/", en: "/en/blog/" },
  excludedFirstSegments: ["tag", "category", "esim", "plans"],
};

const POLICY = {
  quality: {
    semanticInternalLinkGates: SEMANTIC_GATE,
    longFormVisualGates: { publicPostSyncPerformanceGates: GATE },
  },
};

const QUEUE = {
  items: [{
    id: "pilot",
    locales: ["ru", "en"],
    publicUrls: {
      ru: "https://yotti.net/blog/pilot",
      en: "https://yotti.net/en/blog/pilot",
    },
  }],
};

function fingerprint(profile) {
  const keys = ["tool", "toolVersion", "networkProfile", "cacheMode", "deviceScaleFactor", "rootMarginPx"];
  return JSON.stringify(Object.fromEntries(keys.map((key) => [key, profile[key]])));
}

function imageFixture(width, index) {
  const renderedWidth = width - 24;
  const naturalWidth = width === 720 ? 800 : width === 390 ? 450 : 400;
  const role = index === 0 ? "cover" : index <= 2 ? "contextual-photo" : "information-graphic";
  return {
    role,
    logicalId: role === "cover" ? "cover" : `inline-${index}`,
    src: `https://cdn.example.test/${role}-${index}-1440.webp`,
    currentSrc: `https://cdn.example.test/${role}-${index}-${naturalWidth}.webp`,
    srcset: `https://cdn.example.test/${role}-${index}-400.webp 400w, https://cdn.example.test/${role}-${index}-800.webp 800w`,
    sizes: "(max-width: 760px) calc(100vw - 24px), 760px",
    declaredWidth: role === "cover" ? 1600 : 1440,
    declaredHeight: role === "cover" ? 900 : 810,
    naturalWidth,
    naturalHeight: naturalWidth * 9 / 16,
    renderedWidth,
    renderedHeight: renderedWidth * 9 / 16,
    transferBytes: 20000,
    requestedBeforeScroll: index <= 1,
    initialTop: index === 0 ? 0 : index === 1 ? 600 : 850 + index * 250,
    altPresent: true,
    captionPresent: role !== "cover",
  };
}

function evidenceFixture() {
  const captureProfile = {
    tool: "playwright",
    toolVersion: "1.55.0",
    networkProfile: "mobile-cold-v1",
    cacheMode: "cold",
    deviceScaleFactor: 1,
    rootMarginPx: 0,
  };
  return {
    schemaVersion: 1,
    itemId: "pilot",
    capturedAt: "2026-09-06T20:00:00Z",
    captureProfile,
    pages: ["ru", "en"].map((locale) => ({
      locale,
      url: QUEUE.items[0].publicUrls[locale],
      captureState: "OK",
      unavailableReason: null,
      viewports: GATE.viewportWidths.map((width) => ({
        width,
        viewportHeight: 800,
        httpStatus: 200,
        finalUrl: QUEUE.items[0].publicUrls[locale],
        canonicalUrl: QUEUE.items[0].publicUrls[locale],
        telemetryState: "OK",
        metrics: {
          lcpMs: 1050,
          cls: 0.02,
          initialViewportTransferBytes: 250000,
          scrollWidth: width,
          clientWidth: width,
        },
        baseline: { lcpMs: 1000, cls: 0.01, profileFingerprint: fingerprint(captureProfile) },
        images: Array.from({ length: 7 }, (_, index) => imageFixture(width, index)),
      })),
    })),
  };
}

function validateFixture(evidence) {
  const contract = validateEvidenceContract(evidence, { policy: POLICY, queue: QUEUE, sourceName: "fixture.json" });
  const pageResults = evidence.pages.map((page, index) => validatePublicPage(page, contract.pageContexts[index]));
  return summarizePublicPageResults(pageResults);
}

async function runEvidenceFiles(evidences) {
  const rootDir = await mkdtemp(join(tmpdir(), "yotti-public-page-"));
  const evidencePaths = [];
  try {
    for (const [index, evidence] of evidences.entries()) {
      const name = `capture-${index}.json`;
      await writeFile(join(rootDir, name), JSON.stringify(evidence));
      evidencePaths.push(name);
    }
    return await runPublicPageCheck({ rootDir, evidencePaths, policy: POLICY, queue: QUEUE });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

function resultCodes(report) {
  return report.pageResults.flatMap((page) => page.results.map(({ code }) => code));
}

test("CLI accepts repeated evidence flags and rejects usage errors", () => {
  assert.deepEqual(parseEvidenceCliArgs(["--evidence", "ru.json", "--evidence", "en.json"]), { evidencePaths: ["ru.json", "en.json"] });
  for (const args of [[], ["--evidence"], ["--evidence", "-x"], ["--unknown", "x"], ["--evidence", "x", "--evidence", "x"]]) {
    assert.throws(() => parseEvidenceCliArgs(args));
  }
});

test("full RU and EN evidence passes at exactly 360, 390 and 720", async () => {
  const report = await runEvidenceFiles([evidenceFixture()]);
  assert.equal(report.overall, "PASS");
  assert.equal(report.exitCode, 0);
  assert.deepEqual(report.counts, { PASS: 2, FAIL: 0, UNAVAILABLE: 0, CONTRACT_ERROR: 0 });
});

test("HTTP, final URL and canonical URL measured mismatches fail", async (t) => {
  for (const scenario of [
    ["HTTP_STATUS", (e) => { e.pages[0].viewports[0].httpStatus = 503; }],
    ["FINAL_URL", (e) => { e.pages[0].viewports[0].finalUrl = "https://yotti.net/blog/other"; }],
    ["CANONICAL_URL", (e) => { e.pages[0].viewports[0].canonicalUrl = "https://yotti.net/blog/other"; }],
  ]) {
    await t.test(scenario[0], () => {
      const evidence = evidenceFixture();
      scenario[1](evidence);
      const report = validateFixture(evidence);
      assert.equal(report.exitCode, 1);
      assert.ok(resultCodes(report).includes(scenario[0]));
    });
  }
});

test("missing HTTP telemetry is UNAVAILABLE while malformed HTTP is CONTRACT_ERROR", async (t) => {
  await t.test("missing", () => {
    const evidence = evidenceFixture();
    delete evidence.pages[0].viewports[0].httpStatus;
    const report = validateFixture(evidence);
    assert.equal(report.overall, "INCOMPLETE");
    assert.ok(resultCodes(report).includes("HTTP_STATUS_FIELD"));
  });
  await t.test("malformed", () => {
    const evidence = evidenceFixture();
    evidence.pages[0].viewports[0].httpStatus = "200";
    const report = validateFixture(evidence);
    assert.equal(report.overall, "FAIL");
    assert.ok(resultCodes(report).includes("HTTP_STATUS_VALUE"));
  });
});

test("each numeric, responsive, aspect and lazy-load defect fails independently", async (t) => {
  const scenarios = [
    ["LCP_REGRESSION", (v) => { v.metrics.lcpMs = 1151; }],
    ["CLS_REGRESSION", (v) => { v.metrics.cls = 0.031; }],
    ["HORIZONTAL_OVERFLOW", (v) => { v.metrics.scrollWidth = v.width + 1; }],
    ["TRANSFER_BUDGET", (v) => { v.metrics.initialViewportTransferBytes = 1572865; }],
    ["RESPONSIVE_OVERSUPPLY", (v) => { v.images[0].naturalWidth = 1000; v.images[0].naturalHeight = 562.5; }],
    ["ASPECT_RATIO", (v) => { v.images[0].renderedHeight = 300; }],
    ["BELOW_FOLD_EAGER", (v) => { v.images[2].requestedBeforeScroll = true; }],
  ];
  for (const [code, mutate] of scenarios) {
    await t.test(code, () => {
      const evidence = evidenceFixture();
      mutate(evidence.pages[0].viewports[0]);
      const report = validateFixture(evidence);
      assert.equal(report.overall, "FAIL");
      assert.ok(resultCodes(report).includes(code));
    });
  }
});

test("empty responsive attributes fail when complete telemetry records no equivalent", () => {
  const evidence = evidenceFixture();
  evidence.pages[0].viewports[0].images[0].srcset = "";
  evidence.pages[0].viewports[0].images[0].sizes = "";
  const report = validateFixture(evidence);
  assert.equal(report.exitCode, 1);
  assert.equal(resultCodes(report).filter((code) => code === "RESPONSIVE_ATTRIBUTE").length, 2);
});

test("recorded responsive equivalent permits stripped attributes", () => {
  const evidence = evidenceFixture();
  const image = evidence.pages[0].viewports[0].images[0];
  image.srcset = "";
  image.sizes = "";
  image.responsiveEquivalent = { type: "cdn-width-transform", observed: true };
  assert.equal(validateFixture(evidence).overall, "PASS");
});

test("responsive equivalent requires structured observed evidence", () => {
  const evidence = evidenceFixture();
  const image = evidence.pages[0].viewports[0].images[0];
  image.srcset = "";
  image.sizes = "";
  image.responsiveEquivalent = true;
  const report = validateFixture(evidence);
  assert.equal(report.overall, "FAIL");
  assert.ok(resultCodes(report).includes("RESPONSIVE_ATTRIBUTE"));
});

test("different currentSrc candidates retain the same seven logical images", () => {
  const evidence = evidenceFixture();
  const candidates = evidence.pages[0].viewports.map((viewport) => viewport.images[1].currentSrc);
  assert.equal(new Set(candidates).size, 3);
  assert.equal(validateFixture(evidence).overall, "PASS");
});

test("exact-seven and logical-set checks do not collapse responsive candidates", async (t) => {
  await t.test("six images fail", () => {
    const evidence = evidenceFixture();
    evidence.pages[0].viewports[0].images.pop();
    const report = validateFixture(evidence);
    assert.ok(resultCodes(report).includes("EXACT_SEVEN_IMAGES"));
    assert.equal(report.exitCode, 1);
  });
  await t.test("duplicate logical id fails", () => {
    const evidence = evidenceFixture();
    evidence.pages[0].viewports[0].images[6].logicalId = "inline-5";
    const report = validateFixture(evidence);
    assert.ok(resultCodes(report).includes("EXACT_SEVEN_IMAGES"));
    assert.equal(report.exitCode, 1);
  });
});

test("missing page, browser profile and trace telemetry stay UNAVAILABLE with exit 0", async (t) => {
  await t.test("no pages", async () => {
    const evidence = evidenceFixture();
    evidence.pages = [];
    const report = await runEvidenceFiles([evidence]);
    assert.equal(report.overall, "INCOMPLETE");
    assert.equal(report.exitCode, 0);
    assert.deepEqual(report.pageResults.map(({ locale, state }) => ({ locale, state })), [
      { locale: "ru", state: "UNAVAILABLE" },
      { locale: "en", state: "UNAVAILABLE" },
    ]);
  });
  await t.test("capture tool absent", async () => {
    const evidence = evidenceFixture();
    delete evidence.captureProfile.tool;
    const report = await runEvidenceFiles([evidence]);
    assert.equal(report.overall, "INCOMPLETE");
    assert.equal(report.exitCode, 0);
    assert.ok(resultCodes(report).includes("CAPTURE_PROFILE_FIELD"));
  });
  await t.test("page explicitly unavailable", async () => {
    const evidence = evidenceFixture();
    evidence.pages[0] = { locale: "ru", url: QUEUE.items[0].publicUrls.ru, captureState: "UNAVAILABLE", unavailableReason: "trace file missing", viewports: [] };
    const report = await runEvidenceFiles([evidence]);
    assert.equal(report.overall, "INCOMPLETE");
    assert.equal(report.exitCode, 0);
    assert.ok(resultCodes(report).includes("PAGE_CAPTURE"));
  });
});

test("missing image identity fields remain UNAVAILABLE rather than fabricated FAIL", () => {
  const evidence = evidenceFixture();
  delete evidence.pages[0].viewports[0].images[0].role;
  delete evidence.pages[0].viewports[0].images[1].logicalId;
  const report = validateFixture(evidence);
  assert.equal(report.overall, "INCOMPLETE");
  assert.equal(report.exitCode, 0);
  assert.ok(resultCodes(report).includes("IMAGE_FIELD"));
  assert.ok(!resultCodes(report).includes("IMAGE_ROLES"));
  assert.ok(!resultCodes(report).includes("EXACT_SEVEN_IMAGES"));
});

test("missing required telemetry or matching baseline is UNAVAILABLE, never fake zero", async (t) => {
  for (const [name, mutate, code] of [
    ["metric", (v) => { delete v.metrics.lcpMs; }, "METRIC_FIELD"],
    ["image field", (v) => { delete v.images[0].currentSrc; }, "IMAGE_FIELD"],
    ["baseline", (v) => { delete v.baseline; }, "BASELINE"],
    ["baseline profile", (v) => { v.baseline.profileFingerprint = "other-profile"; }, "BASELINE_PROFILE"],
  ]) {
    await t.test(name, () => {
      const evidence = evidenceFixture();
      mutate(evidence.pages[0].viewports[0]);
      const report = validateFixture(evidence);
      assert.equal(report.overall, "INCOMPLETE");
      assert.equal(report.exitCode, 0);
      assert.ok(resultCodes(report).includes(code));
    });
  }
});

test("PASS plus UNAVAILABLE exits 0 incomplete; FAIL plus UNAVAILABLE exits 1 and preserves both", async () => {
  const incomplete = evidenceFixture();
  incomplete.pages[1] = { locale: "en", url: QUEUE.items[0].publicUrls.en, captureState: "UNAVAILABLE", unavailableReason: "browser unavailable", viewports: [] };
  const incompleteReport = await runEvidenceFiles([incomplete]);
  assert.equal(incompleteReport.overall, "INCOMPLETE");
  assert.equal(incompleteReport.exitCode, 0);
  assert.deepEqual(new Set(incompleteReport.pageResults.map(({ state }) => state)), new Set(["PASS", "UNAVAILABLE"]));

  incomplete.pages[0].viewports[0].httpStatus = 500;
  const failedReport = await runEvidenceFiles([incomplete]);
  assert.equal(failedReport.overall, "FAIL");
  assert.equal(failedReport.exitCode, 1);
  assert.deepEqual(new Set(failedReport.pageResults.map(({ state }) => state)), new Set(["FAIL", "UNAVAILABLE"]));
});

test("identity, schema and profile contradictions are CONTRACT_ERROR with exit 1", async (t) => {
  for (const [name, mutate] of [
    ["item", (e) => { e.itemId = "unknown"; }],
    ["locale", (e) => { e.pages[0].locale = "de"; }],
    ["public URL", (e) => { e.pages[0].url = "https://yotti.net/blog/other"; }],
    ["schema", (e) => { e.schemaVersion = 2; }],
    ["profile", (e) => { e.captureProfile.deviceScaleFactor = 2; }],
  ]) {
    await t.test(name, async () => {
      const evidence = evidenceFixture();
      mutate(evidence);
      const report = await runEvidenceFiles([evidence]);
      assert.equal(report.overall, "FAIL");
      assert.equal(report.exitCode, 1);
      assert.ok(report.pageResults.some(({ state }) => state === "CONTRACT_ERROR"));
    });
  }
});

test("contradictory profiles across evidence files are aggregated as CONTRACT_ERROR", async () => {
  const first = evidenceFixture();
  first.pages = [first.pages[0]];
  const second = evidenceFixture();
  second.pages = [second.pages[1]];
  second.captureProfile.toolVersion = "1.56.0";
  for (const viewport of second.pages[0].viewports) viewport.baseline.profileFingerprint = fingerprint(second.captureProfile);
  const report = await runEvidenceFiles([first, second]);
  assert.equal(report.exitCode, 1);
  assert.ok(resultCodes(report).includes("PROFILE_CONTRADICTION"));
});

test("unreadable and non-JSON evidence are CLI errors with exit 2", async (t) => {
  await t.test("unreadable", async () => {
    const report = await runPublicPageCheck({ rootDir: tmpdir(), evidencePaths: ["does-not-exist.json"], policy: POLICY, queue: QUEUE });
    assert.equal(report.exitCode, 2);
    assert.equal(report.overall, "CONTRACT_ERROR");
  });
  await t.test("non-JSON", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "yotti-public-page-bad-json-"));
    try {
      await writeFile(join(rootDir, "bad.json"), "not json");
      const report = await runPublicPageCheck({ rootDir, evidencePaths: ["bad.json"], policy: POLICY, queue: QUEUE });
      assert.equal(report.exitCode, 2);
      assert.equal(report.overall, "CONTRACT_ERROR");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

test("validator aggregates every page, viewport and image without fail-fast", () => {
  const evidence = evidenceFixture();
  for (const page of evidence.pages) {
    for (const viewport of page.viewports) {
      viewport.httpStatus = 500;
      for (const image of viewport.images) image.altPresent = false;
    }
  }
  const report = validateFixture(evidence);
  assert.equal(resultCodes(report).filter((code) => code === "HTTP_STATUS").length, 6);
  assert.equal(resultCodes(report).filter((code) => code === "ALT_TEXT").length, 42);
  assert.equal(report.exitCode, 1);
});
