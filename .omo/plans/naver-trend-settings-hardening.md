# Naver Trend Settings Hardening

## TL;DR
> Summary:      Harden the Naver Trend Maker 10 admin settings path before auto-category cycling by locking the frontend payload, backend normalization, setting-pill display, and browser mock-API flow with RED/GREEN evidence.
> Deliverables:
> - Shared excluded-term regression tests and script wiring
> - Web settings helper extraction with payload and pill tests
> - Edge API normalization helper extraction with backend tests
> - Playwright browser QA using a fully mocked API
> - Evidence receipts under `.omo/evidence/`
> Effort:       Medium
> Risk:         Medium - current worktree is already dirty and web/edge test harnesses are incomplete.

## Scope
### Must have
- Preserve the current dirty worktree. Start and end with `git status --short` receipts.
- Keep the reviewed behavior: when `excludeBrandProducts` is `false`, `customExcludedTerms` must be `[]` in frontend POST bodies and backend normalized input.
- Keep the reviewed behavior: when the brand-exclusion checkbox is turned off, the custom excluded-term input value must be cleared.
- Keep setting pills truthful: disabled mode shows `원본 키워드` and does not show `제외어 ...`; enabled mode shows `브랜드 제외` and normalized excluded terms.
- Add test-first evidence: every implementation task must capture a failing RED receipt before the production fix and a passing GREEN receipt after the fix.
- Use `.omo/evidence/` as the canonical evidence folder.
- Browser QA must run without Cloudflare credentials, Naver live requests, or D1 by mocking all required API routes.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do not implement auto-category cycling.
- Do not touch or restore generated artifacts: `*.exe`, `desktop-artifacts/`, `build_*`, `dist/`, `__pycache__/`, `node_modules/`, `web/.next`, `web/.next-prod`, `edge-api/.wrangler`.
- Do not call live Naver, live Cloudflare, or remote D1 in tests or QA.
- Do not rewrite the admin page design or unrelated sourcing behavior.
- Do not revert user changes in modified files; adapt to the current content.
- Do not move evidence into `.omo/ulw-loop/evidence`; use `.omo/evidence/`.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD + existing `node:test` for shared, Vitest for web/edge pure contracts, Playwright for browser QA.
- QA policy: every task has agent-executed scenarios
- Evidence: `.omo/evidence/task-<N>-<slug>.<ext>`

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.

Wave 1 (no dependencies):
- Task 1: Shared excluded-term contract and dirty-tree receipts
- Task 2: Frontend payload helper and tests
- Task 4: Backend normalization helper and tests

Wave 2 (after Wave 1):
- Task 3: depends [2]
- Task 5: depends [1, 2, 4]

Wave 3 (after Wave 2):
- Task 6: depends [2, 3, 5]

