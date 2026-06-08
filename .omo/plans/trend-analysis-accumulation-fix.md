# Trend Analysis Accumulation Fix

## TL;DR
> Summary:      Finish the automatic accumulation path so `/v1/products/best/collect` persists the same trend-analysis candidates shown in the ranking/analysis screen, without NAVER Shopping Search, product lookup, or Shopping API credentials.
> Deliverables:
> - Edge API source guards proving accumulation does not call or depend on NAVER Shopping Search.
> - Trend-analysis candidate persistence with analysis evidence columns preserved end to end.
> - Admin UI status/copy that says analysis accumulation, not product search.
> - Desktop Excel export headers/rows for analysis evidence, not product rows.
> - Local launcher and docs with NAVER Shopping credential setup removed.
> - Live HTTP QA evidence showing collection succeeds without NAVER Shopping credentials.
> Effort:       Medium
> Risk:         Medium - current exploration found a dirty, partially changed worktree, so executors must complete the migration without reverting unrelated edits.

## Scope
### Must have
- Automatic accumulation must use the same trend-analysis method/data path as the visible analysis cards. The reusable source is `buildTrendAnalysis(profile, snapshots)` in `edge-api/src/trend-analysis.ts:118`, and run details already expose cached/created analysis at `edge-api/src/index.ts:1853-1881` and `edge-api/src/index.ts:1903`.
- `/v1/products/best/collect` must return and persist trend-analysis-derived rows even when `NAVER_SHOPPING_CLIENT_ID`, `NAVER_SHOPPING_CLIENT_SECRET`, `NAVER_CLIENT_ID`, and `NAVER_CLIENT_SECRET` are absent.
- Stored/exported rows must preserve analysis evidence: card kind/title, rationale, latest score, delta, momentum, seasonal index, recommended months, caution months, trend period, trend keyword, trend rank, confidence/keyword score, appearance count.
- Product-specific fields (`link`, `image`, `lowPrice`, `mallName`, `brand`, `maker`, `productId`) may remain in the existing DB/export shape for compatibility, but trend-analysis rows must leave them blank/null and must not pretend a product lookup happened.
- The existing admin collection flow remains: single analysis calls `collectBestProductsForCategory` after the run settles at `web/app/sourcing/admin/page.tsx:640-663`, and auto traversal calls it after each completed category at `web/app/sourcing/admin/page.tsx:822-850`.
- Source/tests/docs must make the rejected path impossible to reintroduce accidentally: no `openapi.naver.com/v1/search/shop`, no `searchNaverShoppingItems`, no `NaverShoppingSearchItem`, no `NAVER_SHOPPING_CREDENTIALS_MISSING`, and no Shopping Search credential instructions for this feature.
- Respect the dirty worktree. Current `git status --short` showed modified/untracked app/test/docs files and deleted generated `.exe` artifacts; executors must not revert unrelated changes or commit generated artifact deletions unless the task explicitly owns them.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do not call NAVER Shopping Search API from automatic accumulation. Official NAVER docs identify `https://openapi.naver.com/v1/search/shop.json` as Shopping Search and require client id/secret headers: https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md
- Do not feed trend keywords into product search.
- Do not invent product scoring, price scoring, recency scoring, or fake product data. Existing current code still has an invented analysis score helper at `edge-api/src/index.ts:3045-3054`; remove or replace it with direct trend-analysis ordering/evidence.
- Do not tell the user to set NAVER Shopping/Search API keys for this accumulation feature. Current stale docs do that at `README.md:48-57` and `.env.example:9-13`.
- Do not edit generated outputs in `build*/`, `dist*/`, `desktop-artifacts/`, `__pycache__/`, or `.wrangler/` except evidence output under `.omo/evidence/`.
- Do not broaden the feature into general sourcing, supplier search, price comparison, or crawling.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD + Node `node:test`, Wrangler dry-run/live HTTP, Python `unittest`, and Next/shared typecheck.
- QA policy: every task has agent-executed scenarios.
- Evidence: `.omo/evidence/task-<N>-<slug>.<ext>`

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.

Wave 1 (no dependencies):
- Task 1: Source guards for trend-analysis-only accumulation
- Task 2: Edge API trend-analysis row contract and persistence
- Task 3: Desktop Excel export and launcher credential cleanup
- Task 4: Admin UI status/types/copy alignment
- Task 5: README/env/operator cleanup

Wave 2 (after Wave 1):
- Task 6: Live HTTP QA fixture for credential-free trend accumulation depends [1, 2]
- Task 7: Full regression and evidence receipt depends [1, 2, 3, 4, 5, 6]
- Task 8: Commit hygiene and generated artifact protection depends [7]

