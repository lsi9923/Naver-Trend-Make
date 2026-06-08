# Naver Auto Category Browser Loop Validation Plan

## TL;DR
> Summary:      Validate the already-implemented browser-bound auto category loop for `naver-trend-maker-10`: shared helper contracts, web production build, and real browser QA for happy path, stop/pagehide, brand-off, and single-start guardrails.
> Deliverables:
> - Automated helper-test and web-build evidence
> - Browser QA evidence for sequential auto start, stop/cancel, pagehide, brand-off payload, and single-start behavior
> - Final reviewer approval before declaring the feature complete
> Effort:       Short
> Risk:         Medium - browser QA needs a deterministic mock API because real Naver/Cloudflare collection must not be used.

## Scope
### Must have
- Verify `shared/src/trends.ts` helper behavior for settings snapshot, leaf queue flattening, sequential collection, stop, and active-run cancel.
- Verify `web/app/sourcing/admin/page.tsx` builds successfully after the `자동 시작` / `자동 종료` UI and loop controller changes.
- Verify in a real browser that `자동 시작` sends one `/trends/collect` request per leaf category, in order, and waits for each mocked run to settle before starting the next.
- Verify `자동 종료` cancels the active run when present, prevents future category starts, and surfaces a stopped state.
- Verify page `pagehide` sends a best-effort cancel request with `keepalive: true` for an active run.
- Verify brand-off mode sends `customExcludedTerms: []`, even when hidden brand terms exist.
- Verify existing `분석 시작` remains a single-category flow and is disabled while auto collection is active.
- Save every command/browser result under `.omo/evidence/`.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do not implement new product behavior in this validation pass.
- Do not add a backend batch endpoint or parallel `/trends/collect` fanout.
- Do not run real Naver collection, real Cloudflare Worker collection, or any deployed Worker during browser QA.
- Do not edit generated output folders, EXE artifacts, `node_modules`, `.next`, `build/`, `dist/`, or browser profile data.
- Do not declare completion until F1-F4 all approve and evidence files exist.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + `node:test`, Next.js build, and browser QA with real Chrome or Browser/agent-browser fallback
- QA policy: every task has agent-executed scenarios
- Evidence: `.omo/evidence/task-<N>-<slug>.<ext>`

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.

Wave 1 (no dependencies):
- Task 1: Run automated helper regression tests
- Task 2: Run web build/typecheck verification
- Task 3: Prepare deterministic browser QA harness

Wave 2 (after Wave 1):
- Task 4: depends [2, 3]
- Task 5: depends [1, 2, 3]
- Task 6: depends [1, 2, 3]

