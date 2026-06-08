# Naver Trend Maker 10 Settings Hardening Notepad

Date: 2026-06-08
Mode: ULW, TDD required

## Skills Survey

- Available local skill files counted: 230.
- `omo:ulw-plan`: used because the user explicitly requested it and the work spans UI, shared contracts, backend, and QA.
- `omo:ulw-loop`: used because the user requested evidence-bound execution and this task requires durable QA artifacts.
- `omo:start-work`: used because the user asked to move from review into setup/work.
- `code-review`: used because the user requested strict review and this changes production code.
- `browser:control-in-app-browser`: used because the key acceptance scenario is browser-facing.

## Binding Success Criteria

1. Shared contract test proves brand excluded terms are only effective when brand exclusion is enabled.
   - Automated test: `shared/tests/trend-brand-settings.test.mjs`
   - RED evidence: `.omo/ulw-loop/evidence/settings-hardening-red.txt`
   - GREEN evidence: `.omo/ulw-loop/evidence/settings-hardening-green.txt`
   - Manual QA channel: HTTP/browser-backed mock API scenario
   - Manual QA artifact: `.omo/ulw-loop/evidence/settings-hardening-browser-qa.json`

2. Frontend request payload never sends hidden custom excluded terms when brand exclusion is off.
   - Automated test: `shared/tests/trend-brand-settings.test.mjs`
   - Manual QA channel: Browser use against `http://127.0.0.1:32110/sourcing/admin.html`
   - Expected: `excludeBrandProducts:false` and `customExcludedTerms:[]`

3. Backend normalization never keys profiles by hidden custom excluded terms when brand exclusion is off.
   - Automated test: `shared/tests/trend-brand-settings.test.mjs`
   - Worker build evidence: Wrangler dry-run
   - Manual QA channel: HTTP/mock API request capture

4. Current run and archive display show enough setting metadata to distinguish category/filter runs.
   - Automated support: web build
   - Manual QA channel: Browser use
   - Expected: CID, Top count, device, gender, age, brand/original, and terms when applicable.

## Scope Boundaries

- In scope: shared term normalization contract, frontend payload/state/display, backend normalization, tests, browser QA.
- Out of scope in this pass: full auto-cycle batch persistence, D1 schema migration, EXE packaging.

## RED/GREEN Log

- RED: PASS, captured at `.omo/ulw-loop/evidence/settings-hardening-red.txt`
  - Failure: `../dist/index.js` did not export `normalizeTrendExcludedTermsForMode`.
- GREEN: PASS, captured at `.omo/ulw-loop/evidence/settings-hardening-green.txt`
  - `brand excluded terms are cleared when brand exclusion is disabled`: ok
  - `brand excluded terms are normalized and deduped when brand exclusion is enabled`: ok
  - `comma input is split into trimmed excluded term tokens`: ok

## Implementation

- Added shared contract functions in `shared/src/trends.ts`:
  - `splitTrendExcludedTermsInput`
  - `normalizeTrendExcludedTermsForMode`
- Updated frontend `web/app/sourcing/admin/page.tsx` to build collect payload and setting pills through the shared contract.
- Updated backend `edge-api/src/index.ts` to normalize hidden excluded terms through the shared contract.
- Kept archive/current-run setting display from the prior review: CID, Top, device, gender, age, brand/original mode, and terms when brand exclusion is on.

## Automated Verification

- `corepack pnpm --filter @runacademy/shared build && node --test shared/tests/trend-brand-settings.test.mjs`
  - RED evidence: `.omo/ulw-loop/evidence/settings-hardening-red.txt`
  - GREEN evidence: `.omo/ulw-loop/evidence/settings-hardening-green.txt`
  - Post-review GREEN evidence after regenerating full diff: `.omo/ulw-loop/evidence/settings-hardening-green-after-review.txt`
- `python -m unittest discover -v`
  - Evidence: `.omo/ulw-loop/evidence/settings-hardening-python-unittest.txt`
- `corepack pnpm --filter @runacademy/web build`
  - Evidence: `.omo/ulw-loop/evidence/settings-hardening-web-build.txt`
- `corepack pnpm wrangler deploy --dry-run --config edge-api/wrangler.jsonc`
  - Evidence: `.omo/ulw-loop/evidence/settings-hardening-wrangler-dry-run.txt`

## Manual QA

Channel: Browser use against real static page with mock API.

Exact page:
- `http://127.0.0.1:32110/sourcing/admin.html`

Scenario:
1. Select `패션의류 > 여성의류 > 니트`.
2. Start with `Top 40`, `PC`, `여성`, `20대`, brand exclusion on, terms `nike, adidas`.
3. Start again with `Top 20`, `모바일`, `남성`, `30대`, brand exclusion off.

PASS evidence:
- `.omo/ulw-loop/evidence/settings-hardening-browser-qa.json`
- `.omo/ulw-loop/evidence/settings-hardening-browser-qa.png`

Observed:
- First request has brand exclusion on and normalized terms `adidas`, `nike`.
- Second request has `excludeBrandProducts: false` and `customExcludedTerms: []`.
- Hidden excluded-term input count after turning brand exclusion off is `0`.
- Current progress panel shows CID, Top 20, mobile, male, 30s, original keywords, and does not show hidden excluded terms.
- Archive shows both Top 40 and Top 20 runs with filter labels.

Cleanup receipts:
- Browser tab closed and mock API stopped: `.omo/ulw-loop/evidence/settings-hardening-browser-cleanup.json`
- Static server stopped: `.omo/ulw-loop/evidence/settings-hardening-static-server-cleanup.txt`

## Review Loop

- Reviewer rejection 1: `.omo/ulw-loop/evidence/settings-hardening-diff.patch` did not include untracked `shared/tests/trend-brand-settings.test.mjs`.
- Fix: regenerated the patch with `git diff --no-index -- /dev/null shared/tests/trend-brand-settings.test.mjs` appended.
- Evidence: `grep` confirms the patch includes `shared/tests/trend-brand-settings.test.mjs`.
- Re-ran shared test and captured `.omo/ulw-loop/evidence/settings-hardening-green-after-review.txt`.
- Reviewer round 2: UNCONDITIONAL APPROVAL.
- Approval summary: shared contract clears excluded terms when brand exclusion is disabled; frontend collect payload and backend normalization use the shared contract; browser QA proves ON/OFF behavior and visible setting labels; cleanup receipts are present.