Critical path: Task 1 -> Task 2 -> Task 6 -> Task 7 -> Task 8

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1    | none       | 2, 4, 6, 7 | 3, 5              |
| 2    | 1          | 6, 7   | 3, 4, 5              |
| 3    | none       | 7      | 1, 2, 4, 5           |
| 4    | 1          | 7      | 2, 3, 5              |
| 5    | none       | 7      | 1, 2, 3, 4           |
| 6    | 1, 2       | 7      | none                 |
| 7    | 1, 2, 3, 4, 5, 6 | 8 | none          |
| 8    | 7          | F1-F4  | none                 |

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. Source guards for trend-analysis-only accumulation

  What to do: Add or update source-level tests that fail while any automatic accumulation code still references NAVER Shopping/Search API credentials, `shop.json`, Shopping Search item types/functions, or `NAVER_SHOPPING_CREDENTIALS_MISSING`. Keep the existing admin auto-collection assertions and add a dedicated edge source guard under `edge-api/tests/`. Remove unused Shopping credential fields from the Edge API `Env` only after the RED test is captured.
  Must NOT do: Do not implement new row mapping in this task. Do not remove `NAVER_BROWSER_USER_AGENT`; it is still used by Naver Shopping Insight/DataLab scraping, not Shopping Search API.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [2, 4, 6, 7] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `web/tests/admin-auto-collection.test.mjs:304-346` - existing static contract already asserts auto collection passes `runId` and rejects Shopping Search function/API strings.
  - Pattern:  `web/tests/admin-auto-collection.test.mjs:348-356` - existing status test expects credential-free trend-analysis readiness.
  - Pattern:  `edge-api/src/index.ts:35-44` - current Edge env still includes stale NAVER Shopping/Search credential fields.
  - Pattern:  `edge-api/src/index.ts:1940-1970` - current collection entrypoint already calls `readBestProductTrendAnalysisCandidates`.
  - External: `https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md` - official docs identify `openapi.naver.com/v1/search/shop.json` as Shopping Search and requiring client id/secret headers.
  - Test:     `package.json:6-11` - root scripts have build/lint/typecheck, no central test script.

  Acceptance criteria (agent-executable only):
  - [ ] RED captured after adding the new source guard: `node --test web/tests/admin-auto-collection.test.mjs edge-api/tests/trend-analysis-accumulation-source.test.mjs *> .omo/evidence/task-1-source-guard-red.txt` exits non-zero because stale NAVER Shopping credential references remain.
  - [ ] `node --test web/tests/admin-auto-collection.test.mjs edge-api/tests/trend-analysis-accumulation-source.test.mjs *> .omo/evidence/task-1-source-guard-green.txt` exits 0.
  - [ ] `rg -n "openapi\\.naver\\.com/v1/search/shop|searchNaverShoppingItems|NaverShoppingSearchItem|NAVER_SHOPPING_CREDENTIALS_MISSING|NAVER_SHOPPING_CLIENT" edge-api/src/index.ts web/app/sourcing/admin/page.tsx web/tests/admin-auto-collection.test.mjs edge-api/tests .env.example README.md` exits 1 and output is empty after implementation, except references inside this plan file are ignored by narrowing paths as shown.
  - [ ] `edge-api/src/index.ts` still contains the Shopping Insight/DataLab category/rank collection constants such as `NAVER_CATEGORY_PAGE_URL`, because this task must not break trend collection.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: source guard rejects Shopping Search dependencies
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              New-Item -ItemType Directory -Force .omo\evidence
              node --test web/tests/admin-auto-collection.test.mjs edge-api/tests/trend-analysis-accumulation-source.test.mjs *> .omo/evidence/task-1-source-guard-green.txt
              rg -n "openapi\.naver\.com/v1/search/shop|searchNaverShoppingItems|NaverShoppingSearchItem|NAVER_SHOPPING_CREDENTIALS_MISSING|NAVER_SHOPPING_CLIENT" edge-api/src/index.ts web/app/sourcing/admin/page.tsx web/tests/admin-auto-collection.test.mjs edge-api/tests .env.example README.md *> .omo/evidence/task-1-shopping-search-rg.txt
    Expected: node exits 0; rg exits 1 with an empty `.omo/evidence/task-1-shopping-search-rg.txt`.
    Evidence: .omo/evidence/task-1-source-guard-green.txt

  Scenario: trend collection constants preserved
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              rg -n "NAVER_CATEGORY_PAGE_URL|shoppingInsight/sCategory|collectMonthlyRanks" edge-api/src/index.ts *> .omo/evidence/task-1-shopping-insight-preserved.txt
    Expected: exit 0; output shows Shopping Insight/DataLab collection remains available.
    Evidence: .omo/evidence/task-1-shopping-insight-preserved.txt
  ```

  Commit: YES | Message: `test(edge-api): guard trend analysis accumulation source` | Files: [`web/tests/admin-auto-collection.test.mjs`, `edge-api/tests/trend-analysis-accumulation-source.test.mjs`, `edge-api/src/index.ts`]

- [ ] 2. Edge API trend-analysis row contract and persistence

  What to do: Complete `collectBestProductsForCategory` so rows are built only from `TrendAnalysisCard.items`. Reuse cached run analysis where available; otherwise call `buildTrendAnalysis` on the same mapped snapshots. Persist evidence columns already modeled in schema, read them back in `mapBestProductItem`, and make `bestScore`/ranking a compatibility projection of trend-analysis order/evidence only. Remove the current invented recency/rank/delta score helper at `edge-api/src/index.ts:3045-3054` or replace it with direct candidate ordering that does not create product-like scoring.
  Must NOT do: Do not call fetch, Shopping Search, product search, or product dedupe. Do not add price/link/image/mall data. Do not rank by `lowPrice`, product rank, recency, or fake product metadata.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6, 7] | Blocked by: [1]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `edge-api/src/index.ts:1845-1881` - run detail path already resolves cached or newly built analysis and exposes `analysisSummary`/`analysisCards`.
  - Pattern:  `edge-api/src/index.ts:1885-1911` - `readCachedRunAnalysis` contract for `analysis_summary_json` and `analysis_cards_json`.
  - Pattern:  `edge-api/src/index.ts:1914-1935` - `buildAndCacheRunAnalysis` calls `buildTrendAnalysis` and stores report JSON.
  - Pattern:  `edge-api/src/index.ts:2037-2110` - current candidate reader maps profile/snapshots and calls `buildTrendAnalysis`.
  - Pattern:  `edge-api/src/index.ts:2111-2128` - current flattening of `analysis.cards` into candidates.
  - Pattern:  `edge-api/src/index.ts:2148-2212` - current row replacement inserts analysis evidence columns.
  - Pattern:  `edge-api/src/index.ts:2289-2328` - current trend-analysis candidate mapper blanks product fields.
  - Pattern:  `edge-api/src/index.ts:2987-3023` - current export mapper reads analysis evidence fields.
  - API/Type: `shared/src/trends.ts:123-137` - `TrendAnalysisKeyword` evidence fields.
  - API/Type: `shared/src/trends.ts:139-144` - `TrendAnalysisCard` shape.
  - API/Type: `edge-api/schema.sql:99-126` - `best_product_items` table currently includes analysis evidence columns and product compatibility columns.

  Acceptance criteria (agent-executable only):
  - [ ] RED captured: `node --test edge-api/tests/trend-analysis-row-contract.test.mjs *> .omo/evidence/task-2-row-contract-red.txt` fails before row contract/source changes are complete.
  - [ ] `node --test edge-api/tests/trend-analysis-row-contract.test.mjs *> .omo/evidence/task-2-row-contract-green.txt` exits 0 and asserts mapped collected rows have `source === "naver-shopping-insight:trend-analysis"`, blank product fields, and preserved evidence columns.
  - [ ] `corepack pnpm exec wrangler deploy --dry-run --config edge-api/wrangler.jsonc --outdir .omo/evidence/task-2-worker-dry-run *> .omo/evidence/task-2-worker-dry-run.txt` exits 0.
  - [ ] `rg -n "lowPrice.*bestScore|priceSignal|recencyBonus|calculateTrendAnalysisBestScore|calculateBestProductScore" edge-api/src/index.ts *> .omo/evidence/task-2-no-invented-score.txt` exits 1 or only matches a deliberate test assertion that forbids those names.
  - [ ] `rg -n "analysis_card|analysis_latest_score|analysis_recommended_months_json" edge-api/schema.sql edge-api/src/index.ts *> .omo/evidence/task-2-analysis-columns.txt` exits 0 and shows schema, migration, insert, and readback coverage.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: edge row contract green
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              New-Item -ItemType Directory -Force .omo\evidence
              node --test edge-api/tests/trend-analysis-row-contract.test.mjs *> .omo/evidence/task-2-row-contract-green.txt
              corepack pnpm exec wrangler deploy --dry-run --config edge-api/wrangler.jsonc --outdir .omo/evidence/task-2-worker-dry-run *> .omo/evidence/task-2-worker-dry-run.txt
    Expected: both commands exit 0; test output confirms trend-analysis candidates are persisted without product fields.
    Evidence: .omo/evidence/task-2-row-contract-green.txt

  Scenario: no invented product or recency scoring
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              rg -n "priceSignal|recencyBonus|calculateTrendAnalysisBestScore|calculateBestProductScore|lowPrice.*bestScore" edge-api/src/index.ts *> .omo/evidence/task-2-no-invented-score.txt
    Expected: command exits 1 with no matches, or exits 0 only if all matches are in comments/tests that explicitly ban these strings.
    Evidence: .omo/evidence/task-2-no-invented-score.txt
  ```

  Commit: YES | Message: `fix(edge-api): persist trend analysis accumulation rows` | Files: [`edge-api/src/index.ts`, `edge-api/schema.sql`, `edge-api/tests/trend-analysis-row-contract.test.mjs`]

