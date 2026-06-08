# Naver Trend Maker 10 Category Auto-Cycle Start Plan

## TL;DR
> Summary:      Based on exploration, the app can be modified without a schema rewrite by keeping the current "one category = one profile/run" backend model and making the Start flow create one collect run per target category. The main risks are UI visibility over more than 8 runs, worker fairness across many queued runs, and deterministic QA without hitting Naver.
> Deliverables:
> - Web Start flow that auto-cycles selected category scope and calls `/trends/collect` once per target category
> - Category-by-category status and recommendation access in the admin screen
> - Backend board visibility/fairness fixes so many category runs are not hidden or starved
> - Playwright and Python verification with evidence files under `.omo/evidence/`
> Effort:       Medium
> Risk:         Medium - existing backend is single-category per run, and queue ordering currently favors recently updated runs.

## Scope
### Must have
- Start button must support a category auto-cycle mode that targets all leaf categories under the currently selected category scope.
- If the selected category is already a leaf, Start must still create exactly one run for that selected category.
- Each target category must use the existing `TrendProfileInput` shape and existing `/trends/collect` endpoint unless an executor proves this cannot meet the QA scenarios.
- The UI must show auto-cycle progress: total categories, succeeded starts, failed starts, and the currently submitted category.
- The UI must keep category-by-category recommendations accessible through existing run details and completed analysis cards.
- Backend admin board must return enough runs for one auto-cycle batch, not only the current `LIMIT 8`.
- Worker queue selection must not keep choosing the same updated run while other category runs are pending.
- Local launcher pump behavior must stay continuous and tested.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do not change `edge-api/schema.sql` unless a failing acceptance criterion proves schema change is unavoidable.
- Do not build a new recommendation algorithm; reuse `buildTrendAnalysis` and existing run detail analysis.
- Do not replace Cloudflare D1/Worker architecture.
- Do not modify generated outputs such as `web/.next`, `web/.next-prod`, `edge-api/.wrangler`, `build/`, `dist/`, or EXE artifacts.
- Do not run real Naver collection during automated UI tests; mock admin/category/collect endpoints in Playwright.
- Do not treat the parent workspace as one app. Work only under `naver-trend-maker-10/`.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + Playwright for web admin behavior, Python `unittest` for local launcher, Wrangler/local HTTP checks for Worker behavior, and package build/typecheck.
- QA policy: every task has agent-executed scenarios
- Evidence: `.omo/evidence/task-<N>-<slug>.<ext>`

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.

Wave 1 (no dependencies):
- Task 1: Add deterministic Playwright QA harness and API mocks
- Task 2: Add category target builder for selected scope
- Task 3: Fix backend board visibility and queue fairness
- Task 4: Strengthen local collection pump tests
- Task 5: Add auto-cycle UI status styling/components

Wave 2 (after Wave 1):
- Task 6: depends [1, 2, 5]
- Task 7: depends [1, 3, 5, 6]
- Task 8: depends [6, 7]

