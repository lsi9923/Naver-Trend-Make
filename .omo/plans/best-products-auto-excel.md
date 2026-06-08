# Best Product Accumulation And Desktop Excel Export

## TL;DR
> Summary:      Add best-product accumulation to the auto category loop, then have the local Python launcher write an always-updated Desktop CSV/XLSX export because the Worker cannot write local files. Use the official NAVER Shopping Search API only when credentials and an explicit storage-compliance flag are present; otherwise write clearly labelled keyword-snapshot fallback rows.
> Deliverables:
> - Shared best-product/export contracts and tests.
> - Worker routes for collecting/exporting accumulated best-product rows.
> - Admin auto-loop hook that collects Top 2 rows after each completed category.
> - Local Desktop `best-products-latest.csv` and `best-products-latest.xlsx` writer with atomic replace and lock handling.
> - Packaging/env/docs updates for local EXE use.
> Effort:       Large
> Risk:         High - NAVER product API credentials/terms and Windows Excel file locks can block real-product persistence.

## Scope
### Must have
- Accumulate Top 2 rows per processed auto-category, e.g. query/category `니트` gets 2 rows and `원피스` gets 2 rows after each category completes.
- Preserve the current fresh Naver trend collection behavior: auto collection start still sends `forceRefresh: true` from `web/app/sourcing/admin/page.tsx:2651-2658`, and Worker reuse remains bypassed through `edge-api/src/index.ts:512-612`, `edge-api/src/index.ts:1053-1110`, and `edge-api/src/index.ts:1515-1528`.
- Worker stores/export rows; local Python writes Desktop files. The local launcher already starts the local Worker at `local_app_launcher.py:116-159` and pumps `/trends/worker/process-next` every 6 seconds at `local_app_launcher.py:199-225`.
- Official NAVER Shopping Search API route: `https://openapi.naver.com/v1/search/shop.json?query=<query>&display=<n>&start=1&sort=sim`, with headers `X-Naver-Client-Id` and `X-Naver-Client-Secret`.
- If real-product persistence is not allowed/configured, write fallback rows with `source_mode=keyword_snapshot_fallback`, `is_real_product=false`, blank product URL/image fields, and an explicit status message. Do not label fallback rows as actual products.
- Desktop output path under `%USERPROFILE%\Desktop\Naver Trend Maker 10\best-products-latest.csv` and `.xlsx`; also write `best-products-status.json`.
- CSV must be Excel-friendly for Korean text (`utf-8-sig`). XLSX must use `openpyxl` when available.
- Every implementation task starts with a failing test or static check, captures RED evidence, then captures GREEN evidence after implementation.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do not scrape or bypass `https://search.shopping.naver.com/search/all`; direct Python access already returned HTTP 418 and is not a stable source.
- Do not misrepresent keyword fallback rows as Naver Shopping product rows.
- Do not make Cloudflare Worker write Desktop files; Worker has no local filesystem access in the deployed or local wrangler runtime.
- Do not change unrelated apps in `C:\Users\imda0\Desktop\커서 ai 폴더`.
- Do not edit `build/`, `dist/`, `__pycache__/`, `edge-api/.wrangler/`, or `desktop-artifacts/` except generated outputs produced during verification.
- Do not wipe accumulated product history automatically when auto collection starts; add explicit reset behavior only if the task below says so.
- Do not commit existing unrelated dirty worktree changes. Current exploration found pre-existing modifications in `edge-api/src/index.ts`, `local_app_launcher.py`, `shared/src/trends.ts`, `web/app/sourcing/admin/page.tsx`, tests, and artifacts.
- Do not persist official NAVER Shopping API result rows unless the user has set `NAVER_SHOPPING_RESULT_STORAGE_CONFIRMED=1` with credentials. Based on NAVER help/source research, API result extraction/storage has terms risk.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD + Node `node:test`, TypeScript build/typecheck, Worker dry-run/curl QA, Python `unittest`, and browser QA through real Chrome/Playwright.
- QA policy: every task has agent-executed scenarios.
- Evidence: `.omo/evidence/task-<N>-<slug>.<ext>`
- RED -> GREEN mapping:
  - Task 1: add shared contract tests first; RED shows missing exports/types; GREEN shows shared build and contract tests pass.
  - Task 2: add source/helper tests first; RED shows missing normalization/compliance behavior; GREEN shows helper tests and Worker dry-run compile.
  - Task 3: add Python writer tests first; RED shows missing module/functions; GREEN shows CSV/XLSX/status files written in temp Desktop.
  - Task 4: add admin static/behavior tests first; RED shows no product-collect hook; GREEN shows collect call after completed category and no call after cancel/fail.
  - Task 5: add packaging/env checks first; RED shows missing env/openpyxl docs; GREEN shows build script/env example/docs checks pass.
  - Task 6: add Worker route/integration checks first; RED shows 404/missing D1 table; GREEN shows collect/export routes with mock and fallback.
  - Task 7: add UI runtime checks first; RED shows no export status; GREEN shows UI status and auto loop product collection.
  - Task 8: add launcher integration tests first; RED shows no export thread/status; GREEN shows local poller writes Desktop files and handles locked replacement.
  - Task 9: add docs/operator checks first; RED shows incomplete operator path; GREEN shows README/context/env docs and cleanup receipt.

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.

