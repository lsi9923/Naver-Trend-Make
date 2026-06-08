import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildTrendAutoCollectionQueue,
  buildTrendAutoCollectionQueueForRoots,
  buildTrendCollectionInputForCategory,
  createTrendCollectionSettingsSnapshot,
  runTrendAutoCollectionQueue,
  stopTrendAutoCollectionRun
} from "../../shared/dist/index.js";

const rootCategory = {
  cid: 1,
  name: "패션의류",
  fullPath: "패션의류",
  level: 1,
  leaf: false
};

const categoryA = {
  cid: 2,
  name: "여성의류",
  fullPath: "패션의류 > 여성의류",
  level: 2,
  leaf: false
};

const categoryB = {
  cid: 3,
  name: "남성의류",
  fullPath: "패션의류 > 남성의류",
  level: 2,
  leaf: true
};

const categoryA1 = {
  cid: 4,
  name: "니트",
  fullPath: "패션의류 > 여성의류 > 니트",
  level: 3,
  leaf: true
};

const categoryA2 = {
  cid: 5,
  name: "원피스",
  fullPath: "패션의류 > 여성의류 > 원피스",
  level: 3,
  leaf: true
};

const rootCategory2 = {
  cid: 10,
  name: "패션잡화",
  fullPath: "패션잡화",
  level: 1,
  leaf: false
};

const categoryC = {
  cid: 11,
  name: "가방",
  fullPath: "패션잡화 > 가방",
  level: 2,
  leaf: true
};

test("auto-start-queues-leaf-categories", async () => {
  const requestedParents = [];
  const childrenByCid = new Map([
    [1, [categoryA, categoryB]],
    [2, [categoryA1, categoryA2]]
  ]);

  const queue = await buildTrendAutoCollectionQueue(rootCategory, async (cid) => {
    requestedParents.push(cid);
    return childrenByCid.get(cid) ?? [];
  });

  assert.deepEqual(
    queue.map((category) => category.cid),
    [4, 5, 3],
    "auto collection should flatten non-leaf branches into leaf categories in stable order"
  );
  assert.deepEqual(requestedParents, [1, 2], "leaf categories should not be fetched again");

  const settings = createTrendCollectionSettingsSnapshot({
    devices: ["pc"],
    genders: ["f"],
    ages: ["20"],
    resultCount: 40,
    excludeBrandProducts: true,
    customExcludedTermsInput: "nike, adidas"
  });
  const collectedPayloads = [];

  const summary = await runTrendAutoCollectionQueue({
    categories: queue,
    settings,
    collect: async (payload) => {
      collectedPayloads.push(payload);
      return {
        ok: true,
        run: { id: `run-${payload.categoryCid}`, status: "completed" }
      };
    }
  });

  assert.equal(summary.status, "completed");
  assert.equal(summary.completedCount, 3);
  assert.deepEqual(
    collectedPayloads.map((payload) => payload.categoryCid),
    [4, 5, 3],
    "collect requests should be issued sequentially in queue order"
  );
  assert.deepEqual(
    collectedPayloads.map((payload) => payload.customExcludedTerms),
    [
      ["adidas", "nike"],
      ["adidas", "nike"],
      ["adidas", "nike"]
    ],
    "every auto request should use the same normalized settings snapshot"
  );
});

test("auto-start-without-selected-category-queues-all-root-leaves", async () => {
  const requestedParents = [];
  const childrenByCid = new Map([
    [1, [categoryA, categoryB]],
    [2, [categoryA1, categoryA2]],
    [10, [categoryC]]
  ]);

  const queue = await buildTrendAutoCollectionQueueForRoots([rootCategory, rootCategory2], async (cid) => {
    requestedParents.push(cid);
    return childrenByCid.get(cid) ?? [];
  });

  assert.deepEqual(
    queue.map((category) => category.cid),
    [4, 5, 3, 11],
    "auto collection with no selected category should flatten every first-level root in stable order"
  );
  assert.deepEqual(requestedParents, [1, 2, 10], "all non-leaf roots should be fetched while leaf categories are not fetched again");
});

