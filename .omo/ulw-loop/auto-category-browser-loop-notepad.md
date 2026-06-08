# Auto Category Browser Loop Notepad

## Goal
- Deliverable: add browser-bound auto category collection with `자동 시작` / `자동 종료`.
- Behavior: selected category subtree is expanded into leaf categories, current form settings are snapshotted at start, `/trends/collect` is called sequentially, browser close stops future starts, stop button cancels the active run and prevents next category.

## Bootstrap
- First visible line sent: `ULTRAWORK MODE ENABLED!`
- Local skills enumerated: 325 `SKILL.md` files.
- Relevant skills used:
  - `omo:ulw-plan`: non-trivial multi-file feature requires decision-complete plan.
  - `omo:ulw-loop`: evidence-bound RED/GREEN plus manual browser QA.
  - `omo:init-deep`: project knowledge and AGENTS scope awareness; no AGENTS generation needed.
  - `omo:debugging`: browser-served Node/Next feature; read Node, Playwright, setup, fix, QA, cleanup references.
  - `omo:review-work`: user requested review after fix; final gate needs reviewer.
  - `frontend-skill`: UI buttons/state panel added to operational app screen.
  - `browser:control-in-app-browser`: local browser QA target.
- OMO ulw-loop CLI status: unavailable from PATH in this session, so this notepad plus Codex goal/evidence files are the durable audit path.

## Success Criteria
- C1 happy path: auto start queues 2+ leaf categories sequentially and uses one settings snapshot.
  - Automated test: `web/tests/admin-auto-collection.test.mjs::auto-start-queues-leaf-categories`.
  - Browser QA: `/sourcing/admin.html` with mock API, PASS if collect request order is sequential and UI shows progress.
- C2 stop path: auto stop prevents next start and cancels active run.
  - Automated test: `web/tests/admin-auto-collection.test.mjs::auto-stop-cancels-active-run`.
  - Browser QA: mock active run, PASS if `/cancel` called and UI status is stopped.
- C3 brand edge: auto loop never sends hidden excluded terms when brand exclusion is off.
  - Automated test: `web/tests/admin-auto-collection.test.mjs::auto-collection-keeps-brand-terms-empty-when-off` plus existing shared brand test.
  - Browser QA: payload has `excludeBrandProducts:false` and `customExcludedTerms:[]`.
- C4 single-start regression: existing `분석 시작` remains a single selected-category flow.
  - Automated test: `web/tests/admin-auto-collection.test.mjs::single-start-unchanged`.
  - Browser QA: single start posts exactly one collect and no automation state starts.

## Initial Findings
- Existing `handleStartAnalysis` starts one `selectedCategory` only.
- Edge API starts each run through `ctx.waitUntil(processQueuedRunBatch(env, { runId }))`; front-end automation must avoid parallel `/collect` fanout.
- Existing cancel API can stop queued/running tasks for the current active run.
- Existing trend surface collects keyword rank snapshots, not product detail listings.

## Artifacts
- Evidence directory: `.omo/ulw-loop/evidence/`
- Plan file: pending plan agent.

## Final Verification
- Plan file: `.omo/plans/naver-auto-category-browser-loop.md`.
- Shared build: `corepack pnpm --filter @runacademy/shared build` passed; evidence `.omo/ulw-loop/evidence/auto-category-final-shared-build.txt`.
- Node tests: `node --test web/tests/admin-auto-collection.test.mjs shared/tests/trend-brand-settings.test.mjs` passed, 7/7; evidence `.omo/ulw-loop/evidence/auto-category-final-node-tests.txt`.
- Web build: `corepack pnpm --filter @runacademy/web build` passed; evidence `.omo/ulw-loop/evidence/auto-category-final-web-build.txt`.
- Worker dry-run: `corepack pnpm wrangler deploy --dry-run --config edge-api/wrangler.jsonc` passed; evidence `.omo/ulw-loop/evidence/auto-category-final-wrangler-dry-run.txt`.
- Browser QA evidence: `.omo/ulw-loop/evidence/auto-category-browser-qa.json` and `.omo/ulw-loop/evidence/auto-category-browser-qa.png`.
- Browser QA covered happy auto loop, stop/cancel, brand terms OFF payload, and existing single-start behavior.
- Browser close watchdog evidence: `.omo/ulw-loop/evidence/auto-category-playwright-close-qa.json` and `.omo/ulw-loop/evidence/auto-category-final-playwright-close.txt`.
- Close handling uses best-effort lifecycle cancel plus 5s heartbeat / 20s Worker watchdog stale cancellation, so a closed browser stops the active automated run even when close events are not delivered.
- Pending-stop evidence: `.omo/ulw-loop/evidence/auto-category-playwright-pending-stop-qa.json` and `.omo/ulw-loop/evidence/auto-category-final-pending-stop.txt`; stop clicked while `/collect` is pending cancels the returned run and starts no next category.