Critical path: Task 3 -> Task 4 -> F3

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1    | none       | 5, 6   | 2, 3                 |
| 2    | none       | 4, 5, 6| 1, 3                 |
| 3    | none       | 4, 5, 6| 1, 2                 |
| 4    | 2, 3       | F3     | 5, 6                 |
| 5    | 1, 2, 3    | F3     | 4, 6                 |
| 6    | 1, 2, 3    | F3     | 4, 5                 |

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. Run automated helper regression tests

  What to do: Build the shared package, then run the existing Node tests that cover auto queue flattening, settings snapshot normalization, sequential requests, stop behavior, brand-off payloads, and single-start payload preservation. Capture stdout/stderr as evidence.
  Must NOT do: Do not change test expectations or source code in this validation task.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [5, 6] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `shared/src/trends.ts:386` - settings snapshot clears/normalizes brand excluded terms by mode.
  - Pattern:  `shared/src/trends.ts:403` - category payload builder keeps one category per `TrendProfileInput`.
  - Pattern:  `shared/src/trends.ts:424` - queue builder expands a selected category to leaf categories in stable order.
  - Pattern:  `shared/src/trends.ts:457` - queue runner calls `collect` sequentially and checks `shouldStop`.
  - Pattern:  `shared/src/trends.ts:536` - stop helper requests active-run cancellation only when a run id exists.
  - Test:     `web/tests/admin-auto-collection.test.mjs:52` - leaf queue and sequential payload contract.
  - Test:     `web/tests/admin-auto-collection.test.mjs:111` - active-run stop/cancel contract.
  - Test:     `web/tests/admin-auto-collection.test.mjs:143` - brand-off hidden-term cleanup.
  - Test:     `web/tests/admin-auto-collection.test.mjs:159` - single-start payload remains one category.
  - Test:     `shared/tests/trend-brand-settings.test.mjs:9` - brand setting normalization contract.

  Acceptance criteria (agent-executable only):
  - [ ] From `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>`, `corepack pnpm --filter @runacademy/shared build *> .omo/evidence/task-1-shared-build.txt` exits 0.
  - [ ] `node --test web/tests/admin-auto-collection.test.mjs shared/tests/trend-brand-settings.test.mjs *> .omo/evidence/task-1-auto-tests.txt` exits 0.
  - [ ] `.omo/evidence/task-1-auto-tests.txt` includes the test names `auto-start-queues-leaf-categories`, `auto-stop-cancels-active-run`, `auto-collection-keeps-brand-terms-empty-when-off`, and `single-start-unchanged`.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: helper tests pass
    Tool:     PowerShell
    Steps:    Run `New-Item -ItemType Directory -Force .omo\evidence | Out-Null`, then `corepack pnpm --filter @runacademy/shared build *> .omo/evidence/task-1-shared-build.txt`, then `node --test web/tests/admin-auto-collection.test.mjs shared/tests/trend-brand-settings.test.mjs *> .omo/evidence/task-1-auto-tests.txt`.
    Expected: Both commands exit 0; the test evidence has no `fail` entry.
    Evidence: .omo/evidence/task-1-auto-tests.txt

  Scenario: stop-only regression stays green
    Tool:     PowerShell
    Steps:    Run `node --test web/tests/admin-auto-collection.test.mjs --test-name-pattern "auto-stop-cancels-active-run" *> .omo/evidence/task-1-stop-only.txt`.
    Expected: Exit code 0; evidence includes `auto-stop-cancels-active-run`.
    Evidence: .omo/evidence/task-1-stop-only.txt
  ```

  Commit: NO | Message: `test(trends): verify auto category helper contracts` | Files: []

- [ ] 2. Run web build/typecheck verification

  What to do: Run the production web build path for the Next app and capture the output. This validates the admin page, CSS module, shared imports, and route compilation together.
  Must NOT do: Do not patch build errors inside this validation task; if a build fails, capture the failure and hand it to an implementer.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [4, 5, 6] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `package.json:7` - root `dev` script exists but is not the validation target.
  - Pattern:  `package.json:8` - root build script runs package builds.
  - Pattern:  `web/package.json:7` - web production build command is `next build`.
  - Pattern:  `web/package.json:10` - web typecheck currently maps to `next build`.
  - Pattern:  `web/app/sourcing/admin/page.tsx:145` - auto state type must compile.
  - Pattern:  `web/app/sourcing/admin/page.tsx:552` - auto start controller must compile.
  - Pattern:  `web/app/sourcing/admin/page.tsx:694` - auto stop controller must compile.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1278` - auto panel JSX must compile.
  - Pattern:  `web/app/sourcing/admin/admin.module.css:562` - auto panel CSS module class must resolve.
  - External: `https://en.nextjs.im/docs/app/api-reference/cli/next/` - Next CLI docs state `build` creates the optimized production build and `start` requires a prior build.

  Acceptance criteria (agent-executable only):
  - [ ] `corepack pnpm --filter @runacademy/web build *> .omo/evidence/task-2-web-build.txt` exits 0.
  - [ ] `.omo/evidence/task-2-web-build.txt` contains Next.js build completion output and no TypeScript/CSS-module error.
  - [ ] If `corepack pnpm --filter @runacademy/web typecheck *> .omo/evidence/task-2-web-typecheck.txt` is run, it also exits 0 or is documented as duplicate of `next build`.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: production web build passes
    Tool:     PowerShell
    Steps:    Run `corepack pnpm --filter @runacademy/web build *> .omo/evidence/task-2-web-build.txt`.
    Expected: Exit code 0; evidence shows a successful Next production build.
    Evidence: .omo/evidence/task-2-web-build.txt

  Scenario: typecheck/build duplicate is understood
    Tool:     PowerShell
    Steps:    Run `corepack pnpm --filter @runacademy/web typecheck *> .omo/evidence/task-2-web-typecheck.txt`.
    Expected: Exit code 0; if output is equivalent to `next build`, note that in `.omo/evidence/task-2-web-typecheck-note.txt`.
    Evidence: .omo/evidence/task-2-web-typecheck.txt
  ```

  Commit: NO | Message: `build(web): verify admin auto loop build` | Files: []

- [ ] 3. Prepare deterministic browser QA harness

  What to do: Start a local mock Trend API and a local Next web server for browser QA only. The mock API must implement `/v1/trends/admin/board`, `/v1/trends/categories/:cid`, `/v1/trends/collect`, `/v1/trends/runs/:id`, and `/v1/trends/runs/:id/cancel`, record every request to `.omo/evidence/task-3-mock-api-requests.json`, and never proxy to external services. Configure the browser by setting localStorage key `hanirum:naver-trend-api-base-url` to `http://127.0.0.1:4010/v1` before loading `/sourcing/admin`.
  Must NOT do: Do not use a real Cloudflare Worker URL, real Naver URL, or production credentials.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [4, 5, 6] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `web/app/sourcing/admin/page.tsx:63` - environment API base is normalized into `/v1`.
  - Pattern:  `web/app/sourcing/admin/page.tsx:64` - browser storage key is `hanirum:naver-trend-api-base-url`.
  - Pattern:  `web/app/sourcing/admin/page.tsx:247` - stored API base URL is read when no environment URL is configured.
  - Pattern:  `web/app/sourcing/admin/page.tsx:340` - pagehide cancel posts to `/trends/runs/{id}/cancel`.
  - Pattern:  `web/app/sourcing/admin/page.tsx:590` - category children endpoint is used to build the auto queue.
  - Pattern:  `web/app/sourcing/admin/page.tsx:630` - auto loop starts each category through `/trends/collect`.
  - Pattern:  `web/app/sourcing/admin/page.tsx:654` - auto loop polls `/trends/runs/{id}` until the run settles.
  - Pattern:  `web/app/sourcing/admin/page.tsx:3135` - all API paths are appended to the configured base URL.
  - External: `https://playwright.dev/docs/locators` - use role/text/test-id locators for stable browser actions and evidence.

  Acceptance criteria (agent-executable only):
  - [ ] Mock API is reachable at `http://127.0.0.1:4010/v1/trends/admin/board` and returns JSON with `ok:true`.
  - [ ] Next web server is reachable at `http://127.0.0.1:3000/sourcing/admin`.
  - [ ] `.omo/evidence/task-3-mock-api-requests.json` is created and remains limited to localhost/mock route requests.
  - [ ] `.omo/evidence/task-3-browser-ready.png` exists and shows `자동 카테고리 순회`, `자동 시작`, and `자동 종료`.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: local mock API starts
    Tool:     PowerShell
    Steps:    Create a temporary mock server under `.omo/evidence/task-3-mock-api.mjs`, then run `Start-Process -FilePath node -ArgumentList '.omo/evidence/task-3-mock-api.mjs' -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id | Set-Content .omo/evidence/task-3-mock-api.pid`; then run `curl.exe http://127.0.0.1:4010/v1/trends/admin/board > .omo/evidence/task-3-mock-api-health.json`.
    Expected: Health JSON contains `"ok":true`; request log contains only localhost mock traffic.
    Evidence: .omo/evidence/task-3-mock-api-health.json

  Scenario: admin page opens with mock API configured
    Tool:     playwright(real Chrome)
    Steps:    Start the web app with `Start-Process -FilePath corepack -ArgumentList 'pnpm --dir web dev' -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id | Set-Content .omo/evidence/task-3-web-server.pid`; open `http://127.0.0.1:3000/sourcing/admin`; before reload, set localStorage `hanirum:naver-trend-api-base-url=http://127.0.0.1:4010/v1`; capture screenshot to `.omo/evidence/task-3-browser-ready.png`.
    Expected: Screenshot shows the admin page and auto collection controls; no external API request appears in the mock/request logs.
    Evidence: .omo/evidence/task-3-browser-ready.png
  ```

  Commit: NO | Message: `test(web): prepare auto loop browser qa harness` | Files: []

- [ ] 4. Browser QA happy path: sequential auto category loop

  What to do: Use the Task 3 mock API and real browser to select a root category, click `자동 시작`, and verify three fixture leaf categories are collected in stable order. The mock must keep each run `running` until explicitly polled at least once, so request timestamps prove no next `/trends/collect` begins before the previous run settles.
  Must NOT do: Do not accept visual completion alone; request log order and timestamps are required.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [F3] | Blocked by: [2, 3]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `shared/src/trends.ts:424` - queue builder should flatten root to leaf nodes.
  - Pattern:  `shared/src/trends.ts:457` - runner should process queue sequentially.
  - Pattern:  `web/app/sourcing/admin/page.tsx:552` - auto start handler validates selected category and snapshots settings.
  - Pattern:  `web/app/sourcing/admin/page.tsx:590` - selected category children are loaded for queue creation.
  - Pattern:  `web/app/sourcing/admin/page.tsx:616` - page invokes shared sequential runner.
  - Pattern:  `web/app/sourcing/admin/page.tsx:630` - each category starts through `startTrendCollectionRequest`.
  - Pattern:  `web/app/sourcing/admin/page.tsx:653` - each run waits through `waitForTrendRunToSettle`.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1278` - auto panel displays progress.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1295` - progressbar exposes handled/total values.
  - External: `https://playwright.dev/docs/locators` - role/test-id locators should drive the browser.
  - External: `https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/progressbar_role` - `progressbar` uses `aria-valuenow`/`aria-valuetext` for long-running task progress.

  Acceptance criteria (agent-executable only):
  - [ ] `.omo/evidence/task-4-auto-happy-requests.json` records collect payload category CIDs in expected fixture order, for example `[4,5,3]`.
  - [ ] Each later collect request timestamp is greater than the previous mocked run's settled timestamp.
  - [ ] Browser screenshot `.omo/evidence/task-4-auto-happy-complete.png` shows terminal completed status and processed count matching total count.
  - [ ] Progressbar assertion records `aria-valuenow` equal to total handled count at completion.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: auto start completes all fixture leaf categories sequentially
    Tool:     playwright(real Chrome)
    Steps:    Open `http://127.0.0.1:3000/sourcing/admin`, select fixture root `패션의류`, click `[data-testid="auto-collection-start"]`, wait until the status text contains `자동 카테고리 순회가 완료되었습니다.`, then save request log and screenshot.
    Expected: Three collect requests occur in fixture order; no overlap exists between collect requests; screenshot shows completed auto status.
    Evidence: .omo/evidence/task-4-auto-happy-requests.json

  Scenario: progress semantics update during auto loop
    Tool:     playwright(real Chrome)
    Steps:    During the same run, read `[data-testid="auto-collection-progress"]` after each mocked run settles and save `{aria-valuemin, aria-valuemax, aria-valuenow, aria-valuetext}` snapshots.
    Expected: `aria-valuenow` advances from `0` to total count; `aria-valuetext` includes handled/total and current category while running.
    Evidence: .omo/evidence/task-4-progress-aria.json
  ```

  Commit: NO | Message: `test(web): validate auto loop happy path` | Files: []

- [ ] 5. Browser QA stop, cancel, and pagehide behavior

  What to do: Use the Task 3 mock API and real browser to verify `자동 종료` and `pagehide`. Cover active-run cancellation, no-active-run stop, delayed collect response, cancel API failure, and pagehide keepalive. The hard invariant is that no next category starts after a stop request.
  Must NOT do: Do not require instant abort of mocked backend work; cancellation is cooperative and the UI must still block the next category.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [F3] | Blocked by: [1, 2, 3]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `web/app/sourcing/admin/page.tsx:208` - local stop ref tracks stop requests.
  - Pattern:  `web/app/sourcing/admin/page.tsx:209` - active run ref tracks the run to cancel.
  - Pattern:  `web/app/sourcing/admin/page.tsx:331` - pagehide handler sets stop and best-effort cancels active run.
  - Pattern:  `web/app/sourcing/admin/page.tsx:340` - pagehide cancel uses `fetch` with `keepalive: true`.
  - Pattern:  `web/app/sourcing/admin/page.tsx:694` - stop button handler sets stopping state.
  - Pattern:  `web/app/sourcing/admin/page.tsx:702` - stop handler calls `stopTrendAutoCollectionRun`.
  - Pattern:  `shared/src/trends.ts:482` - queue runner checks `shouldStop` before starting the next category.
  - Pattern:  `edge-api/src/index.ts:163` - cancel route exists at `/v1/trends/runs/{id}/cancel`.
  - Pattern:  `edge-api/src/index.ts:716` - cancel returns not-found or current run details depending on state.
  - External: `https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event` - `pagehide` fires when a page is hidden during navigation/session-history changes.
  - External: `https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event` - MDN notes unload-style events are best-effort, so validation should assert the attempted keepalive request, not instant backend abort.

  Acceptance criteria (agent-executable only):
  - [ ] Stop while a run is active records exactly one `/cancel` request for that run id.
  - [ ] Stop before an active run exists records no cancel request and still prevents any later category collect.
  - [ ] Stop while the collect response is delayed cancels the returned run id before any next category starts.
  - [ ] Cancel API failure is visible as an error/status evidence and does not resume the loop.
  - [ ] Pagehide evidence records a browser-side fetch call with `method:"POST"` and `keepalive:true`.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: stop cancels active run and blocks next category
    Tool:     playwright(real Chrome)
    Steps:    Open `http://127.0.0.1:3000/sourcing/admin`, start auto collection, wait until the first run is active, click `[data-testid="auto-collection-stop"]`, then save request log and screenshot.
    Expected: One cancel request is sent for the first run; no second category collect request is sent; UI status is stopped or stopping with Korean stop copy.
    Evidence: .omo/evidence/task-5-stop-active-run.json

  Scenario: pagehide sends keepalive cancel
    Tool:     playwright(real Chrome)
    Steps:    Start auto collection, wait until an active run id exists, inject a fetch spy if needed, run `window.dispatchEvent(new PageTransitionEvent("pagehide"))`, then save the browser-side fetch/cancel log.
    Expected: The recorded cancel request uses POST and `keepalive:true`; no later category collect starts.
    Evidence: .omo/evidence/task-5-pagehide-keepalive.json
  ```

  Commit: NO | Message: `test(web): validate auto loop stop behavior` | Files: []

- [ ] 6. Browser QA brand-off and single-start guardrails

  What to do: Use the Task 3 mock API and real browser to verify hidden brand terms do not leak when brand exclusion is off, and that `분석 시작` still sends exactly one `/trends/collect` request for the selected category. Also verify `분석 시작` and `자동 시작` are disabled while auto collection is active.
  Must NOT do: Do not conflate `분석 시작` with the auto loop or reuse auto progress state for single start.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [F3] | Blocked by: [1, 2, 3]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `shared/src/trends.ts:386` - snapshot clears excluded terms when brand exclusion is disabled.
  - Pattern:  `shared/src/trends.ts:403` - payload builder copies normalized snapshot values.
  - Pattern:  `web/app/sourcing/admin/page.tsx:472` - single `분석 시작` handler starts one selected category.
  - Pattern:  `web/app/sourcing/admin/page.tsx:495` - single start posts to `/trends/collect`.
  - Pattern:  `web/app/sourcing/admin/page.tsx:552` - auto start handler snapshots form settings.
  - Pattern:  `web/app/sourcing/admin/page.tsx:564` - auto settings snapshot is created from current form.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1351` - single start is disabled while auto collection is active.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1374` - auto start is disabled while active.
  - Test:     `web/tests/admin-auto-collection.test.mjs:143` - unit-level brand-off payload contract.
  - Test:     `web/tests/admin-auto-collection.test.mjs:159` - unit-level single-start payload contract.
  - External: `https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-pressed` - only verify `aria-pressed` on true toggle buttons; normal action buttons can use disabled state and stable labels.
  - External: `https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role` - status role should be advisory live output and should not steal focus.

  Acceptance criteria (agent-executable only):
  - [ ] Brand-off auto payload evidence shows `excludeBrandProducts:false` and `customExcludedTerms:[]`.
  - [ ] Brand-on auto payload evidence shows normalized/deduped terms if the UI enables brand exclusion.
  - [ ] Single-start evidence records exactly one `/trends/collect` payload and no auto status transition to running.
  - [ ] While auto collection is active, `분석 시작` and `자동 시작` are disabled, and `자동 종료` is enabled.
  - [ ] Browser focus/status evidence shows `role="status"` content updates without moving focus from the active control unexpectedly.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: brand-off terms do not leak into auto payload
    Tool:     playwright(real Chrome)
    Steps:    Enter brand terms, turn brand exclusion off, start auto collection, save collect payloads from the mock request log.
    Expected: Every auto payload has `excludeBrandProducts:false` and `customExcludedTerms:[]`.
    Evidence: .omo/evidence/task-6-brand-off-payloads.json

  Scenario: single start remains one selected category
    Tool:     playwright(real Chrome)
    Steps:    Reload the page, select fixture category `패션의류 > 남성의류`, click the visible `분석 시작` button, then save collect request log and screenshot.
    Expected: Exactly one collect request is sent for the selected category; no auto queue/progress run begins.
    Evidence: .omo/evidence/task-6-single-start.json
  ```

  Commit: NO | Message: `test(web): validate brand and single-start guardrails` | Files: []

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
- Reference the plan file path in the final commit footer: `Plan: .omo/plans/naver-auto-category-browser-loop.md`.

## Success criteria
- All Must-Have shipped; all QA scenarios pass with captured evidence; F1-F4 approved; commit history clean.