test("auto-stop-cancels-active-run", async () => {
  const cancelCalls = [];

  const stopResult = await stopTrendAutoCollectionRun("run-active", async (runId) => {
    cancelCalls.push(runId);
    return { ok: true };
  });

  assert.deepEqual(stopResult, { cancelRequested: true, runId: "run-active" });
  assert.deepEqual(cancelCalls, ["run-active"], "auto stop should request cancellation for the active run");

  let stopRequested = false;
  const collectedPayloads = [];
  const summary = await runTrendAutoCollectionQueue({
    categories: [categoryA1, categoryA2, categoryB],
    settings: createTrendCollectionSettingsSnapshot({ resultCount: 20, excludeBrandProducts: false }),
    shouldStop: () => stopRequested,
    collect: async (payload) => {
      collectedPayloads.push(payload);
      stopRequested = true;
      return { ok: true, run: { id: "run-first", status: "completed" } };
    }
  });

  assert.equal(summary.status, "stopped");
  assert.deepEqual(
    collectedPayloads.map((payload) => payload.categoryCid),
    [4],
    "auto stop should prevent the next category from starting"
  );
});

test("auto-collection-stops-on-first-collect-failure-when-enabled", async () => {
  const collectedPayloads = [];
  const summary = await runTrendAutoCollectionQueue({
    categories: [categoryA1, categoryA2, categoryB],
    settings: createTrendCollectionSettingsSnapshot({ resultCount: 20, excludeBrandProducts: false }),
    stopOnFirstFailure: true,
    collect: async (payload) => {
      collectedPayloads.push(payload);
      return { ok: false, message: "API 연결 실패" };
    }
  });

  assert.equal(summary.status, "stopped");
  assert.equal(summary.failedCount, 1);
  assert.deepEqual(
    collectedPayloads.map((payload) => payload.categoryCid),
    [4],
    "auto collection should not keep burning through every category when the API is down"
  );
});

test("auto-collection-retries-the-same-category-after-transient-api-failure", async () => {
  const collectedPayloads = [];
  const retryEvents = [];
  const settings = createTrendCollectionSettingsSnapshot({ resultCount: 20, excludeBrandProducts: false });

  const summary = await runTrendAutoCollectionQueue({
    categories: [categoryA1, categoryA2],
    settings,
    stopOnFirstFailure: true,
    maxAttemptsPerCategory: 2,
    retryDelayMs: 0,
    onRetry: async (event) => {
      retryEvents.push(event);
    },
    collect: async (payload) => {
      collectedPayloads.push(payload);

      if (payload.categoryCid === categoryA1.cid && collectedPayloads.filter((item) => item.categoryCid === categoryA1.cid).length === 1) {
        return { ok: false, message: "NETWORK_ERROR" };
      }

      return { ok: true, run: { id: `run-${payload.categoryCid}`, status: "completed" } };
    }
  });

  assert.equal(summary.status, "completed");
  assert.equal(summary.completedCount, 2);
  assert.equal(summary.failedCount, 0);
  assert.deepEqual(
    collectedPayloads.map((payload) => payload.categoryCid),
    [4, 4, 5],
    "a transient API failure should retry the same category before moving on"
  );
  assert.deepEqual(
    retryEvents.map((event) => [event.category.cid, event.attempt, event.maxAttempts]),
    [[4, 1, 2]],
    "retry callback should report the same category and attempt count"
  );
});

test("auto-collection-keeps-brand-terms-empty-when-off", () => {
  const settings = createTrendCollectionSettingsSnapshot({
    devices: ["mo"],
    genders: ["m"],
    ages: ["30"],
    resultCount: 20,
    excludeBrandProducts: false,
    customExcludedTermsInput: "나이키, 아디다스"
  });

  const payload = buildTrendCollectionInputForCategory(categoryA1, settings, "자동 테스트");

  assert.equal(payload.excludeBrandProducts, false);
  assert.deepEqual(payload.customExcludedTerms, [], "hidden brand terms must not leak into auto collection payloads");
});