Wave 1 (no dependencies):
- Task 1: Shared best-product contract and normalization tests
- Task 2: NAVER Shopping source helper and compliance gate tests
- Task 3: Local Desktop file writer module with mock export tests
- Task 4: Admin auto-loop product hook test scaffolding
- Task 5: Packaging/env baseline for openpyxl and NAVER product settings

Wave 2 (after Wave 1):
- Task 6: Worker D1 persistence and collect/export routes depends [1, 2]
- Task 7: Admin auto-loop integration and status UI depends [1, 4, 6]
- Task 8: Python launcher export thread integration depends [3, 6]
- Task 9: Operator docs, env example, and cleanup receipts depends [5, 6, 8]

Critical path: Task 1 -> Task 6 -> Task 7 -> Final verification

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1    | none       | 6, 7   | 2, 3, 4, 5           |
| 2    | none       | 6      | 1, 3, 4, 5           |
| 3    | none       | 8      | 1, 2, 4, 5           |
| 4    | none       | 7      | 1, 2, 3, 5           |
| 5    | none       | 9      | 1, 2, 3, 4           |
| 6    | 1, 2       | 7, 8, 9| none                 |
| 7    | 1, 4, 6    | F1-F4  | 8, 9                 |
| 8    | 3, 6       | F1-F4  | 7, 9                 |
| 9    | 5, 6, 8    | F1-F4  | 7                    |

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. Shared best-product contract and normalization tests

  What to do: Add shared types/helpers for best-product rows, export payloads, source modes, row dedupe keys, and deterministic export ordering. Include fields for `sourceMode`, `isRealProduct`, `categoryCid`, `categoryPath`, `query`, `keywordRank`, `candidateKeyword`, `productRank`, `productId`, `title`, `link`, `image`, `mallName`, `lprice`, `apiCategory1..4`, `firstSeenAt`, `lastSeenAt`, `seenCount`, `status`, and `message`. Add tests before implementation.
  Must NOT do: Do not call NAVER from shared code. Do not alter existing auto queue behavior except type additions.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6, 7] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `shared/src/trends.ts:343-423` - settings and collection input types/helpers are already centralized here.
  - Pattern:  `shared/src/trends.ts:477-560` - auto queue summary uses shared result/status objects.
  - Test:     `web/tests/admin-auto-collection.test.mjs:70-126` - existing Node test style for shared auto helpers.
  - Test:     `shared/tests/trend-brand-settings.test.mjs:1-18` - existing shared `node:test` import from `shared/dist/index.js`.
  - Build:    `shared/package.json:7-11` - shared build/typecheck commands.
  - API/Type: `shared/src/index.ts` - public re-export surface for shared contracts.

  Acceptance criteria (agent-executable only):
  - [ ] RED captured: `node --test shared/tests/best-products-contract.test.mjs` fails before exports exist; evidence `.omo/evidence/task-1-contract-red.txt`.
  - [ ] `corepack pnpm --filter @runacademy/shared build` exits 0.
  - [ ] `node --test shared/tests/trend-brand-settings.test.mjs shared/tests/best-products-contract.test.mjs web/tests/admin-auto-collection.test.mjs` exits 0.
  - [ ] Tests assert fallback rows cannot be marked as `isRealProduct=true`.
  - [ ] Tests assert duplicate product rows keep the better/lower rank and increment `seenCount`.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: shared contract green
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              New-Item -ItemType Directory -Force .omo\evidence
              corepack pnpm --filter @runacademy/shared build *> .omo/evidence/task-1-shared-build.txt
              node --test shared/tests/trend-brand-settings.test.mjs shared/tests/best-products-contract.test.mjs web/tests/admin-auto-collection.test.mjs *> .omo/evidence/task-1-contract-green.txt
    Expected: both commands exit 0; test output contains pass lines for best-product dedupe and fallback labelling.
    Evidence: .omo/evidence/task-1-contract-green.txt

  Scenario: fallback labelling guard
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              node --test --test-name-pattern "fallback rows are not real products" shared/tests/best-products-contract.test.mjs *> .omo/evidence/task-1-fallback-label.txt
    Expected: exit 0; assertion verifies source_mode `keyword_snapshot_fallback` has `isRealProduct === false`.
    Evidence: .omo/evidence/task-1-fallback-label.txt
  ```

  Commit: YES | Message: `feat(shared): add best product export contracts` | Files: [`shared/src/trends.ts`, `shared/src/index.ts`, `shared/tests/best-products-contract.test.mjs`]

- [ ] 2. NAVER Shopping source helper and compliance gate tests

  What to do: Add an isolated product-source helper, preferably `edge-api/src/best-products.ts`, that builds official NAVER Shopping API requests, normalizes response items, strips HTML tags from titles, computes dedupe keys, filters by category-path tokens when possible, and refuses real-product persistence unless `NAVER_SHOPPING_CLIENT_ID`, `NAVER_SHOPPING_CLIENT_SECRET`, and `NAVER_SHOPPING_RESULT_STORAGE_CONFIRMED=1` are all present. Add tests/checks first.
  Must NOT do: Do not implement direct scraping of `search.shopping.naver.com`. Do not store real product rows if the compliance flag is missing.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `edge-api/src/index.ts:34-39` - Worker env object currently includes D1 and Google Sheets env fields.
  - Pattern:  `edge-api/src/index.ts:69-80` - existing external endpoint constants and headers.
  - Pattern:  `edge-api/src/index.ts:1861-1934` - existing NAVER Datalab request flow for category/keyword ranks.
  - Pattern:  `edge-api/src/index.ts:1997-2035` - existing NAVER session/fetch helper and error style.
  - External: `https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md` - official Shopping Search API endpoint, headers, params, and response fields.
  - External: `https://help.naver.com/service/30015/contents/17309?lang=ko` - NAVER help/source for Search API quotas and extraction/storage risk.

  Acceptance criteria (agent-executable only):
  - [ ] RED captured: source helper tests/static checks fail before helper exists; evidence `.omo/evidence/task-2-source-red.txt`.
  - [ ] Helper builds request URL with `query`, `display`, `start=1`, and `sort=sim`.
  - [ ] Helper never logs or exports client secret.
  - [ ] Missing credentials or missing `NAVER_SHOPPING_RESULT_STORAGE_CONFIRMED=1` returns/uses fallback mode, not an external call.
  - [ ] Mock official response with HTML title tags normalizes to clean text and preserves product/link/image/mall/price/category fields.
  - [ ] `corepack pnpm wrangler deploy --config edge-api/wrangler.jsonc --dry-run` exits 0 after integration.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: official API request shape from mock
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              node --test edge-api/tests/best-products-source.test.mjs *> .omo/evidence/task-2-source-green.txt
    Expected: exit 0; assertions show request host `openapi.naver.com`, path `/v1/search/shop.json`, `display=2` or configured display, and no direct shopping web URL.
    Evidence: .omo/evidence/task-2-source-green.txt

  Scenario: compliance flag blocks real persistence
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              Remove-Item Env:\NAVER_SHOPPING_RESULT_STORAGE_CONFIRMED -ErrorAction SilentlyContinue
              node --test --test-name-pattern "compliance" edge-api/tests/best-products-source.test.mjs *> .omo/evidence/task-2-compliance-block.txt
    Expected: exit 0; test proves source mode is `keyword_snapshot_fallback` and no fetch call occurs.
    Evidence: .omo/evidence/task-2-compliance-block.txt
  ```

  Commit: YES | Message: `feat(edge): add naver shopping product source guard` | Files: [`edge-api/src/best-products.ts`, `edge-api/tests/best-products-source.test.mjs`]

- [ ] 3. Local Desktop file writer module with mock export tests

  What to do: Add a Python writer module, e.g. `local_best_products_export.py`, that accepts Worker export JSON rows and writes Desktop CSV/XLSX/status files. Use `csv.DictWriter` with `utf-8-sig`; use `openpyxl` when installed; write temp files in the same directory and replace with `os.replace`; handle `PermissionError` when Excel has the file open by writing a status JSON and a timestamped fallback copy.
  Must NOT do: Do not write directly from Worker. Do not require Excel to be installed. Do not fail the whole launcher if XLSX writing is unavailable; CSV remains required.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [8] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `local_app_launcher.py:20-32` - constants for app title, API URL, log, and pump interval.
  - Pattern:  `local_app_launcher.py:67-69` - current append-only log helper.
  - Pattern:  `tests/test_local_app_launcher.py:1-55` - existing Python unittest style and module-loading pattern.
  - External: `https://docs.python.org/3/library/csv.html#csv.DictWriter` - CSV writer.
  - External: `https://docs.python.org/3/library/os.html#os.replace` - atomic replace API.
  - External: `https://openpyxl.readthedocs.io/en/stable/tutorial.html#saving-to-a-file` - XLSX workbook save.

  Acceptance criteria (agent-executable only):
  - [ ] RED captured: `python -m unittest tests.test_local_best_products_export` fails before module exists; evidence `.omo/evidence/task-3-writer-red.txt`.
  - [ ] `python -m unittest tests.test_local_best_products_export` exits 0.
  - [ ] Temp Desktop fixture contains `best-products-latest.csv`, `best-products-status.json`, and `.xlsx` when `openpyxl` is available.
  - [ ] CSV starts with UTF-8 BOM and includes Korean sample terms without mojibake.
  - [ ] Locked-destination simulation produces a timestamped fallback file and status `"replace_pending"` without raising.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: write CSV/XLSX from mock rows
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              python -m unittest tests.test_local_best_products_export *> .omo/evidence/task-3-writer-green.txt
    Expected: exit 0; test output says 0 failures; temp files include rows for `니트` and `원피스`.
    Evidence: .omo/evidence/task-3-writer-green.txt

  Scenario: Excel file locked
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              python -m unittest tests.test_local_best_products_export.LocalBestProductsExportTests.test_locked_xlsx_destination_writes_pending_status *> .omo/evidence/task-3-locked-file.txt
    Expected: exit 0; status JSON reports `replace_pending`; no uncaught PermissionError.
    Evidence: .omo/evidence/task-3-locked-file.txt
  ```

  Commit: YES | Message: `feat(local): add desktop best product file writer` | Files: [`local_best_products_export.py`, `tests/test_local_best_products_export.py`]

- [ ] 4. Admin auto-loop product hook test scaffolding

  What to do: Add RED tests/checks for the admin auto loop before implementation. The checks must require a `startBestProductCollectionRequest` helper and prove product collection is called only after each completed category run settles. Keep this as test scaffolding if Worker route is not ready yet; Task 7 will make it GREEN.
  Must NOT do: Do not change UI behavior yet beyond tests/static checks in this task. Do not make product collection stop the category loop on non-critical product errors.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [7] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `web/app/sourcing/admin/page.tsx:599-686` - `handleStartAutoCollection` builds queue and starts each category.
  - Pattern:  `web/app/sourcing/admin/page.tsx:737-755` - `waitForRun` and `onResult` are the right points for post-category work/status.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1375-1488` - existing auto panel/status/button layout.
  - Pattern:  `web/app/sourcing/admin/page.tsx:2651-2658` - existing request helper style.
  - Test:     `web/tests/admin-auto-collection.test.mjs:238-262` - existing source-level regression tests for request behavior.

  Acceptance criteria (agent-executable only):
  - [ ] RED captured: updated `web/tests/admin-auto-collection.test.mjs` fails because `startBestProductCollectionRequest`/hook is missing; evidence `.omo/evidence/task-4-admin-red.txt`.
  - [ ] Test asserts product collection follows completed `waitForRun`, not initial queued run creation.
  - [ ] Test asserts failed/cancelled category run does not insert product rows.
  - [ ] Test asserts product collection failure updates status text but does not continue to burn through every category if the category run itself failed.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: admin source checks are red before implementation
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              corepack pnpm --filter @runacademy/shared build *> .omo/evidence/task-4-shared-build.txt
              node --test web/tests/admin-auto-collection.test.mjs *> .omo/evidence/task-4-admin-red.txt
    Expected: command fails before Task 7 with an assertion mentioning missing product collection hook.
    Evidence: .omo/evidence/task-4-admin-red.txt

  Scenario: no accidental direct shopping scrape string
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              Select-String -Path web/app/sourcing/admin/page.tsx -Pattern "search.shopping.naver.com" *> .omo/evidence/task-4-no-shopping-scrape.txt
    Expected: no matches; exit behavior recorded in evidence.
    Evidence: .omo/evidence/task-4-no-shopping-scrape.txt
  ```

  Commit: YES | Message: `test(web): require best product collection hook` | Files: [`web/tests/admin-auto-collection.test.mjs`]

- [ ] 5. Packaging/env baseline for openpyxl and NAVER product settings

  What to do: Add env/docs/build-script checks for local EXE product output. Update `.env.example` with `NAVER_SHOPPING_CLIENT_ID`, `NAVER_SHOPPING_CLIENT_SECRET`, `NAVER_SHOPPING_RESULT_STORAGE_CONFIRMED`, and local export interval/path names. Update `build_local_app_exe.ps1` to install/include `openpyxl` for XLSX output. Add tests/static checks first.
  Must NOT do: Do not put secrets in docs or code. Do not require credentials for fallback export.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [9] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `.env.example` - existing env template file.
  - Pattern:  `build_local_app_exe.ps1:13-20` - install/build sequence for shared/web/PyInstaller.
  - Pattern:  `build_local_app_exe.ps1:22-40` - PyInstaller entry point and site bundle.
  - Pattern:  `README.md:23-45` - local build/run instructions.
  - Pattern:  `local_app_launcher.py:337-344` - Tk window text lists local API/UI info.

  Acceptance criteria (agent-executable only):
  - [ ] RED captured: static check fails before env/docs/build changes; evidence `.omo/evidence/task-5-env-red.txt`.
  - [ ] `.env.example` contains product env names but no real secret-looking values.
  - [ ] `build_local_app_exe.ps1` installs `openpyxl` with the Python used for PyInstaller.
  - [ ] README explains official API credential requirement, fallback behavior, and Desktop output path.
  - [ ] Static check verifies no `NAVER_SHOPPING_CLIENT_SECRET=` value other than placeholder appears in tracked text files.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: env/build docs static check
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              node --test tests/best-products-env-docs.test.mjs *> .omo/evidence/task-5-env-green.txt
    Expected: exit 0; assertions find env names, openpyxl install, and no real secrets.
    Evidence: .omo/evidence/task-5-env-green.txt

  Scenario: no secret leakage
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              Select-String -Path .env.example,README.md,build_local_app_exe.ps1 -Pattern "NAVER_SHOPPING_CLIENT_SECRET=.*[A-Za-z0-9]{12,}" *> .omo/evidence/task-5-secret-scan.txt
    Expected: no matches except placeholder text; evidence records empty scan.
    Evidence: .omo/evidence/task-5-secret-scan.txt
  ```

  Commit: YES | Message: `chore(local): document product export settings` | Files: [`.env.example`, `build_local_app_exe.ps1`, `README.md`, `tests/best-products-env-docs.test.mjs`]