- [ ] 3. Desktop Excel export and launcher credential cleanup

  What to do: Change `local_app_launcher.py` export headers and row mapping from product-search columns to trend-analysis evidence columns. Remove the NAVER Shopping credential env-file path from the local launcher because the Worker should not need those credentials for accumulation. Update Python tests first, then implementation.
  Must NOT do: Do not remove the local API process management, health checks, pump loop, or workbook atomic replace behavior. Do not write to the real Desktop during tests.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [7] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `local_app_launcher.py:43-66` - current workbook headers are still product-shaped (`베스트점수`, `검색어`, `상품검색순위`, `상품명`, price/mall/product id).
  - Pattern:  `local_app_launcher.py:118-144` - current launcher reads NAVER Shopping/Search credential aliases and writes a temp env file.
  - Pattern:  `local_app_launcher.py:325-401` - workbook writer appends rows and atomically replaces the file.
  - Test:     `tests/test_best_products_excel_export.py:59-77` - current test already expects first headers to include `분석점수`, `분석카드`, `분석순위`.
  - Test:     `tests/test_best_products_excel_export.py:79-129` - failure rows must remain visible with trend-analysis failure reason.
  - Test:     `tests/test_best_products_excel_export.py:132-165` - fixture already includes analysis evidence fields.
  - Test:     `tests/test_local_app_launcher.py:24-70` - current launcher tests still expect NAVER credential env-file behavior and must be rewritten.

  Acceptance criteria (agent-executable only):
  - [ ] RED captured: `python -m unittest tests.test_best_products_excel_export tests.test_local_app_launcher *> .omo/evidence/task-3-python-red.txt` fails before implementation because workbook headers/launcher env behavior are stale.
  - [ ] `python -m unittest tests.test_best_products_excel_export tests.test_local_app_launcher *> .omo/evidence/task-3-python-green.txt` exits 0.
  - [ ] Workbook headers include `분석점수`, `분석카드`, `분석순위`, `분석근거`, `최근점수`, `변화량`, `모멘텀`, `계절성`, `추천월`, `주의월`.
  - [ ] Workbook headers no longer include `상품검색순위`, `상품명`, `가격`, `쇼핑몰`, `상품ID` for trend-analysis rows.
  - [ ] `rg -n "NAVER_SHOPPING|NAVER_CLIENT_ID|NAVER_CLIENT_SECRET" local_app_launcher.py tests/test_local_app_launcher.py *> .omo/evidence/task-3-launcher-no-shopping-env.txt` exits 1 with empty output.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: Excel export writes analysis evidence
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              New-Item -ItemType Directory -Force .omo\evidence
              python -m unittest tests.test_best_products_excel_export *> .omo/evidence/task-3-excel-green.txt
    Expected: exit 0; test verifies analysis headers, category rows, title/keyword mapping, and failure row visibility.
    Evidence: .omo/evidence/task-3-excel-green.txt

  Scenario: launcher no longer forwards Shopping credentials
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              python -m unittest tests.test_local_app_launcher *> .omo/evidence/task-3-launcher-green.txt
              rg -n "NAVER_SHOPPING|NAVER_CLIENT_ID|NAVER_CLIENT_SECRET" local_app_launcher.py tests/test_local_app_launcher.py *> .omo/evidence/task-3-launcher-no-shopping-env.txt
    Expected: unittest exits 0; rg exits 1 with empty output.
    Evidence: .omo/evidence/task-3-launcher-green.txt
  ```

  Commit: YES | Message: `fix(desktop): export trend analysis evidence rows` | Files: [`local_app_launcher.py`, `tests/test_best_products_excel_export.py`, `tests/test_local_app_launcher.py`]

- [ ] 4. Admin UI status/types/copy alignment

  What to do: Update admin response/state types and visible copy so the UI treats readiness as trend-analysis accumulation, not Shopping credentials or product collection. Fix the type mismatch where the API returns `credentialStatus: "trend-analysis-ready"` but the UI types still only allow `"configured" | "missing"` at `web/app/sourcing/admin/page.tsx:105-115` and `web/app/sourcing/admin/page.tsx:158-163`.
  Must NOT do: Do not redesign the page. Do not change auto queue behavior except status/copy/type correctness.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [7] | Blocked by: [1]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `web/app/sourcing/admin/page.tsx:95-115` - response types for collect/status.
  - Pattern:  `web/app/sourcing/admin/page.tsx:158-163` - UI status state type.
  - Pattern:  `web/app/sourcing/admin/page.tsx:633-636` - single analysis start copy and follow-up call.
  - Pattern:  `web/app/sourcing/admin/page.tsx:663-670` - single analysis completion copy.
  - Pattern:  `web/app/sourcing/admin/page.tsx:746` - auto traversal start copy.
  - Pattern:  `web/app/sourcing/admin/page.tsx:839-848` - auto traversal per-category copy.
  - Pattern:  `web/app/sourcing/admin/page.tsx:2783-2801` - readiness status fetch and message.
  - Test:     `web/tests/admin-auto-collection.test.mjs:348-356` - static status/copy assertions.

  Acceptance criteria (agent-executable only):
  - [ ] RED captured: `corepack pnpm --filter @runacademy/web typecheck *> .omo/evidence/task-4-web-typecheck-red.txt` fails before type fixes if `credentialStatus: "trend-analysis-ready"` is not accepted.
  - [ ] `node --test web/tests/admin-auto-collection.test.mjs *> .omo/evidence/task-4-admin-test-green.txt` exits 0.
  - [ ] `corepack pnpm --filter @runacademy/web typecheck *> .omo/evidence/task-4-web-typecheck-green.txt` exits 0.
  - [ ] `rg -n "쇼핑 키|상품수집 키|네이버 쇼핑 키|상품 후보|상품 수집" web/app/sourcing/admin/page.tsx web/tests/admin-auto-collection.test.mjs *> .omo/evidence/task-4-no-shopping-ui-copy.txt` exits 1 with empty output, except strings in tests that explicitly forbid those phrases.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: admin static behavior and typecheck
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              New-Item -ItemType Directory -Force .omo\evidence
              node --test web/tests/admin-auto-collection.test.mjs *> .omo/evidence/task-4-admin-test-green.txt
              corepack pnpm --filter @runacademy/web typecheck *> .omo/evidence/task-4-web-typecheck-green.txt
    Expected: both commands exit 0.
    Evidence: .omo/evidence/task-4-admin-test-green.txt

  Scenario: UI copy has no Shopping-key requirement
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              rg -n "쇼핑 키|상품수집 키|네이버 쇼핑 키|Shopping Search keys" web/app/sourcing/admin/page.tsx web/tests/admin-auto-collection.test.mjs *> .omo/evidence/task-4-no-shopping-ui-copy.txt
    Expected: rg exits 1 with empty output.
    Evidence: .omo/evidence/task-4-no-shopping-ui-copy.txt
  ```

  Commit: YES | Message: `fix(web): show trend analysis accumulation readiness` | Files: [`web/app/sourcing/admin/page.tsx`, `web/tests/admin-auto-collection.test.mjs`]

