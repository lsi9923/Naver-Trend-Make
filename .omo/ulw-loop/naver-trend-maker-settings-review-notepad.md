# Naver Trend Maker 10 Settings Review Notepad

Date: 2026-06-08
Mode: Review and QA only, no production code edits

## Question

How should visible information differ during category auto-cycle so runs do not get mixed up?

## Required Display Split

The auto-cycle screen should not reuse one generic `visibleRun` panel for everything.

Recommended split:

1. Batch header
   - Batch name
   - selected root/scope category
   - total target categories
   - created/running/completed/failed/cancelled counts
   - batch status: preparing, running, paused, completed, failed, cancelled

2. Batch setting snapshot
   - result count: Top 20 or Top 40
   - devices: all, PC, mobile, or selected set
   - genders: all, female, male, or selected set
   - ages: all or selected age set
   - brand exclusion: on/off
   - custom excluded terms only when brand exclusion is on
   - start/end period
   - created time

3. Category queue table
   - category path
   - category cid
   - queue status
   - run id
   - completed months / total months
   - current period/page
   - ETA
   - last error

4. Selected category detail
   - one active run detail at a time
   - category path and cid
   - same setting snapshot for that run
   - recommendation cards for that category only
   - preview keywords for that category only

5. Batch recommendation summary
   - category-by-category recommended keyword highlights
   - categories with high confidence
   - categories still waiting
   - failed categories and retry button

## Current Code Findings

- UI source: `web/app/sourcing/admin/page.tsx`
- Current page uses one `visibleRun = currentRun ?? trendBoard?.runs[0] ?? null`.
- Current Start flow posts one `TrendProfileInput` to `/trends/collect`.
- Archive shows category path, Top count, and brand/original label, but not devices/genders/ages.
- Progress panel shows some values from `visibleRun` and some fallback values from current `form`.

## Backend Separation Findings

- API source: `edge-api/src/index.ts`
- Existing profile lookup separates by:
  - category cid
  - time unit
  - devices
  - genders
  - ages
  - result count
  - exclude brand flag
  - custom excluded terms
- This is mostly good for different settings.
- Risk: custom excluded terms are still part of the profile key even when brand exclusion is off.

## Browser QA With Mock API

Static page:
- `http://127.0.0.1:32110/sourcing/admin.html`

Mock API:
- `http://127.0.0.1:32111/v1`

Scenario A:
- Category: `패션의류 > 여성의류 > 니트`
- Top 40
- PC
- 여성
- 20대
- Brand exclusion on
- Custom excluded terms: `나이키, 아디다스`
- Request body correctly included:
  - `devices: ["pc"]`
  - `genders: ["f"]`
  - `ages: ["20"]`
  - `resultCount: 40`
  - `excludeBrandProducts: true`
  - `customExcludedTerms: ["나이키", "아디다스"]`

Scenario B:
- Same category
- Top 20
- Mobile
- 남성
- 30대
- Brand exclusion off
- Request body included:
  - `devices: ["mo"]`
  - `genders: ["m"]`
  - `ages: ["30"]`
  - `resultCount: 20`
  - `excludeBrandProducts: false`
  - `customExcludedTerms: ["나이키", "아디다스"]`

## Main Issue Found

When brand exclusion is turned off, the hidden custom excluded terms remain in form state and are still sent to the API.

This can create confusing duplicate profiles:
- UI appears to be original keyword mode.
- Backend still sees custom excluded terms in the profile key.
- Two runs that look the same can be stored separately.

## Fix Direction Before Auto-Cycle

Must fix before implementing category auto-cycle:

1. Frontend request payload
   - Send `customExcludedTerms: []` when `excludeBrandProducts` is false.

2. Frontend state
   - Optionally clear `customExcludedTerms` when user unchecks brand exclusion.

3. Backend normalization
   - In `normalizeTrendProfileInput`, force `customExcludedTerms: []` when `excludeBrandProducts` is false.
   - This protects API callers outside the UI too.

4. UI display
   - Only show custom excluded terms in setting snapshot when brand exclusion is on.
   - Archive/batch rows should show devices, genders, ages, result count, brand exclusion, and cid.

## Verification

PASS:
- `python -m unittest discover -v`
- `corepack pnpm --filter @runacademy/shared build`
- `corepack pnpm --filter @runacademy/web build`

Evidence files:
- `.omo/ulw-loop/evidence/settings-review-api-ui-configured.json`
- `.omo/ulw-loop/evidence/settings-review-form-controls.json`
- `.omo/ulw-loop/evidence/settings-review-scenario-a.json`
- `.omo/ulw-loop/evidence/settings-review-scenario-a-with-terms.json`
- `.omo/ulw-loop/evidence/settings-review-scenario-b.json`
- `.omo/ulw-loop/evidence/settings-review-scenario-a-with-terms.png`
- `.omo/ulw-loop/evidence/settings-review-scenario-b.png`

Cleanup:
- Mock API stopped.
- Static server on port 32110 stopped.

## Fix Applied

Date: 2026-06-08

Changed files:
- `web/app/sourcing/admin/page.tsx`
- `edge-api/src/index.ts`

Fixes:
- Frontend now sends `customExcludedTerms: []` when `excludeBrandProducts` is false.
- Frontend clears hidden `customExcludedTerms` when the brand exclusion checkbox is turned off.
- Backend normalization now forces `customExcludedTerms: []` when `excludeBrandProducts` is false.
- Current progress setting pills now show category/result/filter/brand mode.
- Archive rows now show CID, Top count, devices, genders, ages, brand/original mode, and excluded terms only when brand exclusion is on.

Post-fix browser QA:
- Scenario A: brand exclusion on with `nike, adidas`
  - request had `excludeBrandProducts: true`
  - request had `customExcludedTerms: ["nike", "adidas"]`
- Scenario B: same category, brand exclusion off
  - request had `excludeBrandProducts: false`
  - request had `customExcludedTerms: []`
  - hidden excluded term input was not visible
  - current progress panel showed `CID 50021279`, `Top 20`, `기기 모바일`, `성별 남성`, `연령 30대`, `원본 키워드`
  - current progress panel did not show `nike` or `adidas`
  - archive showed both Top 40 / Top 20 runs with filter labels

Post-fix evidence:
- `.omo/ulw-loop/evidence/brand-fix-display-qa.json`
- `.omo/ulw-loop/evidence/brand-fix-display-qa.png`

Post-fix verification:
- `corepack pnpm --filter @runacademy/shared build`: PASS
- `corepack pnpm --filter @runacademy/web build`: PASS
- `python -m unittest discover -v`: PASS
- `corepack pnpm wrangler deploy --dry-run --config edge-api/wrangler.jsonc`: PASS