Critical path: Task 1 -> Task 2 -> Task 6 -> Task 7 -> Task 8

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1    | none       | 6, 7   | 2, 3, 4, 5           |
| 2    | none       | 6      | 1, 3, 4, 5           |
| 3    | none       | 7      | 1, 2, 4, 5           |
| 4    | none       | F3     | 1, 2, 3, 5           |
| 5    | none       | 6, 7   | 1, 2, 3, 4           |
| 6    | 1, 2, 5    | 7, 8   | none                 |
| 7    | 1, 3, 5, 6 | 8      | none                 |
| 8    | 6, 7       | F1-F4  | none                 |

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. Add deterministic Playwright QA harness and API mocks

  What to do: Add Playwright test infrastructure under `web/` with a real-Chrome project, trace/screenshot evidence settings, and reusable admin API mock fixtures. Add only a smoke test in this task: load `/sourcing/admin`, mock `/trends/admin/board`, mock `/trends/categories/*`, and prove the current page can be driven without real Cloudflare or Naver calls.
  Must NOT do: Do not implement category auto-cycle behavior in this task. Do not call real `/trends/collect`.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6, 7] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `web/package.json:5-10` - existing web scripts; add `e2e` without removing `dev`, `build`, `lint`, `typecheck`.
  - Pattern:  `package.json:6-10` - root scripts use `corepack pnpm`; keep the same command style.
  - Pattern:  `web/app/sourcing/admin/page.tsx:2226-2237` - category loading already falls back locally and is safe to mock.
  - Pattern:  `web/app/sourcing/admin/page.tsx:2694-2714` - all admin API calls pass through the local `api<T>()` helper.
  - Test:     `tests/test_local_app_launcher.py:1-46` - current test style is small, deterministic, and avoids external services.
  - External: `https://github.com/microsoft/playwright/blob/main/docs/src/best-practices-js.md` - use `page.route` to mock external dependencies.
  - External: `https://github.com/microsoft/playwright/blob/main/docs/src/test-api/class-testoptions.md` - configure screenshots/traces for evidence.

  Acceptance criteria (agent-executable only):
  - [ ] `corepack pnpm --dir web exec playwright test e2e/admin-smoke.spec.ts --project=chrome --reporter=line` exits 0.
  - [ ] `.omo/evidence/task-1-admin-smoke.png` exists after the smoke test and shows the admin page loaded with mocked data.
  - [ ] `corepack pnpm --dir web e2e -- --list` lists at least `admin-smoke.spec.ts`.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: mocked admin page loads
    Tool:     playwright(real Chrome)
    Steps:    From PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run `corepack pnpm --dir web exec playwright test e2e/admin-smoke.spec.ts --project=chrome --reporter=line`.
    Expected: Exit code 0; test log includes `admin smoke`; screenshot file `.omo/evidence/task-1-admin-smoke.png` exists.
    Evidence: .omo/evidence/task-1-admin-smoke.png

  Scenario: Chrome missing fallback
    Tool:     playwright(real Chrome)
    Steps:    If the first command reports Chrome is missing, run `corepack pnpm --dir web exec playwright install chrome`, then rerun `corepack pnpm --dir web exec playwright test e2e/admin-smoke.spec.ts --project=chrome --reporter=line`.
    Expected: Exit code 0 after Chrome install; if Chrome install fails, use agent-browser and write the failure log to `.omo/evidence/task-1-admin-smoke-error.txt`.
    Evidence: .omo/evidence/task-1-admin-smoke-error.txt
  ```

  Commit: YES | Message: `test(web): add admin playwright harness` | Files: [`web/package.json`, `web/playwright.config.ts`, `web/e2e/**`, `pnpm-lock.yaml`]

- [ ] 2. Add category target builder for selected scope

  What to do: Add a small, testable helper that converts the selected category and loaded/fetched children into an ordered list of target categories. Rule: selected leaf -> one target; selected non-leaf -> all descendant leaf categories available through `fetchTrendCategories`/static fallback; if a branch has no children, use that node as a target. The helper should dedupe by `cid`, preserve category path labels, and cap the target count with a clear constant such as `AUTO_CYCLE_MAX_CATEGORIES = 50`.
  Must NOT do: Do not change shared API types to make `TrendProfileInput` accept arrays. Do not scrape new category sources.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `web/app/sourcing/admin/page.tsx:173-180` - `selectedCategory` currently resolves a single deepest selected category.
  - Pattern:  `web/app/sourcing/admin/page.tsx:286-335` - level 2/3 categories are loaded by selected parent.
  - Pattern:  `web/app/sourcing/admin/page.tsx:2226-2237` - category fetching falls back to `STATIC_TREND_ROOT_CATEGORIES`/`getStaticTrendCategoryChildren`.
  - API/Type: `shared/src/trends.ts:13-19` - `TrendCategoryNode` contract includes `cid`, `fullPath`, `level`, and `leaf`.
  - Pattern:  `web/lib/trend-category-fallback.ts:3-90` - static root categories exist.
  - Pattern:  `web/lib/trend-category-fallback.ts:17275-17277` - static child lookup helper exists.
  - External: `https://github.com/vercel/next.js/blob/canary/docs/01-app/01-getting-started/05-server-and-client-components.mdx` - client components support state/event handler driven UI.

  Acceptance criteria (agent-executable only):
  - [ ] `corepack pnpm --dir web exec playwright test e2e/category-target-builder.spec.ts --project=chrome --reporter=line` exits 0.
  - [ ] The test asserts a non-leaf root fixture resolves to multiple leaf targets with unique `cid` values.
  - [ ] The test asserts an already-leaf selected category resolves to exactly one target.
  - [ ] The helper exports a max-category guard and returns a visible error/flag when the cap is exceeded.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: non-leaf scope expands to leaves
    Tool:     playwright(real Chrome)
    Steps:    From PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run `corepack pnpm --dir web exec playwright test e2e/category-target-builder.spec.ts --project=chrome --reporter=line`.
    Expected: Exit code 0; output includes an assertion that at least 2 leaf targets are returned and all `cid` values are unique.
    Evidence: .omo/evidence/task-2-category-target-builder.txt

  Scenario: cap/error branch is deterministic
    Tool:     playwright(real Chrome)
    Steps:    Run the same command with the spec case that feeds more than `AUTO_CYCLE_MAX_CATEGORIES` fixture nodes.
    Expected: Exit code 0; output includes the exact cap message `자동 순회는 한 번에 50개 카테고리까지 지원합니다.`
    Evidence: .omo/evidence/task-2-category-target-builder-error.txt
  ```

  Commit: YES | Message: `feat(web): add category auto-cycle target builder` | Files: [`web/lib/trend-category-cycle.ts`, `web/e2e/category-target-builder.spec.ts`]

- [ ] 3. Fix backend board visibility and queue fairness

  What to do: Change the Worker admin board to accept an optional `limit` query param, default it to at least 24, cap it at 50, and use that value instead of hard-coded `LIMIT 8`. Also change unscoped worker run selection so process-next rotates across pending category runs by choosing the least recently updated eligible run first. Keep `runId`-scoped processing unchanged.
  Must NOT do: Do not increase `PROCESS_BATCH_MAX_TASKS` as a substitute for fairness. Do not remove the current one-running-task guard.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [7] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `edge-api/src/index.ts:115-122` - admin board route currently calls `getTrendAdminBoard(env.DB)` and may kick processing.
  - Pattern:  `edge-api/src/index.ts:248-265` - board SQL hard-codes `LIMIT 8`.
  - Pattern:  `edge-api/src/index.ts:81-88` - batch size and rate-limit constants are intentionally conservative.
  - Pattern:  `edge-api/src/index.ts:1215-1268` - process batch handles one or more tasks but defaults to one.
  - Pattern:  `edge-api/src/index.ts:1270-1295` - processing only kicks when no active running task blocks it.
  - Pattern:  `edge-api/src/index.ts:1355-1375` - unscoped candidate run query currently orders by `updated_at DESC`.
  - API/Type: `shared/src/trends.ts:268-273` - `TrendAdminBoard` only exposes `runs`; increasing count does not require a type change.
  - External: `https://developers.cloudflare.com/d1/get-started/` - D1-backed Worker data should be verified locally with Wrangler/D1.
  - External: `https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled` - scheduled handlers can continue background processing.

  Acceptance criteria (agent-executable only):
  - [ ] `corepack pnpm wrangler deploy --dry-run --config edge-api/wrangler.jsonc` exits 0.
  - [ ] A local Worker seeded with 12 runs returns 12 `board.runs` for `/v1/trends/admin/board?limit=12`.
  - [ ] A local Worker seeded with 60 runs returns no more than 50 `board.runs` for `/v1/trends/admin/board?limit=999`.
  - [ ] A deterministic fairness check proves unscoped `process-next` selects the oldest eligible run before a just-updated run.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: board limit shows one auto-cycle batch
    Tool:     PowerShell + curl.exe
    Steps:    From PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, start `corepack pnpm wrangler dev --config edge-api/wrangler.jsonc --local --port 8787`; seed local D1 with the task fixture; run `curl.exe -s "http://127.0.0.1:8787/v1/trends/admin/board?limit=12"`.
    Expected: JSON has `ok: true`; `board.runs.length` is 12; output is saved to `.omo/evidence/task-3-board-limit.json`.
    Evidence: .omo/evidence/task-3-board-limit.json

  Scenario: worker fairness rotates pending category runs
    Tool:     PowerShell + curl.exe
    Steps:    With the same local Worker fixture, run `curl.exe -s -X POST "http://127.0.0.1:8787/v1/trends/worker/process-next"` twice.
    Expected: The two responses reference different run IDs in oldest-updated order; output is saved to `.omo/evidence/task-3-worker-fairness.json`.
    Evidence: .omo/evidence/task-3-worker-fairness.json
  ```

  Commit: YES | Message: `fix(api): keep category cycle runs visible and fair` | Files: [`edge-api/src/index.ts`, `edge-api/test-fixtures/**`]

- [ ] 4. Strengthen local collection pump tests

  What to do: Add Python tests proving `start_collection_pump()` repeatedly calls `post_worker_process_next()` while the API port is open, logs failures without stopping, and stops promptly when `stop_event` is set. Keep the production pump interval unless evidence shows it prevents category cycling.
  Must NOT do: Do not open a real browser, start a real API server, or change EXE artifacts.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [F3] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `local_app_launcher.py:28-30` - pump interval and timeout constants.
  - Pattern:  `local_app_launcher.py:128-135` - `post_worker_process_next()` calls `/trends/worker/process-next`.
  - Pattern:  `local_app_launcher.py:138-154` - pump loop runs until stop event.
  - Pattern:  `local_app_launcher.py:313-316` - launcher starts the pump when the app opens.
  - Test:     `tests/test_local_app_launcher.py:1-46` - existing import/patch style.

  Acceptance criteria (agent-executable only):
  - [ ] `python -m unittest discover -s tests -p "test_*.py"` exits 0.
  - [ ] New tests assert at least two pump calls happen with patched short waits.
  - [ ] New tests assert a raised exception from `post_worker_process_next()` is logged and does not kill the thread before stop.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: pump continues while API port is open
    Tool:     PowerShell
    Steps:    From PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>, run `python -m unittest tests.test_local_app_launcher.LocalAppLauncherTests.test_collection_pump_repeats_process_next`.
    Expected: Exit code 0; mocked `post_worker_process_next` call count is at least 2.
    Evidence: .omo/evidence/task-4-pump-repeat.txt

  Scenario: pump logs transient failure
    Tool:     PowerShell
    Steps:    Run `python -m unittest tests.test_local_app_launcher.LocalAppLauncherTests.test_collection_pump_logs_failure_and_keeps_running`.
    Expected: Exit code 0; mocked `append_log` receives text containing `[pump] process-next failed`.
    Evidence: .omo/evidence/task-4-pump-error.txt
  ```

  Commit: YES | Message: `test(local): cover collection pump loop` | Files: [`tests/test_local_app_launcher.py`]

- [ ] 5. Add auto-cycle UI status styling/components

  What to do: Add compact UI state surfaces for auto-cycle progress without changing behavior yet: progress count, current category, failed category list, and a small batch summary. Use existing button, pill, archive, and status visual patterns.
  Must NOT do: Do not add decorative hero sections, nested cards, or a new page. Do not wire API calls in this task.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6, 7] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `web/app/sourcing/admin/page.tsx:632-735` - page derives visible run/report state before render.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1052-1068` - Start button uses icon/text states.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1071-1109` - archive list already displays category paths.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1180-1264` - progress panel layout and status stats.
  - Pattern:  `web/app/sourcing/admin/admin.module.css:453-496` - primary button styles.
  - Pattern:  `web/app/sourcing/admin/admin.module.css:550-620` - archive list styles.
  - Pattern:  `web/app/sourcing/admin/admin.module.css:679-710` - status pulse/copy styles.

  Acceptance criteria (agent-executable only):
  - [ ] `corepack pnpm --dir web typecheck` exits 0.
  - [ ] `corepack pnpm --dir web exec playwright test e2e/admin-cycle-status-ui.spec.ts --project=chrome --reporter=line` exits 0.
  - [ ] The status UI renders with fixture state and does not overlap at desktop 1440x1000 or mobile 390x844.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: cycle status is readable on desktop
    Tool:     playwright(real Chrome)
    Steps:    Run `corepack pnpm --dir web exec playwright test e2e/admin-cycle-status-ui.spec.ts --project=chrome --grep "desktop" --reporter=line`.
    Expected: Exit code 0; screenshot `.omo/evidence/task-5-status-desktop.png` exists and contains total/success/failure counts.
    Evidence: .omo/evidence/task-5-status-desktop.png

  Scenario: cycle status is readable on mobile
    Tool:     playwright(real Chrome)
    Steps:    Run `corepack pnpm --dir web exec playwright test e2e/admin-cycle-status-ui.spec.ts --project=chrome --grep "mobile" --reporter=line`.
    Expected: Exit code 0; screenshot `.omo/evidence/task-5-status-mobile.png` exists; no Playwright locator bounding boxes overlap.
    Evidence: .omo/evidence/task-5-status-mobile.png
  ```

  Commit: YES | Message: `feat(web): add category cycle status UI` | Files: [`web/app/sourcing/admin/page.tsx`, `web/app/sourcing/admin/admin.module.css`, `web/e2e/admin-cycle-status-ui.spec.ts`]

- [ ] 6. Implement sequential auto-cycle Start behavior

  What to do: Replace the single-run-only `handleStartAnalysis()` path with an auto-cycle controller that builds target categories, submits one `/trends/collect` request per category sequentially, records success/failure per category, prevents duplicate starts while submitting, and refreshes the board after the batch. Keep single selected leaf behavior as a one-item cycle. Use the existing `buildAnalysisRequestName`, filter values, and `api<T>()` helper.
  Must NOT do: Do not submit all categories concurrently. Do not change `/trends/collect` payload shape. Do not silently swallow all failures; show failed category count and messages.

  Parallelization: Can parallel: NO | Wave 2 | Blocks: [7, 8] | Blocked by: [1, 2, 5]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `web/app/sourcing/admin/page.tsx:408-482` - current single-category `handleStartAnalysis()` behavior to replace carefully.
  - Pattern:  `web/app/sourcing/admin/page.tsx:431-447` - current `/trends/collect` payload fields.
  - Pattern:  `web/app/sourcing/admin/page.tsx:460-474` - current board insertion slices runs to 8; replace with non-lossy batch update.
  - Pattern:  `web/app/sourcing/admin/page.tsx:2298-2322` - `buildAnalysisRequestName()` should be reused per category.
  - API/Type: `shared/src/trends.ts:21-34` - `TrendProfileInput` stays one category per request.
  - API/Type: `shared/src/trends.ts:238-258` - successful responses return `TrendRunDetail`.
  - External: `https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/static-exports.mdx` - browser-only APIs must stay guarded in Client Components.

  Acceptance criteria (agent-executable only):
  - [ ] `corepack pnpm --dir web typecheck` exits 0.
  - [ ] `corepack pnpm --dir web exec playwright test e2e/admin-category-cycle.spec.ts --project=chrome --reporter=line` exits 0.
  - [ ] In the happy-path spec, one Start click produces exactly one mocked POST to `/trends/collect` per target category, in target order.
  - [ ] In the partial-failure spec, failed category is shown, remaining categories still submit, and final feedback includes success and failure counts.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: Start cycles three leaf categories
    Tool:     playwright(real Chrome)
    Steps:    Run `corepack pnpm --dir web exec playwright test e2e/admin-category-cycle.spec.ts --project=chrome --grep "three leaf categories" --reporter=line`.
    Expected: Exit code 0; Playwright assertion sees exactly 3 collect requests with distinct `categoryCid`; screenshot `.omo/evidence/task-6-cycle-success.png` shows `3개 카테고리`.
    Evidence: .omo/evidence/task-6-cycle-success.png

  Scenario: one category fails and later category still starts
    Tool:     playwright(real Chrome)
    Steps:    Run `corepack pnpm --dir web exec playwright test e2e/admin-category-cycle.spec.ts --project=chrome --grep "partial failure" --reporter=line`.
    Expected: Exit code 0; second mocked collect response fails; third collect still occurs; UI shows exact failed category path and a final `2개 성공 / 1개 실패` style summary.
    Evidence: .omo/evidence/task-6-cycle-error.png
  ```

  Commit: YES | Message: `feat(web): auto-cycle categories on start` | Files: [`web/app/sourcing/admin/page.tsx`, `web/e2e/admin-category-cycle.spec.ts`]

- [ ] 7. Preserve category-by-category recommendation access

  What to do: Update board refresh calls to request a larger limit, keep current batch run IDs visible, and make the archive/result area show active and completed category runs from the auto-cycle batch. Ensure selecting a completed run still loads `analysisCards`, monthly planner, previews, and drilldown for that category. This task is what makes "recommendations by category" usable after the batch starts.
  Must NOT do: Do not merge multiple category analyses into one synthetic run. Do not hide active queued/running category runs because they are not `analysisReady` yet.

  Parallelization: Can parallel: NO | Wave 2 | Blocks: [8] | Blocked by: [1, 3, 5, 6]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `web/app/sourcing/admin/page.tsx:188-190` - current visible/completed run derivation filters completed analysis runs.
  - Pattern:  `web/app/sourcing/admin/page.tsx:259-284` - polling currently refreshes the board by visible run status.
  - Pattern:  `web/app/sourcing/admin/page.tsx:596-629` - `handleSelectArchivedRun()` loads completed run detail.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1071-1109` - archive UI only shows completed runs now.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1266-1742` - recommendation cards and monthly/detail UI are tied to `visibleRun.analysisReady`.
  - Pattern:  `edge-api/src/index.ts:1628-1717` - `buildRunDetail()` generates `analysisSummary`/`analysisCards` when analysis is ready.
  - Pattern:  `edge-api/src/index.ts:1749-1777` - analysis is cached per run.
  - External: `https://github.com/microsoft/playwright/blob/main/docs/src/best-practices-js.md` - use network mocks to verify run detail and archive behavior without external services.

  Acceptance criteria (agent-executable only):
  - [ ] `corepack pnpm --dir web exec playwright test e2e/admin-category-recommendations.spec.ts --project=chrome --reporter=line` exits 0.
  - [ ] The spec proves `/trends/admin/board?limit=50` or equivalent is requested.
  - [ ] The spec shows at least 12 category runs visible/accessible when mocked board returns 12.
  - [ ] Selecting a completed category run renders recommendation card content for that run's `categoryPath`.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 12 category runs remain visible
    Tool:     playwright(real Chrome)
    Steps:    Run `corepack pnpm --dir web exec playwright test e2e/admin-category-recommendations.spec.ts --project=chrome --grep "12 category runs" --reporter=line`.
    Expected: Exit code 0; mocked board returns 12 runs; UI exposes 12 selectable category entries; screenshot saved.
    Evidence: .omo/evidence/task-7-visible-runs.png

  Scenario: completed category recommendation loads
    Tool:     playwright(real Chrome)
    Steps:    Run `corepack pnpm --dir web exec playwright test e2e/admin-category-recommendations.spec.ts --project=chrome --grep "completed recommendation" --reporter=line`.
    Expected: Exit code 0; clicking category `패션의류 > 여성의류 > 원피스` renders its recommendation card and not another category's card.
    Evidence: .omo/evidence/task-7-category-recommendation.png
  ```

  Commit: YES | Message: `feat(web): keep category recommendations accessible` | Files: [`web/app/sourcing/admin/page.tsx`, `web/app/sourcing/admin/admin.module.css`, `web/e2e/admin-category-recommendations.spec.ts`]

- [ ] 8. Update commands/docs and run package-level verification

  What to do: Update README/context notes with the new Start behavior, exact verification commands, and the fact that auto-cycle still creates one run per category. Then run the full local verification set and collect evidence.
  Must NOT do: Do not claim Cloudflare deployment is complete unless deployment command is actually run successfully with authenticated credentials. Do not rebuild EXE artifacts unless the caller explicitly asks for packaged output.

  Parallelization: Can parallel: NO | Wave 2 | Blocks: [F1-F4] | Blocked by: [6, 7]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `README.md:34-45` - local execution section and admin URL.
  - Pattern:  `README.md:83-92` - API base URL setup section.
  - Pattern:  `README.md:94-99` - existing Cloudflare docs links.
  - Pattern:  `NAVER_TREND_MAKER_CONTEXT.md:36-48` - source file map.
  - Pattern:  `NAVER_TREND_MAKER_CONTEXT.md:86-116` - existing Windows command style.
  - Pattern:  `NAVER_TREND_MAKER_CONTEXT.md:136-142` - current pre-edit checklist.
  - External: `https://developers.cloudflare.com/workers/wrangler/configuration/` - keep Wrangler config references accurate.

  Acceptance criteria (agent-executable only):
  - [ ] `corepack pnpm --filter @runacademy/shared build` exits 0.
  - [ ] `corepack pnpm --dir web typecheck` exits 0.
  - [ ] `corepack pnpm --dir web build` exits 0.
  - [ ] `python -m unittest discover -s tests -p "test_*.py"` exits 0.
  - [ ] `corepack pnpm wrangler deploy --dry-run --config edge-api/wrangler.jsonc` exits 0.
  - [ ] `corepack pnpm --dir web exec playwright test --project=chrome --reporter=line` exits 0.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: full verification passes
    Tool:     PowerShell
    Steps:    Run each acceptance command from PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> and write stdout/stderr to `.omo/evidence/task-8-full-verification.txt`.
    Expected: Every command exits 0; evidence file contains no `FAIL`, `Error:`, or TypeScript build failure.
    Evidence: .omo/evidence/task-8-full-verification.txt

  Scenario: docs include exact behavior
    Tool:     PowerShell
    Steps:    Run `Select-String -Path README.md,NAVER_TREND_MAKER_CONTEXT.md -Pattern "카테고리 자동 순회","카테고리 1개당 run 1개","/trends/collect"` and save output.
    Expected: Output contains all three phrases with file/line matches.
    Evidence: .omo/evidence/task-8-docs-check.txt
  ```

  Commit: YES | Message: `docs(trends): document category auto-cycle workflow` | Files: [`README.md`, `NAVER_TREND_MAKER_CONTEXT.md`, `.omo/evidence/**`]

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
- Reference the plan file path in the final commit footer: `Plan: .omo/plans/naver-trend-auto-category-cycle.md`.

## Success criteria
- All Must-Have shipped; all QA scenarios pass with captured evidence; F1-F4 approved; commit history clean.