- [ ] 5. README/env/operator cleanup

  What to do: Remove stale operator instructions that tell users to configure NAVER Shopping/Search API credentials for best-product accumulation. Replace them with a short explanation that automatic accumulation stores completed trend-analysis candidates and requires only successful Shopping Insight trend collection. Update `.env.example` accordingly.
  Must NOT do: Do not remove unrelated Cloudflare/D1 setup instructions. Do not edit generated packaging outputs.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [7] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `README.md:48-57` - stale Shopping Search credential section.
  - Pattern:  `.env.example:9-13` - stale `NAVER_SHOPPING_CLIENT_ID` and `NAVER_SHOPPING_CLIENT_SECRET`.
  - Pattern:  `NAVER_TREND_MAKER_CONTEXT.md` - project context may need a short note that accumulation is trend-analysis based if it currently documents product search behavior.
  - External: `https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md` - official Shopping Search docs, used only as a guardrail for what this feature must not depend on.

  Acceptance criteria (agent-executable only):
  - [ ] RED captured: `rg -n "NAVER_SHOPPING|NAVER_CLIENT_ID|NAVER_CLIENT_SECRET|NAVER_SHOPPING_CREDENTIALS_MISSING|쇼핑 검색 API|Search API 키" README.md .env.example NAVER_TREND_MAKER_CONTEXT.md *> .omo/evidence/task-5-docs-red.txt` exits 0 before docs cleanup.
  - [ ] `rg -n "NAVER_SHOPPING|NAVER_CLIENT_ID|NAVER_CLIENT_SECRET|NAVER_SHOPPING_CREDENTIALS_MISSING|쇼핑 검색 API|Search API 키" README.md .env.example NAVER_TREND_MAKER_CONTEXT.md *> .omo/evidence/task-5-docs-green.txt` exits 1 with empty output after cleanup.
  - [ ] `rg -n "트렌드 분석 후보|분석 후보 누적|Shopping Insight|쇼핑인사이트" README.md NAVER_TREND_MAKER_CONTEXT.md *> .omo/evidence/task-5-docs-positive.txt` exits 0 and shows the replacement explanation.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: docs no longer ask for Shopping Search keys
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              New-Item -ItemType Directory -Force .omo\evidence
              rg -n "NAVER_SHOPPING|NAVER_CLIENT_ID|NAVER_CLIENT_SECRET|NAVER_SHOPPING_CREDENTIALS_MISSING|쇼핑 검색 API|Search API 키" README.md .env.example NAVER_TREND_MAKER_CONTEXT.md *> .omo/evidence/task-5-docs-green.txt
    Expected: rg exits 1 with empty output.
    Evidence: .omo/evidence/task-5-docs-green.txt

  Scenario: docs state the new accumulation source
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              rg -n "트렌드 분석 후보|분석 후보 누적|쇼핑인사이트" README.md NAVER_TREND_MAKER_CONTEXT.md *> .omo/evidence/task-5-docs-positive.txt
    Expected: exit 0; output includes a plain Korean explanation that accumulation uses completed trend-analysis candidates.
    Evidence: .omo/evidence/task-5-docs-positive.txt
  ```

  Commit: YES | Message: `docs: document trend analysis accumulation source` | Files: [`README.md`, `.env.example`, `NAVER_TREND_MAKER_CONTEXT.md`]

- [ ] 6. Live HTTP QA fixture for credential-free trend accumulation

  What to do: Add a deterministic local D1 seed fixture and a live HTTP QA command path that starts the Worker locally, posts to `/v1/products/best/collect`, and verifies returned rows are trend-analysis-derived with no NAVER Shopping credentials and no product fields. The fixture should insert one profile, one completed run with enough `trend_snapshots`, and either cached analysis JSON or snapshots sufficient for `buildTrendAnalysis`.
  Must NOT do: Do not hit live NAVER endpoints. Do not use real user credentials. Do not depend on browser/UI automation for this API proof.

  Parallelization: Can parallel: NO | Wave 2 | Blocks: [7] | Blocked by: [1, 2]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `edge-api/wrangler.jsonc:1-18` - Worker config and D1 binding name.
  - Pattern:  `edge-api/schema.sql:71-128` - trend snapshot and accumulation table schema.
  - Pattern:  `edge-api/src/index.ts:254-268` - status and collect route registration.
  - Pattern:  `edge-api/src/index.ts:1940-1970` - collect endpoint behavior.
  - Pattern:  `edge-api/src/index.ts:2037-2128` - candidate reader needs profile/run/snapshot seed rows.
  - Test:     `edge-api/tests/trend-analysis-accumulation-source.test.mjs` - source guard from Task 1.

  Acceptance criteria (agent-executable only):
  - [ ] A fixture exists at `edge-api/tests/fixtures/trend-analysis-accumulation-seed.sql` with deterministic category/run/profile/snapshot rows.
  - [ ] Live local D1 is initialized with `edge-api/schema.sql` and the seed fixture under `.omo/evidence/task-6-d1`.
  - [ ] With `$env:NAVER_SHOPPING_CLIENT_ID=""`, `$env:NAVER_SHOPPING_CLIENT_SECRET=""`, `$env:NAVER_CLIENT_ID=""`, and `$env:NAVER_CLIENT_SECRET=""`, POST `/v1/products/best/collect` returns `ok: true`, `collectionStatus: "collected"`, and at least one item.
  - [ ] Response verifier asserts every item has `source === "naver-shopping-insight:trend-analysis"`, non-empty `analysisCard`, non-empty `analysisRationale`, non-empty `trendKeyword`, blank `link`, blank `mallName`, blank `productId`, and no failure reason.
  - [ ] Response verifier asserts the response text does not contain `NAVER_SHOPPING`, `shop.json`, `X-Naver-Client`, or `NAVER_SHOPPING_CREDENTIALS_MISSING`.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: live HTTP collect succeeds without Shopping credentials
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              New-Item -ItemType Directory -Force .omo\evidence
              Remove-Item -Recurse -Force .omo\evidence\task-6-d1 -ErrorAction SilentlyContinue
              $env:NAVER_SHOPPING_CLIENT_ID=""; $env:NAVER_SHOPPING_CLIENT_SECRET=""; $env:NAVER_CLIENT_ID=""; $env:NAVER_CLIENT_SECRET=""
              corepack pnpm exec wrangler d1 execute naver-trend-maker-db --local --persist-to .omo\evidence\task-6-d1 --file edge-api\schema.sql *> .omo\evidence\task-6-schema.txt
              corepack pnpm exec wrangler d1 execute naver-trend-maker-db --local --persist-to .omo\evidence\task-6-d1 --file edge-api\tests\fixtures\trend-analysis-accumulation-seed.sql *> .omo\evidence\task-6-seed.txt
              $worker = Start-Process -FilePath "corepack" -ArgumentList @("pnpm","exec","wrangler","dev","--config","edge-api/wrangler.jsonc","--local","--persist-to",".omo/evidence/task-6-d1","--port","8787") -PassThru -WindowStyle Hidden -RedirectStandardOutput ".omo\evidence\task-6-wrangler-out.txt" -RedirectStandardError ".omo\evidence\task-6-wrangler-err.txt"
              Start-Sleep -Seconds 8
              curl.exe -sS -X POST "http://127.0.0.1:8787/v1/products/best/collect" -H "Content-Type: application/json" --data "{\"categoryCid\":50000167,\"categoryPath\":\"패션의류 > 여성의류 > 니트\",\"categoryName\":\"니트\",\"runId\":\"qa-trend-analysis-run\",\"limit\":10,\"excludeBrandProducts\":false,\"customExcludedTerms\":[]}" > .omo\evidence\task-6-live-http.json
              node -e "const fs=require('fs'); const text=fs.readFileSync('.omo/evidence/task-6-live-http.json','utf8'); const p=JSON.parse(text); if(!p.ok||p.collectionStatus!=='collected'||!Array.isArray(p.items)||!p.items.length) throw new Error('collect failed'); for (const item of p.items) { if(item.source!=='naver-shopping-insight:trend-analysis') throw new Error('wrong source'); if(!item.analysisCard||!item.analysisRationale||!item.trendKeyword) throw new Error('missing analysis evidence'); if(item.link||item.mallName||item.productId) throw new Error('product field should be blank'); } if(/NAVER_SHOPPING|shop\.json|X-Naver-Client|NAVER_SHOPPING_CREDENTIALS_MISSING/.test(text)) throw new Error('shopping dependency leaked');" *> .omo\evidence\task-6-verify.txt
              Stop-Process -Id $worker.Id -Force
    Expected: schema, seed, curl, and verifier commands exit 0; `.omo/evidence/task-6-live-http.json` contains collected trend-analysis rows without Shopping credentials.
    Evidence: .omo/evidence/task-6-live-http.json

  Scenario: live HTTP export returns same analysis evidence
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, reuse the running worker from the previous scenario before `Stop-Process`, then run:
              curl.exe -sS "http://127.0.0.1:8787/v1/products/best/export" > .omo\evidence\task-6-live-export.json
              node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('.omo/evidence/task-6-live-export.json','utf8')); if(!p.ok||!Array.isArray(p.items)||!p.items.length) throw new Error('export empty'); if(!p.items.every(i=>i.source==='naver-shopping-insight:trend-analysis' && i.analysisCard && i.trendKeyword)) throw new Error('export missing analysis fields');" *> .omo\evidence\task-6-export-verify.txt
    Expected: export verifier exits 0.
    Evidence: .omo/evidence/task-6-live-export.json
  ```

  Commit: YES | Message: `test(edge-api): verify credential-free trend accumulation` | Files: [`edge-api/tests/fixtures/trend-analysis-accumulation-seed.sql`, `edge-api/tests/trend-analysis-row-contract.test.mjs`]

