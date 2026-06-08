import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const projectRoot = process.cwd();
const evidenceDir = path.join(projectRoot, ".omo", "ulw-loop", "evidence");
const staticRoot = path.join(projectRoot, "web", ".next-prod");
const staticPort = 32130;
const apiPort = 32131;
const apiBase = `http://127.0.0.1:${apiPort}/v1`;
const staticUrl = `http://127.0.0.1:${staticPort}/sourcing/admin.html?qa=playwright-close`;

const state = {
  collectRequests: [],
  runRequests: [],
  cancelRequests: [],
  heartbeatRequests: [],
  runs: new Map()
};
const staleHeartbeatMs = 3000;
const watchdogTimers = new Set();

const categories = new Map([
  ["0", [{ cid: 50000000, name: "패션의류", fullPath: "패션의류", depth: 1, parentCid: null, hasChildren: true }]],
  [
    "50000000",
    [
      { cid: 50000167, name: "여성의류", fullPath: "패션의류 > 여성의류", depth: 2, parentCid: 50000000, hasChildren: true },
      { cid: 50000169, name: "남성의류", fullPath: "패션의류 > 남성의류", depth: 2, parentCid: 50000000, hasChildren: false }
    ]
  ],
  [
    "50000167",
    [
      { cid: 50021279, name: "니트", fullPath: "패션의류 > 여성의류 > 니트", depth: 3, parentCid: 50000167, hasChildren: false },
      { cid: 50000805, name: "원피스", fullPath: "패션의류 > 여성의류 > 원피스", depth: 3, parentCid: 50000167, hasChildren: false }
    ]
  ]
]);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
  });
}

function makeRun(body, status = "running") {
  const id = `run-${state.collectRequests.length}-${body.categoryCid}`;
  const now = new Date().toISOString();

  return {
    id,
    profileId: `profile-${body.categoryCid}`,
    status,
    requestedBy: "qa",
    runType: "backfill",
    startPeriod: "2021-01",
    endPeriod: "2021-03",
    totalTasks: 3,
    completedTasks: status === "completed" ? 3 : 0,
    failedTasks: 0,
    totalSnapshots: 0,
    createdAt: now,
    updatedAt: now,
    profile: {
      id: `profile-${body.categoryCid}`,
      slug: `profile-${body.categoryCid}`,
      status: "active",
      startPeriod: "2021-01",
      endPeriod: "2021-03",
      syncStatus: "idle",
      createdAt: now,
      updatedAt: now,
      ...body
    },
    tasks: [],
    snapshotsPreview: [],
    canCancel: status === "running" || status === "queued",
    canDelete: true,
    processingMode: status === "running" ? "naver" : "idle",
    analysisReady: false,
    analysisCards: [],
    latestCompletedPeriod: null,
    currentPage: 1,
    cacheCompletedTasks: 0,
    naverCompletedTasks: 0,
    browserHeartbeatAt: null
  };
}

function cancelRun(runId) {
  state.cancelRequests.push(runId);
  const run = state.runs.get(runId);

  if (run) {
    run.status = "cancelled";
    run.canCancel = false;
    run.updatedAt = new Date().toISOString();
  }
}

function cancelStaleHeartbeatRun(runId) {
  const run = state.runs.get(runId);

  if (!run || run.status !== "queued" && run.status !== "running" || !run.browserHeartbeatAt) {
    return;
  }

  if (Date.now() - run.browserHeartbeatAt > staleHeartbeatMs) {
    cancelRun(runId);
  }
}

function scheduleHeartbeatWatchdog(runId) {
  const timer = setTimeout(() => {
    watchdogTimers.delete(timer);
    cancelStaleHeartbeatRun(runId);
  }, staleHeartbeatMs + 100);

  watchdogTimers.add(timer);
}