Critical path: Task 2 -> Task 3 -> Task 6

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1    | none       | 5      | 2, 4                 |
| 2    | none       | 3, 5, 6| 1, 4                 |
| 3    | 2          | 6      | 5                    |
| 4    | none       | 5      | 1, 2                 |
| 5    | 1, 2, 4    | 6      | 3                    |
| 6    | 2, 3, 5    | final  | none                 |

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. Shared excluded-term contract and dirty-tree receipts

  What to do: Capture initial dirty-tree status, add a shared package test script, and strengthen the existing `node:test` coverage for excluded-term splitting/normalization. First add a failing assertion that proves disabled brand exclusion must clear non-empty custom terms; capture RED. Then update only shared settings helpers if needed and capture GREEN.
  Must NOT do: Do not edit web, edge, generated artifacts, or any `.exe` deletion state in this task.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [5] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `shared/tests/trend-brand-settings.test.mjs:1` - existing `node:test` + `assert` test style.
  - API/Type: `shared/src/trends.ts:21` - `TrendProfileInput` carries `excludeBrandProducts` and `customExcludedTerms`.
  - API/Type: `shared/src/trends.ts:320` - `normalizeExcludedTerms` trims, filters, lowercases, dedupes, and sorts.
  - API/Type: `shared/src/trends.ts:331` - `splitTrendExcludedTermsInput` parses comma input.
  - API/Type: `shared/src/trends.ts:338` - `normalizeTrendExcludedTermsForMode` must return `[]` when disabled.
  - Test:     `shared/package.json:8` - package has scripts but no `test` script yet.
  - External: `https://nodejs.org/api/test.html` - official Node test runner reference.

  Acceptance criteria (agent-executable only):
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> git status --short | Tee-Object .omo/evidence/task-1-git-status-before.txt` captures the dirty tree.
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> corepack pnpm --filter @runacademy/shared build` exits `0`.
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> corepack pnpm --filter @runacademy/shared test` exits `0`.
  - [ ] `.omo/evidence/task-1-shared-red.txt` exists and shows the intentionally added shared regression test failing before the fix.
  - [ ] `.omo/evidence/task-1-shared-green.txt` exists and shows the shared regression suite passing after the fix.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: shared disabled mode clears custom terms
    Tool:     bash via PowerShell
    Steps:    corepack pnpm --filter @runacademy/shared build *> .omo/evidence/task-1-shared-build.txt; corepack pnpm --filter @runacademy/shared test *> .omo/evidence/task-1-shared-green.txt
    Expected: task-1-shared-green.txt includes passing tests for disabled mode returning [] and enabled mode returning ["adidas","nike"] from duplicate mixed-case input.
    Evidence: .omo/evidence/task-1-shared-green.txt

  Scenario: shared parser ignores empty comma tokens
    Tool:     bash via PowerShell
    Steps:    corepack pnpm --filter @runacademy/shared test -- --test-name-pattern "comma input" *> .omo/evidence/task-1-shared-comma.txt
    Expected: task-1-shared-comma.txt shows the comma input test passed and no empty string token is returned.
    Evidence: .omo/evidence/task-1-shared-comma.txt
  ```

  Commit: YES | Message: `test(shared): lock brand exclusion term normalization` | Files: [`shared/package.json`, `shared/tests/trend-brand-settings.test.mjs`, `shared/src/trends.ts` if needed]