- [ ] 6. Worker D1 persistence and collect/export routes

  What to do: Add D1 table/migration and Worker routes:
  - `POST /v1/trends/best-products/collect` with `{ runId, categoryCid, categoryPath, query, limit }`.
  - `GET /v1/trends/best-products/export` returning accumulated rows, row count, revision, source mode summary, and generatedAt.
  - Optional `POST /v1/trends/best-products/reset` only if tests and UI explicitly use it; otherwise omit.
  Collection behavior: for real mode, call Task 2 official source helper and upsert by dedupe key while preserving best/lower product rank. For fallback mode, read latest completed period snapshots from `trend_snapshots` for that run/profile and insert clearly labelled keyword fallback rows. Add migration compatibility in `applySchemaChanges`.
  Must NOT do: Do not put NAVER credentials into DB or exported rows. Do not fail all category collection if product collection is in fallback mode.

  Parallelization: Can parallel: NO | Wave 2 | Blocks: [7, 8, 9] | Blocked by: [1, 2]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `edge-api/src/index.ts:97-116` - request routing switch.
  - Pattern:  `edge-api/src/index.ts:136-140` - existing `POST /v1/trends/collect` route style.
  - Pattern:  `edge-api/src/index.ts:936-1008` - run snapshot page route queries profile/run/snapshots.
  - Pattern:  `edge-api/src/index.ts:1571-1602` - snapshot insert/delete style and `batchInChunks`.
  - Pattern:  `edge-api/src/index.ts:2126-2183` - export-like Google Sheets sync returns rows from snapshots.
  - Pattern:  `edge-api/src/index.ts:2277-2340` - tab/row building style for spreadsheet output.
  - Pattern:  `edge-api/src/index.ts:2545-2614` - schema compatibility migration style.
  - Schema:   `edge-api/schema.sql:1-97` - existing D1 table/index declarations.
  - API/Type: `shared/src/trends.ts:92-109` - keyword snapshot row shape for fallback.
  - API/Type: `shared/src/trends.ts:239-258` - run detail includes profile/snapshots/analysis.

  Acceptance criteria (agent-executable only):
  - [ ] RED captured: curl/static route check returns 404 or missing table before implementation; evidence `.omo/evidence/task-6-routes-red.txt`.
  - [ ] `edge-api/schema.sql` defines `trend_best_products` with stable dedupe key, source mode, real/fallback marker, category/query/product fields, timestamps, and indexes.
  - [ ] `applySchemaChanges` adds the table/indexes for existing local DBs.
  - [ ] `POST /v1/trends/best-products/collect` with no NAVER credentials writes fallback rows from latest rank 1..2 snapshots.
  - [ ] With mock official NAVER response and compliance flag, route writes real product rows and `GET /export` returns them.
  - [ ] `GET /export` never includes client secret and orders rows by category path, query, best rank, and last seen.
  - [ ] `corepack pnpm wrangler deploy --config edge-api/wrangler.jsonc --dry-run` exits 0.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: fallback collect/export via local Worker
    Tool:     PowerShell + curl
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run a local Worker:
              corepack pnpm wrangler d1 execute naver-trend-maker-db --local --file edge-api/schema.sql --config edge-api/wrangler.jsonc *> .omo/evidence/task-6-schema.txt
              corepack pnpm wrangler dev --config edge-api/wrangler.jsonc --local --port 8787 --inspector-port 0
              In another PS prompt, seed a completed run/snapshots or reuse existing local run, then run:
              Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/v1/trends/best-products/collect -ContentType application/json -Body '{"runId":"<completed-run-id>","categoryCid":4,"categoryPath":"패션의류 > 여성의류 > 니트","query":"니트","limit":2}' | ConvertTo-Json -Depth 8 | Out-File .omo/evidence/task-6-fallback-collect.json -Encoding utf8
              Invoke-RestMethod -Uri http://127.0.0.1:8787/v1/trends/best-products/export | ConvertTo-Json -Depth 8 | Out-File .omo/evidence/task-6-fallback-export.json -Encoding utf8
    Expected: collect response ok true; export has at least 2 rows with `sourceMode` fallback and `isRealProduct` false.
    Evidence: .omo/evidence/task-6-fallback-export.json

  Scenario: mock official NAVER rows
    Tool:     PowerShell + curl
    Steps:    Start Worker with mock env values:
              $env:NAVER_SHOPPING_CLIENT_ID="mock-client"
              $env:NAVER_SHOPPING_CLIENT_SECRET="mock-secret"
              $env:NAVER_SHOPPING_RESULT_STORAGE_CONFIRMED="1"
              $env:NAVER_SHOPPING_MOCK_RESPONSE_JSON='{"items":[{"title":"<b>니트</b> A","link":"https://example.test/a","image":"https://example.test/a.jpg","lprice":"10000","mallName":"mockmall","productId":"p-a","productType":"1","category1":"패션의류","category2":"여성의류","category3":"니트","category4":""},{"title":"니트 B","link":"https://example.test/b","image":"https://example.test/b.jpg","lprice":"12000","mallName":"mockmall","productId":"p-b","productType":"1","category1":"패션의류","category2":"여성의류","category3":"니트","category4":""}]}'
              Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/v1/trends/best-products/collect -ContentType application/json -Body '{"runId":"<completed-run-id>","categoryCid":4,"categoryPath":"패션의류 > 여성의류 > 니트","query":"니트","limit":2}' | ConvertTo-Json -Depth 8 | Out-File .omo/evidence/task-6-real-mock-collect.json -Encoding utf8
    Expected: response rows have `isRealProduct` true, cleaned title `니트 A`, product IDs `p-a` and `p-b`, and no secret value.
    Evidence: .omo/evidence/task-6-real-mock-collect.json
  ```

  Commit: YES | Message: `feat(edge): persist best product export rows` | Files: [`edge-api/schema.sql`, `edge-api/src/index.ts`, `edge-api/src/best-products.ts`, `edge-api/tests/best-products-source.test.mjs`]

- [ ] 7. Admin auto-loop integration and status UI

  What to do: Wire the admin auto-category flow so each completed category run triggers `POST /v1/trends/best-products/collect` with Top 2 target and query based on the leaf category name. Add a compact status line/pills in the existing auto panel showing product export mode, accumulated row count if available, and last product collection message. Keep product collection errors non-blocking unless the category collection itself fails.
  Must NOT do: Do not remove current auto stop behavior. Do not call product collection before the run has settled. Do not call product collection for cancelled/failed runs.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [F1-F4] | Blocked by: [1, 4, 6]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `web/app/sourcing/admin/page.tsx:599-686` - auto start and collect callback.
  - Pattern:  `web/app/sourcing/admin/page.tsx:737-755` - `waitForRun`/`onResult`; insert post-completed product collection here.
  - Pattern:  `web/app/sourcing/admin/page.tsx:792-806` - stop/cancel active run behavior must remain intact.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1375-1424` - existing auto panel layout for progress/status.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1426-1488` - feedback banner and buttons.
  - Pattern:  `web/app/sourcing/admin/page.tsx:2651-2665` - request helper style.
  - Style:    `web/app/sourcing/admin/admin.module.css` - add styles next to existing auto panel, badge, pill, and inline helper classes.
  - Test:     `web/tests/admin-auto-collection.test.mjs:150-201` - existing stop/failure behavior to preserve.
  - Test:     `web/tests/admin-auto-collection.test.mjs:238-262` - static request regression pattern.

  Acceptance criteria (agent-executable only):
  - [ ] RED from Task 4 is converted to GREEN; evidence `.omo/evidence/task-7-admin-green.txt`.
  - [ ] `startBestProductCollectionRequest` posts to `/trends/best-products/collect`.
  - [ ] Request body includes `runId`, category `cid`, `fullPath`, `name` as query, and `limit: 2`.
  - [ ] Completed runs trigger product collection; failed/cancelled runs do not.
  - [ ] Existing auto tests still pass, including force refresh assertions.
  - [ ] `corepack pnpm --filter @runacademy/web typecheck` exits 0.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: auto helper tests green
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              corepack pnpm --filter @runacademy/shared build *> .omo/evidence/task-7-shared-build.txt
              node --test web/tests/admin-auto-collection.test.mjs *> .omo/evidence/task-7-admin-green.txt
              corepack pnpm --filter @runacademy/web typecheck *> .omo/evidence/task-7-web-typecheck.txt
    Expected: all commands exit 0; test output includes completed-run product collection and no cancelled-run collection.
    Evidence: .omo/evidence/task-7-admin-green.txt

  Scenario: browser sees product export status
    Tool:     playwright(real Chrome)
    Steps:    Start web/API locally, then in Chrome open `http://127.0.0.1:3000/sourcing/admin`; configure API base `http://127.0.0.1:8787/v1`; inspect `[data-testid="auto-collection-panel"]` and click `[data-testid="auto-collection-start"]` with mock API.
    Expected: auto panel includes product export status text/pill; no overlapping controls at desktop width; screenshot captured.
    Evidence: .omo/evidence/task-7-browser-status.png
  ```

  Commit: YES | Message: `feat(web): collect best products during auto category runs` | Files: [`web/app/sourcing/admin/page.tsx`, `web/app/sourcing/admin/admin.module.css`, `web/tests/admin-auto-collection.test.mjs`]

- [ ] 8. Python launcher export thread integration

  What to do: Integrate Task 3 writer into `local_app_launcher.py`. Add a background export thread that polls `GET http://127.0.0.1:8787/v1/trends/best-products/export` every few seconds, writes only when export revision changes, logs success/failure, writes Desktop status JSON, and stops cleanly with the existing shutdown event. Show Desktop export folder in the Tk window text.
  Must NOT do: Do not block the collection pump on file writing. Do not crash the app when the export route is unavailable, when no rows exist, or when Excel has the file open.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [F1-F4] | Blocked by: [3, 6]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `local_app_launcher.py:20-32` - constants; add output interval/path constants here.
  - Pattern:  `local_app_launcher.py:67-69` - append log helper.
  - Pattern:  `local_app_launcher.py:199-225` - background collection pump pattern.
  - Pattern:  `local_app_launcher.py:298-357` - shutdown handler and Tk window content.
  - Pattern:  `local_app_launcher.py:367-389` - main starts API, UI server, pump, browser, and window.
  - Test:     `tests/test_local_app_launcher.py:23-51` - existing Python unittest style.
  - API:      Task 6 `GET /v1/trends/best-products/export` response contract.

  Acceptance criteria (agent-executable only):
  - [ ] RED captured: launcher tests fail before export thread exists; evidence `.omo/evidence/task-8-launcher-red.txt`.
  - [ ] `python -m unittest tests.test_local_app_launcher tests.test_local_best_products_export` exits 0.
  - [ ] Tests verify shutdown sets both collection/export stop events or a shared stop event stops both loops.
  - [ ] Tests verify poller does not rewrite files when revision is unchanged.
  - [ ] Tests verify unavailable API route logs failure and retries without raising.
  - [ ] Tk window body includes the Desktop export folder path.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: launcher unit tests green
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              python -m unittest tests.test_local_app_launcher tests.test_local_best_products_export *> .omo/evidence/task-8-launcher-green.txt
    Expected: exit 0; tests cover export thread lifecycle, unchanged revision skip, and unavailable API retry.
    Evidence: .omo/evidence/task-8-launcher-green.txt

  Scenario: runtime poll writes Desktop fixture
    Tool:     PowerShell
    Steps:    Start local Worker with Task 6 mock export; set a temp Desktop override env if implemented, e.g. `$env:NAVER_TREND_EXPORT_DESKTOP_DIR="$PWD\.omo\evidence\desktop-fixture"`; run:
              python local_app_launcher.py
              Wait for one export poll; then inspect `.omo\evidence\desktop-fixture\Naver Trend Maker 10\best-products-latest.csv`.
    Expected: CSV exists and contains at least two rows; status JSON has latest revision; app remains open.
    Evidence: .omo/evidence/task-8-runtime-export.txt
  ```

  Commit: YES | Message: `feat(local): auto write best product desktop export` | Files: [`local_app_launcher.py`, `local_best_products_export.py`, `tests/test_local_app_launcher.py`, `tests/test_local_best_products_export.py`]

- [ ] 9. Operator docs, env example, and cleanup receipts

  What to do: Finalize operator-facing docs and cleanup receipts. Explain PowerShell commands, where the Desktop files appear, how to enable official NAVER Shopping API mode, how fallback mode is labelled, what happens if Excel has the file open, and how to run tests. Add a small cleanup/status evidence command that records generated evidence/output files without deleting user data.
  Must NOT do: Do not tell the operator that fallback rows are real products. Do not include real client IDs/secrets. Do not promise exact live Naver Shopping web ranking parity; call official API order "NAVER Shopping Search API relevance order".

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [F1-F4] | Blocked by: [5, 6, 8]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `README.md:1-12` - project overview.
  - Pattern:  `README.md:23-45` - local build/run command section.
  - Pattern:  `README.md:83-90` - API address/env guidance.
  - Pattern:  `NAVER_TREND_MAKER_CONTEXT.md` - existing project context note; update only if it already documents recent local EXE behavior.
  - Pattern:  `.env.example` - env template.
  - Pattern:  `local_app_launcher.py:337-344` - local window text should match docs.
  - External: `https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md` - official API docs.
  - External: `https://help.naver.com/service/30015/contents/17309?lang=ko` - terms/quota/storage caution.

  Acceptance criteria (agent-executable only):
  - [ ] RED captured: docs check fails before complete docs; evidence `.omo/evidence/task-9-docs-red.txt`.
  - [ ] README contains exact PowerShell commands for install/build/test and output file locations.
  - [ ] `.env.example` keeps placeholders only.
  - [ ] Docs state real-product rows require credentials and `NAVER_SHOPPING_RESULT_STORAGE_CONFIRMED=1`.
  - [ ] Docs state fallback rows are keyword candidates from trend snapshots, not actual shopping products.
  - [ ] Evidence receipt lists Desktop fixture files and no generated source artifacts in `build/`, `dist/`, or `__pycache__/` are committed.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: docs check green
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              node --test tests/best-products-env-docs.test.mjs *> .omo/evidence/task-9-docs-green.txt
    Expected: exit 0; docs include official API/fallback/Excel lock language.
    Evidence: .omo/evidence/task-9-docs-green.txt

  Scenario: cleanup receipt
    Tool:     PowerShell
    Steps:    In PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run:
              git status --short | Out-File .omo/evidence/task-9-git-status.txt -Encoding utf8
              Get-ChildItem .omo\evidence -File | Select-Object Name,Length,LastWriteTime | Format-Table | Out-File .omo/evidence/task-9-evidence-files.txt -Encoding utf8
    Expected: status shows only intended source/test/docs changes plus evidence; no generated build/dist/cache files staged.
    Evidence: .omo/evidence/task-9-git-status.txt
  ```

  Commit: YES | Message: `docs(local): explain best product excel export` | Files: [`README.md`, `.env.example`, `NAVER_TREND_MAKER_CONTEXT.md`, `tests/best-products-env-docs.test.mjs`]

## Final verification wave (MANDATORY - after all implementation tasks)
> Runs in PARALLEL. ALL must APPROVE. Surface results to the caller and wait for an explicit "okay" before declaring complete.
- [ ] F1. Plan compliance audit - every task done, every acceptance criterion met
- [ ] F2. Code quality review - diagnostics clean, idioms match, no dead code
- [ ] F3. Real manual QA - every QA scenario executed with evidence captured
- [ ] F4. Scope fidelity - nothing extra shipped beyond Must-Have, nothing Must-NOT-Have introduced

Suggested final commands:
```powershell
corepack pnpm --filter @runacademy/shared build *> .omo/evidence/final-shared-build.txt
node --test shared/tests/trend-brand-settings.test.mjs shared/tests/best-products-contract.test.mjs web/tests/admin-auto-collection.test.mjs edge-api/tests/best-products-source.test.mjs tests/best-products-env-docs.test.mjs *> .omo/evidence/final-node-tests.txt
python -m unittest tests.test_local_app_launcher tests.test_local_best_products_export *> .omo/evidence/final-python-tests.txt
corepack pnpm -r typecheck *> .omo/evidence/final-typecheck.txt
corepack pnpm wrangler deploy --config edge-api/wrangler.jsonc --dry-run *> .omo/evidence/final-wrangler-dry-run.txt
git diff --check *> .omo/evidence/final-diff-check.txt
git status --short *> .omo/evidence/final-git-status.txt
```

Required runtime QA:
```powershell
corepack pnpm wrangler d1 execute naver-trend-maker-db --local --file edge-api/schema.sql --config edge-api/wrangler.jsonc *> .omo/evidence/final-schema.txt
corepack pnpm wrangler dev --config edge-api/wrangler.jsonc --local --port 8787 --inspector-port 0
```

Then, in a second PowerShell prompt:
```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8787/v1/health | ConvertTo-Json | Out-File .omo/evidence/final-health.json -Encoding utf8
Invoke-RestMethod -Uri http://127.0.0.1:8787/v1/trends/best-products/export | ConvertTo-Json -Depth 8 | Out-File .omo/evidence/final-export.json -Encoding utf8
```

Browser QA:
```text
Tool: playwright(real Chrome)
Open: http://127.0.0.1:3000/sourcing/admin
Actions: configure API base http://127.0.0.1:8787/v1, run one mock auto category flow, wait for product status, screenshot auto panel.
Evidence: .omo/evidence/final-browser-auto-products.png and .omo/evidence/final-browser-auto-products.json
```

## Commit strategy
- One logical change per commit. Conventional Commits (`<type>(<scope>): <subject>` body + footer).
- Atomic: every commit builds and passes tests on its own.
- No "WIP" / "fix typo squash later" commits on the final branch - clean up before merge.
- Reference the plan file path in the final commit footer: `Plan: .omo/plans/best-products-auto-excel.md`.

## Success criteria
- All Must-Have shipped; all QA scenarios pass with captured evidence; F1-F4 approved; commit history clean.