const apiServer = http.createServer(async (req, res) => {
  cors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (url.pathname === "/v1/trends/admin/board" && req.method === "GET") {
    json(res, 200, { ok: true, board: { generatedAt: new Date().toISOString(), metrics: [], profiles: [], runs: Array.from(state.runs.values()) } });
    return;
  }

  const categoryMatch = url.pathname.match(/^\/v1\/trends\/categories\/(.+)$/);
  if (categoryMatch && req.method === "GET") {
    json(res, 200, { ok: true, nodes: categories.get(categoryMatch[1]) ?? [] });
    return;
  }

  if (url.pathname === "/v1/trends/collect" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}");
    state.collectRequests.push(body);
    const run = makeRun(body);
    state.runs.set(run.id, run);
    json(res, 200, { ok: true, run });
    return;
  }

  const cancelMatch = url.pathname.match(/^\/v1\/trends\/runs\/([^/]+)\/cancel$/);
  if (cancelMatch && req.method === "POST") {
    const runId = cancelMatch[1];
    cancelRun(runId);
    json(res, 200, { ok: true, run: state.runs.get(runId) });
    return;
  }

  const heartbeatMatch = url.pathname.match(/^\/v1\/trends\/runs\/([^/]+)\/heartbeat$/);
  if (heartbeatMatch && req.method === "POST") {
    const runId = heartbeatMatch[1];
    const run = state.runs.get(runId);
    state.heartbeatRequests.push(runId);

    if (run && (run.status === "queued" || run.status === "running")) {
      run.browserHeartbeatAt = Date.now();
      run.updatedAt = new Date().toISOString();
      scheduleHeartbeatWatchdog(runId);
    }

    json(res, 200, { ok: true, run });
    return;
  }

  const runMatch = url.pathname.match(/^\/v1\/trends\/runs\/([^/]+)$/);
  if (runMatch && req.method === "GET") {
    state.runRequests.push(runMatch[1]);
    json(res, 200, { ok: true, run: state.runs.get(runMatch[1]) });
    return;
  }

  json(res, 404, { ok: false, message: "not found" });
});

const storageShim = `<script>(function(){var store={"hanirum:naver-trend-api-base-url":"${apiBase}"};Object.defineProperty(window,"localStorage",{configurable:true,value:{getItem:function(k){return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null},setItem:function(k,v){store[k]=String(v)},removeItem:function(k){delete store[k]},clear:function(){Object.keys(store).forEach(function(k){delete store[k]})}}});})();</script>`;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const staticServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/") {
    pathname = "/index.html";
  }

  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  let filePath = path.normalize(path.join(staticRoot, pathname));

  if (!filePath.startsWith(staticRoot)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    let data;

    try {
      data = await fs.readFile(filePath);
    } catch {
      filePath = path.join(staticRoot, `${pathname}.html`);
      data = await fs.readFile(filePath);
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mime[ext] ?? "application/octet-stream", "Cache-Control": "no-store" });

    if (ext === ".html") {
      res.end(data.toString("utf8").replace("</head>", `${storageShim}</head>`));
    } else {
      res.end(data);
    }
  } catch (error) {
    res.writeHead(404);
    res.end(String(error));
  }
});

function listen(server, port) {
  return new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

let browser;

try {
  await fs.mkdir(evidenceDir, { recursive: true });
  await listen(apiServer, apiPort);
  await listen(staticServer, staticPort);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const browserRequests = [];
  page.on("request", (request) => {
    browserRequests.push({ method: request.method(), url: request.url() });
  });

  await page.goto(staticUrl, { waitUntil: "load" });
  await page.getByText("트렌드 분석 조건 입력").waitFor({ timeout: 10000 });
  await page.getByRole("combobox", { name: "1분류" }).selectOption({ label: "패션의류" });
  await page.waitForTimeout(250);
  await page.getByTestId("auto-collection-start").click();
  await page.getByText("50021279").waitFor({ timeout: 10000 });
  await page.waitForTimeout(1200);

  const beforeClose = {
    collectRequests: state.collectRequests,
    cancelRequests: [...state.cancelRequests],
    heartbeatRequests: [...state.heartbeatRequests],
    browserRequests
  };

  await page.close();
  await new Promise((resolve) => setTimeout(resolve, 4200));

  const afterClose = {
    collectRequests: state.collectRequests,
    cancelRequests: [...state.cancelRequests],
    heartbeatRequests: [...state.heartbeatRequests],
    browserRequests
  };
  const evidence = {
    allPass:
      beforeClose.cancelRequests.length === 0 &&
      beforeClose.heartbeatRequests.length >= 1 &&
      afterClose.cancelRequests.length >= 1 &&
      String(afterClose.cancelRequests[0]).includes("50021279"),
    checkedAt: new Date().toISOString(),
    scenario: "real-playwright-page-close-cancels-active-run",
    staticUrl,
    apiBase,
    beforeClose,
    afterClose
  };

  await fs.writeFile(path.join(evidenceDir, "auto-category-playwright-close-qa.json"), JSON.stringify(evidence, null, 2), "utf8");
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.allPass) {
    process.exitCode = 1;
  }
} catch (error) {
  const evidence = {
    allPass: false,
    error: String(error?.stack ?? error)
  };

  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(path.join(evidenceDir, "auto-category-playwright-close-qa.json"), JSON.stringify(evidence, null, 2), "utf8");
  console.error(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  for (const timer of watchdogTimers) {
    clearTimeout(timer);
  }

  if (browser) {
    await browser.close().catch(() => {});
  }

  await close(staticServer).catch(() => {});
  await close(apiServer).catch(() => {});
}