- [ ] 2. Frontend payload helper and tests

  What to do: Extract the admin settings payload construction into a pure web helper, then make `page.tsx` use it. First add a failing Vitest test proving that disabled brand exclusion posts `customExcludedTerms: []` even if stale custom text exists; capture RED. Then implement the helper and wire `handleStartAnalysis` to it.
  Must NOT do: Do not alter visible layout, category behavior, or backend code in this task.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [3, 5, 6] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `web/app/sourcing/admin/page.tsx:100` - current `TrendFormState` fields.
  - Pattern:  `web/app/sourcing/admin/page.tsx:433` - current `/trends/collect` POST body.
  - Pattern:  `web/app/sourcing/admin/page.tsx:447` - current use of `normalizeTrendExcludedTermsForMode`.
  - Pattern:  `web/app/sourcing/admin/page.tsx:995` - checkbox state handling clears `customExcludedTerms` when unchecked.
  - API/Type: `web/app/sourcing/admin/page.tsx:34` - imports shared excluded-term helpers.
  - API/Type: `shared/src/trends.ts:338` - source of disabled-mode `[]` behavior.
  - External: `https://github.com/vitest-dev/vitest/blob/main/docs/guide/learn/writing-tests.md` - Vitest TypeScript test files.
  - External: `https://github.com/vitest-dev/vitest/blob/main/docs/guide/features.md` - Vitest environments for browser-like APIs if needed.

  Acceptance criteria (agent-executable only):
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> corepack pnpm --filter @runacademy/web test -- settings-contract` exits non-zero before implementation and output is saved to `.omo/evidence/task-2-web-payload-red.txt`.
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> corepack pnpm --filter @runacademy/web test -- settings-contract` exits `0` after implementation and output is saved to `.omo/evidence/task-2-web-payload-green.txt`.
  - [ ] The test asserts the POST payload contains `excludeBrandProducts: false` and `customExcludedTerms: []` for stale input `"nike, adidas"`.
  - [ ] The test asserts enabled mode normalizes/dedupes custom terms.
  - [ ] `web/app/sourcing/admin/page.tsx` still posts to `/trends/collect`.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: frontend disabled payload
    Tool:     bash via PowerShell
    Steps:    corepack pnpm --filter @runacademy/web test -- settings-contract --runInBand *> .omo/evidence/task-2-web-payload-green.txt
    Expected: output shows a passing assertion that disabled brand exclusion sends customExcludedTerms: [].
    Evidence: .omo/evidence/task-2-web-payload-green.txt

  Scenario: frontend enabled payload normalizes duplicate terms
    Tool:     bash via PowerShell
    Steps:    corepack pnpm --filter @runacademy/web test -- settings-contract --runInBand *> .omo/evidence/task-2-web-payload-enabled.txt
    Expected: output shows a passing assertion that "Nike, adidas, Nike" becomes ["adidas","nike"].
    Evidence: .omo/evidence/task-2-web-payload-enabled.txt
  ```

  Commit: YES | Message: `test(web): lock trend settings collect payload` | Files: [`web/package.json`, `web/vitest.config.ts` if added, `web/app/sourcing/admin/settings-contract.ts`, `web/app/sourcing/admin/settings-contract.test.ts`, `web/app/sourcing/admin/page.tsx`, `pnpm-lock.yaml`]

- [ ] 3. Setting-pill display contract

  What to do: Move `formatProfileSettingPills` and `formatFormSettingPills` into the same pure helper module from Task 2 or a sibling helper, then test the exact visible labels for disabled/enabled settings. First add failing tests for pill text before exporting/wiring helpers; capture RED. Then wire `page.tsx` to the tested helper functions.
  Must NOT do: Do not change CSS, pill styling, or unrelated analysis card labels.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [6] | Blocked by: [2]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `web/app/sourcing/admin/page.tsx:1210` - progress panel renders setting pills from form/profile.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1351` - analysis panel shows brand setting summary.
  - Pattern:  `web/app/sourcing/admin/page.tsx:2333` - profile pill helper includes `원본 키워드` or `브랜드 제외`.
  - Pattern:  `web/app/sourcing/admin/page.tsx:2343` - profile helper only adds excluded terms when enabled and non-empty.
  - Pattern:  `web/app/sourcing/admin/page.tsx:2350` - form pill helper mirrors current form settings.
  - Pattern:  `web/app/sourcing/admin/page.tsx:2359` - form helper normalizes terms by mode.
  - Style:    `web/app/sourcing/admin/admin.module.css:61` - pill row is flex-wrapped.
  - Style:    `web/app/sourcing/admin/admin.module.css:69` - summary pill visual class.
  - External: `https://github.com/vitest-dev/vitest/blob/main/docs/guide/learn/writing-tests.md` - Vitest assertion pattern.

  Acceptance criteria (agent-executable only):
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> corepack pnpm --filter @runacademy/web test -- setting-pills` exits non-zero before implementation and output is saved to `.omo/evidence/task-3-pills-red.txt`.
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> corepack pnpm --filter @runacademy/web test -- setting-pills` exits `0` after implementation and output is saved to `.omo/evidence/task-3-pills-green.txt`.
  - [ ] Disabled form/profile tests assert labels include `원본 키워드` and do not include any label beginning with `제외어`.
  - [ ] Enabled form/profile tests assert labels include `브랜드 제외` and `제외어 adidas, nike` for duplicate mixed-case input.
  - [ ] `corepack pnpm --filter @runacademy/web typecheck` exits `0`.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: disabled pills hide excluded terms
    Tool:     bash via PowerShell
    Steps:    corepack pnpm --filter @runacademy/web test -- setting-pills --runInBand *> .omo/evidence/task-3-pills-disabled.txt
    Expected: output shows disabled form/profile pill tests passed; no excluded-term label appears.
    Evidence: .omo/evidence/task-3-pills-disabled.txt

  Scenario: enabled pills show normalized terms
    Tool:     bash via PowerShell
    Steps:    corepack pnpm --filter @runacademy/web test -- setting-pills --runInBand *> .omo/evidence/task-3-pills-enabled.txt
    Expected: output shows enabled form/profile pill tests passed and expected label is exactly "제외어 adidas, nike".
    Evidence: .omo/evidence/task-3-pills-enabled.txt
  ```

  Commit: YES | Message: `test(web): lock trend setting pill labels` | Files: [`web/app/sourcing/admin/settings-contract.ts`, `web/app/sourcing/admin/settings-contract.test.ts`, `web/app/sourcing/admin/page.tsx`]

- [ ] 4. Backend normalization helper and tests

  What to do: Extract `normalizeTrendProfileInput` from `edge-api/src/index.ts` into an exported pure helper so it can be tested without D1, Cloudflare credentials, or live Worker execution. First add a failing backend test proving disabled mode clears custom terms; capture RED. Then extract/wire the helper and capture GREEN.
  Must NOT do: Do not change route behavior, D1 schema, cron behavior, or live collection logic.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [5] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `edge-api/src/index.ts:410` - profile creation calls `normalizeTrendProfileInput`.
  - Pattern:  `edge-api/src/index.ts:442` - normalized `resultCount`, `excludeBrandProducts`, and custom terms are stored.
  - Pattern:  `edge-api/src/index.ts:498` - collection start also normalizes input.
  - Pattern:  `edge-api/src/index.ts:518` - duplicate-profile lookup includes settings dimensions.
  - Pattern:  `edge-api/src/index.ts:846` - current normalization function.
  - Pattern:  `edge-api/src/index.ts:859` - disabled mode currently returns `customExcludedTerms: []`.
  - API/Type: `shared/src/trends.ts:21` - input type to preserve.
  - Config:   `edge-api/wrangler.jsonc:4` - Worker main is `src/index.ts`.
  - Config:   `pnpm-workspace.yaml:1` - workspace currently lists only `web` and `shared`; add `edge-api` if creating an edge package.
  - External: `https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/` - Cloudflare Worker testing reference.

  Acceptance criteria (agent-executable only):
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> corepack pnpm --filter @runacademy/edge-api test -- trend-profile-input` exits non-zero before implementation and output is saved to `.omo/evidence/task-4-edge-normalize-red.txt`.
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> corepack pnpm --filter @runacademy/edge-api test -- trend-profile-input` exits `0` after implementation and output is saved to `.omo/evidence/task-4-edge-normalize-green.txt`.
  - [ ] Backend test asserts disabled mode returns `customExcludedTerms: []`.
  - [ ] Backend test asserts enabled mode lowercases, dedupes, and sorts custom terms.
  - [ ] Backend test asserts devices/genders/ages sorting and resultCount normalization still match `index.ts` behavior.
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> corepack pnpm --filter @runacademy/edge-api typecheck` exits `0`.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: backend disabled mode normalizes stale terms away
    Tool:     bash via PowerShell
    Steps:    corepack pnpm --filter @runacademy/edge-api test -- trend-profile-input *> .omo/evidence/task-4-edge-normalize-green.txt
    Expected: output shows a passing assertion where excludeBrandProducts false and ["Nike"] becomes [].
    Evidence: .omo/evidence/task-4-edge-normalize-green.txt

  Scenario: backend enabled mode preserves normalized terms
    Tool:     bash via PowerShell
    Steps:    corepack pnpm --filter @runacademy/edge-api test -- trend-profile-input *> .omo/evidence/task-4-edge-normalize-enabled.txt
    Expected: output shows a passing assertion where excludeBrandProducts true and ["Nike"," adidas ","Nike"] becomes ["adidas","nike"].
    Evidence: .omo/evidence/task-4-edge-normalize-enabled.txt
  ```

  Commit: YES | Message: `test(edge-api): lock trend profile normalization` | Files: [`pnpm-workspace.yaml`, `edge-api/package.json`, `edge-api/tsconfig.json`, `edge-api/src/trend-profile-input.ts`, `edge-api/src/index.ts`, `edge-api/tests/trend-profile-input.test.ts`, `pnpm-lock.yaml`]

- [ ] 5. Aggregate settings verification commands

  What to do: Add root-level scripts that run the shared, web, and edge settings tests together and write a cleanup/status receipt. This task must not introduce new behavior; it only gives future executors one command to prove settings are reliable.
  Must NOT do: Do not add browser QA here; Task 6 owns Playwright/browser evidence.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [6] | Blocked by: [1, 2, 4]

  References (executor has NO interview context - be exhaustive):
  - Config:   `package.json:1` - root package contains workspace scripts.
  - Config:   `package.json:6` - current root scripts are `dev`, `build`, `lint`, `typecheck`.
  - Config:   `shared/package.json:8` - shared scripts area.
  - Config:   `web/package.json:5` - web scripts area.
  - Config:   `pnpm-workspace.yaml:1` - workspace package list.
  - Test:     `shared/tests/trend-brand-settings.test.mjs:9` - shared disabled-mode regression.
  - Test:     `web/app/sourcing/admin/settings-contract.test.ts` - created by Tasks 2 and 3.
  - Test:     `edge-api/tests/trend-profile-input.test.ts` - created by Task 4.

  Acceptance criteria (agent-executable only):
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> corepack pnpm test:settings` exits `0` and output is saved to `.omo/evidence/task-5-settings-suite-green.txt`.
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> corepack pnpm typecheck` exits `0` and output is saved to `.omo/evidence/task-5-typecheck.txt`.
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> git status --short | Tee-Object .omo/evidence/task-5-git-status-after-unit.txt` captures the expected source/test/script changes and does not show newly touched generated artifacts.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: all settings unit contracts pass
    Tool:     bash via PowerShell
    Steps:    corepack pnpm test:settings *> .omo/evidence/task-5-settings-suite-green.txt
    Expected: shared, web, and edge settings contract tests all pass in one command.
    Evidence: .omo/evidence/task-5-settings-suite-green.txt

  Scenario: cleanup receipt excludes generated artifacts
    Tool:     bash via PowerShell
    Steps:    git status --short *> .omo/evidence/task-5-git-status-after-unit.txt
    Expected: receipt lists source/test/package changes only from this plan plus pre-existing dirty entries; no new `build/`, `dist/`, `.next/`, `.wrangler/`, or `.exe` modifications caused by tasks.
    Evidence: .omo/evidence/task-5-git-status-after-unit.txt
  ```

  Commit: YES | Message: `chore(test): add settings verification script` | Files: [`package.json`, package script files touched by Tasks 1, 2, 4, `pnpm-lock.yaml`]

- [ ] 6. Browser QA with mock API

  What to do: Add and run a Playwright QA scenario that opens `/sourcing/admin`, injects the API base URL into localStorage key `hanirum:naver-trend-api-base-url`, mocks all admin trend routes, drives the settings UI, captures the `/trends/collect` POST body, and screenshots the resulting setting pills. Do this for both disabled and enabled brand-exclusion modes.
  Must NOT do: Do not hit live Naver, Cloudflare, D1, or require user login. Do not use OS-level GUI automation unless Playwright cannot launch real Chrome.

  Parallelization: Can parallel: NO | Wave 3 | Blocks: [] | Blocked by: [2, 3, 5]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `README.md:34` - local web run command pattern.
  - Pattern:  `README.md:45` - admin URL is `/sourcing/admin`.
  - Pattern:  `web/app/sourcing/admin/page.tsx:55` - API storage key is `hanirum:naver-trend-api-base-url`.
  - Pattern:  `web/app/sourcing/admin/page.tsx:208` - admin page reads stored API base URL.
  - Pattern:  `web/app/sourcing/admin/page.tsx:433` - collect request path and POST body.
  - Pattern:  `web/app/sourcing/admin/page.tsx:883` - category 1 selector label.
  - Pattern:  `web/app/sourcing/admin/page.tsx:906` - category 2 selector label.
  - Pattern:  `web/app/sourcing/admin/page.tsx:929` - category 3 selector label.
  - Pattern:  `web/app/sourcing/admin/page.tsx:995` - brand-exclusion checkbox label area.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1059` - `분석 시작` button.
  - Pattern:  `web/app/sourcing/admin/page.tsx:1210` - visible setting pills.
  - External: `https://playwright.dev/docs/network` - Playwright route/mock API behavior.
  - External: `https://playwright.dev/docs/screenshots` - Playwright screenshot capture.
  - External: `https://playwright.dev/docs/test-assertions` - Playwright assertions.
  - External: `https://github.com/vercel/next.js/blob/canary/docs/01-app/01-getting-started/01-installation.mdx` - Next dev server pattern.

  Acceptance criteria (agent-executable only):
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> corepack pnpm --filter @runacademy/web test:e2e -- settings` exits non-zero before the QA implementation or before helper wiring and output is saved to `.omo/evidence/task-6-browser-red.txt`.
  - [ ] `PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10> corepack pnpm --filter @runacademy/web test:e2e -- settings` exits `0` after implementation and output is saved to `.omo/evidence/task-6-browser-green.txt`.
  - [ ] Mocked routes include `**/v1/trends/admin/board`, `**/v1/trends/categories/0`, `**/v1/trends/categories/100`, `**/v1/trends/categories/200`, and `**/v1/trends/collect`.
  - [ ] Disabled browser scenario captures a POST body with `excludeBrandProducts: false` and `customExcludedTerms: []`.
  - [ ] Disabled browser screenshot shows `원본 키워드` and no `제외어`.
  - [ ] Enabled browser scenario captures a POST body with `excludeBrandProducts: true` and normalized terms `["adidas","nike"]`.
  - [ ] Enabled browser screenshot shows `브랜드 제외` and `제외어 adidas, nike`.
  - [ ] Test output or cleanup receipt proves the Next dev server was stopped.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: disabled brand exclusion browser flow
    Tool:     playwright(real Chrome)
    Steps:    corepack pnpm --filter @runacademy/web test:e2e -- settings-disabled --project=chromium *> .omo/evidence/task-6-browser-disabled.txt
    Expected: Playwright selects 1분류=패션잡화, 2분류=신발, 3분류=스니커즈, leaves 브랜드 제품 제외 unchecked, clicks 분석 시작, captures POST JSON with customExcludedTerms: [], and saves screenshot.
    Evidence: .omo/evidence/task-6-browser-disabled.txt and .omo/evidence/task-6-browser-disabled.png

  Scenario: enabled brand exclusion browser flow
    Tool:     playwright(real Chrome)
    Steps:    corepack pnpm --filter @runacademy/web test:e2e -- settings-enabled --project=chromium *> .omo/evidence/task-6-browser-enabled.txt
    Expected: Playwright checks 브랜드 제품 제외, fills 추가 제외어 with "Nike, adidas, Nike", clicks 분석 시작, captures POST JSON with customExcludedTerms: ["adidas","nike"], and saves screenshot.
    Evidence: .omo/evidence/task-6-browser-enabled.txt and .omo/evidence/task-6-browser-enabled.png
  ```

  Commit: YES | Message: `test(web): add mocked browser QA for trend settings` | Files: [`web/package.json`, `web/playwright.config.ts`, `web/e2e/admin-settings.spec.ts`, `pnpm-lock.yaml`]

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
- Reference the plan file path in the final commit footer: `Plan: .omo/plans/naver-trend-settings-hardening.md`.

## Success criteria
- All Must-Have shipped; all QA scenarios pass with captured evidence; F1-F4 approved; commit history clean.