- [ ] 7. Full regression and evidence receipt

  What to do: Run all project-level checks relevant to this change, capture evidence, and add a concise cleanup receipt under `.omo/evidence/` summarizing RED/GREEN results. Fix any regressions in owned files only.
  Must NOT do: Do not mark complete if any previous task lacks evidence. Do not delete or revert unrelated dirty files.

  Parallelization: Can parallel: NO | Wave 2 | Blocks: [8] | Blocked by: [1, 2, 3, 4, 5, 6]

  References (executor has NO interview context - be exhaustive):
  - Test:     `package.json:6-11` - root build/lint/typecheck commands.
  - Test:     `shared/package.json:7-11` - shared build/typecheck commands.
  - Test:     `web/package.json:6-10` - web build/typecheck commands.
  - Test:     `web/tests/admin-auto-collection.test.mjs:1` - Node static/admin tests.
  - Test:     `tests/test_best_products_excel_export.py:1` - Python Excel tests.
  - Test:     `tests/test_local_app_launcher.py:1` - Python launcher tests.

  Acceptance criteria (agent-executable only):
  - [ ] `node --test shared/tests/trend-brand-settings.test.mjs web/tests/admin-auto-collection.test.mjs edge-api/tests/trend-analysis-accumulation-source.test.mjs edge-api/tests/trend-analysis-row-contract.test.mjs *> .omo/evidence/task-7-node-tests.txt` exits 0.
  - [ ] `python -m unittest discover -s tests -p "test_*.py" *> .omo/evidence/task-7-python-tests.txt` exits 0.
  - [ ] `corepack pnpm -r typecheck *> .omo/evidence/task-7-typecheck.txt` exits 0.
  - [ ] `corepack pnpm exec wrangler deploy --dry-run --config edge-api/wrangler.jsonc --outdir .omo/evidence/task-7-worker-dry-run *> .omo/evidence/task-7-worker-dry-run.txt` exits 0.
  - [ ] `.omo/evidence/task-7-cleanup-receipt.md` exists and lists task evidence files, remaining dirty generated artifacts not owned by this plan, and any residual risk.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: full automated regression
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              New-Item -ItemType Directory -Force .omo\evidence
              node --test shared/tests/trend-brand-settings.test.mjs web/tests/admin-auto-collection.test.mjs edge-api/tests/trend-analysis-accumulation-source.test.mjs edge-api/tests/trend-analysis-row-contract.test.mjs *> .omo\evidence\task-7-node-tests.txt
              python -m unittest discover -s tests -p "test_*.py" *> .omo\evidence\task-7-python-tests.txt
              corepack pnpm -r typecheck *> .omo\evidence\task-7-typecheck.txt
              corepack pnpm exec wrangler deploy --dry-run --config edge-api/wrangler.jsonc --outdir .omo\evidence\task-7-worker-dry-run *> .omo\evidence\task-7-worker-dry-run.txt
    Expected: all commands exit 0.
    Evidence: .omo/evidence/task-7-node-tests.txt

  Scenario: cleanup receipt exists
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              Test-Path .omo\evidence\task-7-cleanup-receipt.md
              Get-Content .omo\evidence\task-7-cleanup-receipt.md
    Expected: first command prints `True`; receipt names task-1 through task-7 evidence and notes unrelated generated artifact deletes from `git status --short` if still present.
    Evidence: .omo/evidence/task-7-cleanup-receipt.md
  ```

  Commit: YES | Message: `test: verify trend analysis accumulation regression suite` | Files: [`.omo/evidence/task-7-cleanup-receipt.md`]

- [ ] 8. Commit hygiene and generated artifact protection

  What to do: Inspect the final diff, make sure commits include only owned source/test/docs/evidence files, and explicitly exclude unrelated generated `.exe` deletions or build output churn unless the user separately asked for packaging artifacts. Prepare a final implementation summary for the caller.
  Must NOT do: Do not run `git reset --hard` or checkout unrelated files without explicit user approval. Do not include stale `.exe` deletions in commits.

  Parallelization: Can parallel: NO | Wave 2 | Blocks: [F1-F4] | Blocked by: [7]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `git status --short` from exploration showed deleted generated files: `Naver Trend Maker 10.exe`, `desktop-artifacts/Naver Trend Maker 10 Cloudflare 연결.exe`, and `desktop-artifacts/Naver Trend Maker 10 로컬버전.exe`.
  - Pattern:  `.gitignore` - confirm generated evidence/build outputs are handled intentionally.
  - Pattern:  `.omo/plans/trend-analysis-accumulation-fix.md` - final commit footer must reference this plan.

  Acceptance criteria (agent-executable only):
  - [ ] `git status --short *> .omo/evidence/task-8-git-status.txt` captured.
  - [ ] `git diff --stat *> .omo/evidence/task-8-diff-stat.txt` captured.
  - [ ] `git diff -- edge-api/src/index.ts edge-api/schema.sql web/app/sourcing/admin/page.tsx local_app_launcher.py README.md .env.example NAVER_TREND_MAKER_CONTEXT.md web/tests tests edge-api/tests shared/tests *> .omo/evidence/task-8-owned-diff.patch` captured.
  - [ ] No commit includes generated `.exe`, `build/`, `dist/`, `desktop-artifacts/`, `__pycache__/`, or `.wrangler/` churn unless separately approved.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: final diff is scoped
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              git status --short *> .omo\evidence\task-8-git-status.txt
              git diff --stat *> .omo\evidence\task-8-diff-stat.txt
              git diff -- edge-api/src/index.ts edge-api/schema.sql web/app/sourcing/admin/page.tsx local_app_launcher.py README.md .env.example NAVER_TREND_MAKER_CONTEXT.md web/tests tests edge-api/tests shared/tests *> .omo\evidence\task-8-owned-diff.patch
    Expected: evidence files are created; diff scope is limited to owned implementation/test/docs/evidence files.
    Evidence: .omo/evidence/task-8-diff-stat.txt

  Scenario: generated artifacts not staged
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              git diff --cached --name-only *> .omo\evidence\task-8-staged-files.txt
              node -e "const fs=require('fs'); const s=fs.readFileSync('.omo/evidence/task-8-staged-files.txt','utf8'); if(/(^|\\n)(build|dist|desktop-artifacts|__pycache__|.*\\.exe)/.test(s)) throw new Error('generated artifact staged');"
    Expected: verifier exits 0.
    Evidence: .omo/evidence/task-8-staged-files.txt
  ```

  Commit: YES | Message: `chore: finalize trend analysis accumulation evidence` | Files: [`.omo/evidence/task-8-git-status.txt`, `.omo/evidence/task-8-diff-stat.txt`, `.omo/evidence/task-8-owned-diff.patch`]

## Final verification wave (MANDATORY - after all implementation tasks)
> Runs in PARALLEL. ALL must APPROVE. Surface results to the caller and wait for an explicit "okay" before declaring complete.
- [ ] F1. Plan compliance audit - every task done, every acceptance criterion met
- [ ] F2. Code quality review - diagnostics clean, idioms match, no dead code
- [ ] F3. Real manual QA - every QA scenario executed with evidence captured
- [ ] F4. Scope fidelity - nothing extra shipped beyond Must-Have, nothing Must-NOT-Have introduced

## Commit strategy
- One logical change per commit. Conventional Commits (`<type>(<scope>): <subject>` body + footer).
- Atomic: every commit builds and passes tests on its own.
- No "WIP" / "fix typo squash later" commits on the final branch - clean up before merge.
- Reference the plan file path in the final commit footer: `Plan: .omo/plans/trend-analysis-accumulation-fix.md`.

## Success criteria
- All Must-Have shipped; all QA scenarios pass with captured evidence; F1-F4 approved; commit history clean.
