import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const projectRoot = process.cwd();
const evidenceDir = path.join(projectRoot, ".omo", "ulw-loop", "evidence");
const staticRoot = path.join(projectRoot, "web", ".next-prod");
const staticPort = 32132;
const apiPort = 32133;
const apiBase = `http://127.0.0.1:${apiPort}/v1`;
const staticUrl = `http://127.0.0.1:${staticPort}/sourcing/admin.html?qa=pending-stop`;

const categories = new Map([
  ["0", [{ cid: 50000000, name: "패션의류", fullPath: "패션의류", depth: 1, parentCid: null, hasChildren: true }]],
  [
    "50000000",
    [
      { cid: 50000167, name: "여성의류", fullPath: "패션의류 > 여성의류", depth: 2, parentCid: 50000000, hasChildren: true },
      { cid: 50000169, name: "남성의류", fullPath: "패션의류 > 남성의류", depth: 2, parentCid: 50000000, hasChildren: false }
    ]
  ],
  ["50000167", [{ cid: 50021279, name: "니트", fullPath: "패션의류 > 여성의류 > 니트", depth: 3, parentCid: 50000167, hasChildren: false }]]
]);

const state = {
  collectRequests: [],
  cancelRequests: [],
  heartbeatRequests: [],
  pendingCollect: null,
  runs: new Map()
};

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
  const now = new Date().toISOString();
  const id = `run-${state.collectRequests.length}-${body.categoryCid}`;

  return {
    id,
    profileId: `profile-${body.categoryCid}`,
    status,
    requestedBy: "qa",
    runType: "backfill",
    startPeriod: "2021-01",
    endPeriod: "2021-03",
    totalTasks: 3,
    completedTasks: 0,
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
    canCancel: status === "running",
    canDelete: true,
    processingMode: status === "running" ? "naver" : "idle",
    analysisReady: false,
    analysisCards: [],
    latestCompletedPeriod: null,
    currentPage: 1,
    cacheCompletedTasks: 0,
    naverCompletedTasks: 0
  };
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

    await new Promise((resolve) => {
      state.pendingCollect = () => {
        json(res, 200, { ok: true, run });
        resolve();
      };
    });
    return;
  }

  const cancelMatch = url.pathname.match(/^\/v1\/trends\/runs\/([^/]+)\/cancel$/);
  if (cancelMatch && req.method === "POST") {
    const runId = cancelMatch[1];
    state.cancelRequests.push(runId);
    const run = state.runs.get(runId);

    if (run) {
      run.status = "cancelled";
      run.canCancel = false;
      run.updatedAt = new Date().toISOString();
    }

    json(res, 200, { ok: true, run });
    return;
  }

  const heartbeatMatch = url.pathname.match(/^\/v1\/trends\/runs\/([^/]+)\/heartbeat$/);
  if (heartbeatMatch && req.method === "POST") {
    state.heartbeatRequests.push(heartbeatMatch[1]);
    json(res, 200, { ok: true, run: state.runs.get(heartbeatMatch[1]) });
    return;
  }

  const runMatch = url.pathname.match(/^\/v1\/trends\/runs\/([^/]+)$/);
  if (runMatch && req.method === "GET") {
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
    res.end(ext === ".html" ? data.toString("utf8").replace("</head>", `${storageShim}</head>`) : data);
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

async function waitFor(condition, timeoutMs, message) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (condition()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(message);
}

let browser;

try {
  await fs.mkdir(evidenceDir, { recursive: true });
  await listen(apiServer, apiPort);
  await listen(staticServer, staticPort);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(staticUrl, { waitUntil: "load" });
  await page.getByText("트렌드 분석 조건 입력").waitFor({ timeout: 10000 });
  await page.getByRole("combobox", { name: "1분류" }).selectOption({ label: "패션의류" });
  await page.waitForTimeout(250);
  await page.getByTestId("auto-collection-start").click();
  await waitFor(() => state.collectRequests.length === 1 && state.pendingCollect, 10000, "collect request did not start");
  await page.getByTestId("auto-collection-stop").click();

  const beforeRelease = {
    collectRequests: [...state.collectRequests],
    cancelRequests: [...state.cancelRequests]
  };

  state.pendingCollect();
  await waitFor(() => state.cancelRequests.length === 1, 10000, "cancel did not fire after delayed collect resolved");
  await page.waitForTimeout(1200);

  const afterRelease = {
    collectRequests: [...state.collectRequests],
    cancelRequests: [...state.cancelRequests],
    heartbeatRequests: [...state.heartbeatRequests],
    autoPanel: await page.locator('[data-testid="auto-collection-panel"]').innerText()
  };
  const evidence = {
    allPass:
      beforeRelease.collectRequests.length === 1 &&
      beforeRelease.cancelRequests.length === 0 &&
      afterRelease.collectRequests.length === 1 &&
      afterRelease.cancelRequests.length === 1 &&
      String(afterRelease.cancelRequests[0]).includes("50021279"),
    checkedAt: new Date().toISOString(),
    scenario: "stop-clicked-while-collect-request-pending",
    staticUrl,
    apiBase,
    beforeRelease,
    afterRelease
  };

  await fs.writeFile(path.join(evidenceDir, "auto-category-playwright-pending-stop-qa.json"), JSON.stringify(evidence, null, 2), "utf8");
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
  await fs.writeFile(path.join(evidenceDir, "auto-category-playwright-pending-stop-qa.json"), JSON.stringify(evidence, null, 2), "utf8");
  console.error(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }

  await close(staticServer).catch(() => {});
  await close(apiServer).catch(() => {});
}