test("single-start-unchanged", () => {
  const settings = createTrendCollectionSettingsSnapshot({
    devices: [],
    genders: [],
    ages: [],
    resultCount: 20,
    excludeBrandProducts: false
  });

  const payload = buildTrendCollectionInputForCategory(categoryB, settings, "단일 분석");

  assert.equal(payload.categoryCid, 3);
  assert.equal(payload.categoryPath, "패션의류 > 남성의류");
  assert.deepEqual(payload.devices, []);
  assert.deepEqual(payload.genders, []);
  assert.deepEqual(payload.ages, []);
  assert.deepEqual(payload.customExcludedTerms, []);
});

test("collection-start-requests-force-fresh-naver-collection", () => {
  const pageSource = fs.readFileSync("web/app/sourcing/admin/page.tsx", "utf8");
  const apiSource = fs.readFileSync("edge-api/src/index.ts", "utf8");

  assert.match(
    pageSource,
    /forceRefresh:\s*true/,
    "collection start requests must force a fresh collection instead of reusing saved runs"
  );
  assert.match(
    apiSource,
    /if \(profile && !forceRefresh\)/,
    "forceRefresh must bypass completed-run reuse"
  );
  assert.match(
    apiSource,
    /const targetPeriods = options\.forceRefresh\s*\?\s*periods/,
    "forceRefresh must put all periods back into the run queue"
  );
  assert.match(
    apiSource,
    /const cachedRanks = forceRefresh \? null : await readCachedMonthlyRanks/,
    "forceRefresh must skip monthly rank cache reads during processing"
  );
  assert.match(
    pageSource,
    /while \(true\) \{\s*await sleep\(AUTO_COLLECTION_POLL_MS\);\s*const heartbeatResponse = await sendTrendRunHeartbeat\(apiBaseUrl, runId\);/s,
    "auto collection must keep the browser heartbeat alive while waiting for each category run"
  );
});

test("single-analysis-collects-best-products-after-run-settles", () => {
  const pageSource = fs.readFileSync("web/app/sourcing/admin/page.tsx", "utf8");

  assert.match(
    pageSource,
    /const settings = createTrendCollectionSettingsSnapshot\(\{\s*devices: form\.devices,/s,
    "single analysis should freeze the same normalized settings used for product collection"
  );
  assert.match(
    pageSource,
    /const response = await startTrendCollectionRequest\(apiBaseUrl, payload\);/,
    "single analysis should force a fresh trend collection instead of reusing saved runs"
  );
  assert.match(
    pageSource,
    /void collectBestProductsAfterSingleAnalysis\(response\.run, selectedCategory, settings\);/,
    "single analysis should continue into best-product collection"
  );
  assert.match(
    pageSource,
    /await waitForTrendRunToSettle\(apiBaseUrl, startedRun\.id\)/,
    "single analysis should wait for trend snapshots before collecting products"
  );
  assert.match(
    pageSource,
    /await collectBestProductsForCategory\(apiBaseUrl, category, settings, settledRun\.id\)/,
    "single analysis should collect products with the completed run id"
  );
  assert.match(
    pageSource,
    /function isTrendRunDetail\(run: TrendRunSettleResult\): run is TrendRunDetail/,
    "single analysis should not treat failed settle results as full run details"
  );
});

test("auto-collection-collects-best-products-after-each-settled-category", () => {
  const pageSource = fs.readFileSync("web/app/sourcing/admin/page.tsx", "utf8");
  const apiSource = fs.readFileSync("edge-api/src/index.ts", "utf8");
  const schemaSource = fs.readFileSync("edge-api/schema.sql", "utf8");

  assert.match(
    pageSource,
    /retryApiOperation\(\s*\(\) => collectBestProductsForCategory\(apiBaseUrl,\s*_result\.category,\s*settings,\s*_result\.run\?\.id\)/s,
    "auto collection should retry best-product collection after each category run settles"
  );
  assert.match(
    pageSource,
    /maxAttemptsPerCategory:\s*AUTO_COLLECTION_API_RETRY_ATTEMPTS/,
    "auto collection should retry the same category instead of rebuilding the queue after transient API failures"
  );
  assert.match(
    pageSource,
    /retryDelayMs:\s*AUTO_COLLECTION_API_RETRY_DELAY_MS/,
    "auto collection retries should wait between API reconnect attempts"
  );
  assert.match(
    pageSource,
    /shouldRetryCollectFailure:\s*\(failure\) => isRetryableApiResponse\(failure\)/,
    "auto collection should only retry transient API failures"
  );
  assert.match(
    pageSource,
    /waitForTrendRunToSettle\(apiBaseUrl,\s*run\.id,\s*\(\{ attempt,\s*maxAttempts,\s*message \}\)/s,
    "auto collection should keep the current run id while the local API restarts"
  );
  assert.match(
    pageSource,
    /API 재연결 대기 중/,
    "auto collection should show reconnect waiting status instead of looking stopped"
  );
  assert.doesNotMatch(
    pageSource,
    /query:\s*category\.name/,
    "best product collection must not use the bare category name as the product query"
  );
  assert.match(
    pageSource,
    /runId,\s*[\r\n]+\s*limit:/,
    "best product collection should pass the completed trend run id"
  );
  assert.match(
    pageSource,
    /customExcludedTerms:\s*settings\.customExcludedTerms/,
    "brand exclusion settings should be passed into best product collection"
  );
  assert.match(
    pageSource,
    /limit:\s*Math\.min\(20,\s*Math\.max\(10,\s*settings\.resultCount\)\)/,
    "best product collection should collect a wider candidate set instead of a fixed Top 2"
  );
  assert.doesNotMatch(pageSource, /베스트상품 Top 2/, "auto start copy must not promise a fixed Top 2");
  assert.match(apiSource, /rankBestProductItems/, "best product export should recalculate accumulated global ranking");
  assert.match(apiSource, /bestScore/, "best product export should expose a ranking score");
  assert.match(apiSource, /readBestProductTrendAnalysisCandidates/, "best product collection must reuse trend-analysis candidates");
  assert.match(apiSource, /trend_snapshots/, "best product collection must be grounded in stored trend ranks");
  assert.match(apiSource, /keywordScore/, "best product export should expose trend keyword score");
  assert.match(apiSource, /\/v1\/products\/best\/collect/, "API must expose a best-product collection endpoint");
  assert.match(apiSource, /naver-shopping-insight:trend-analysis/, "collection rows must identify the trend-analysis source");
  assert.doesNotMatch(apiSource, /searchNaverShoppingItems/, "automatic accumulation must not use Naver Shopping Search");
  assert.doesNotMatch(apiSource, /search\/shop\.json/, "automatic accumulation must not call the Shopping Search API");
  assert.doesNotMatch(apiSource, /NAVER_SHOPPING_CREDENTIALS_MISSING/, "trend-analysis accumulation must not fail because Shopping API keys are missing");
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS best_product_items/, "best product rows must be persisted for export");
});

test("best-product-status-is-visible-before-auto-start", () => {
  const pageSource = fs.readFileSync("web/app/sourcing/admin/page.tsx", "utf8");
  const apiSource = fs.readFileSync("edge-api/src/index.ts", "utf8");

  assert.match(apiSource, /\/v1\/products\/best\/status/, "API must expose best-product readiness status");
  assert.match(apiSource, /credentialStatus:\s*"trend-analysis-ready"/, "status endpoint must not depend on Shopping Search credentials");
  assert.match(pageSource, /refreshBestProductStatus\(apiBaseUrl,\s*setBestProductStatus\)/, "admin UI should load best-product readiness");
  assert.match(pageSource, /트렌드 분석 누적 준비됨/, "auto panel should show trend-analysis accumulation readiness");
  assert.doesNotMatch(pageSource, /상품수집 키 필요/, "auto panel must not tell the user Shopping Search keys are required");
});
