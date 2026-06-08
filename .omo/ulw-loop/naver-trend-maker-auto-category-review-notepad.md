# Naver Trend Maker 10 Auto Category Review Notepad

Date: 2026-06-08
Mode: OMO ULW review, no production code edits in this pass

## User Request

- Review the current app accurately by section.
- Confirm whether pressing Start can be changed to keep cycling through categories and keep bringing recommendations by category.
- Verify with tests and browser section checks before saying it is safe.

## Current Section Findings

- Admin UI source: `web/app/sourcing/admin/page.tsx`
- Current input model is one selected category path at a time.
- Current Start flow posts one `TrendProfileInput` to `/trends/collect`.
- Current result view is centered around one active/visible run.
- Current archive board shows recent runs only; backend board query currently limits runs to 8.
- There is no dedicated batch/autopilot section yet for "all child categories" or "category-by-category recommendations".

## Current Backend Findings

- API source: `edge-api/src/index.ts`
- `/trends/collect` can create/reuse one run for one category/filter profile.
- `startBackfill` creates monthly tasks from the configured start period through the latest month.
- Worker processing is already queue-based and keeps Naver collection serialized.
- Local launcher has a collection pump that repeatedly calls `/trends/worker/process-next`, so a local exe can keep processing queued work after Start.

## Recommended Feature Direction

- Do not implement this as frontend repeated clicking only.
- Add a persistent batch/autopilot concept:
  - batch create API
  - category expansion from selected parent category
  - per-category run list
  - batch progress/cancel/retry
  - category-level recommendation summary
  - safe single-worker processing
- Keep a max category limit and skip/reuse cached completed runs by default.

## Known Risks To Verify

- Many categories can take a long time because each category may need monthly Naver ranking collection.
- Existing board limit of 8 will hide batch results unless a batch-specific endpoint/view is added.
- Current shared type `TrendProfileInput` is single-category, so batch state needs new shared types.
- Recommendation cards are only ready after a run completes all required periods.

## Evidence Checklist

- Build shared package: PASS
  - Command: `corepack pnpm --filter @runacademy/shared build`
- Build web package: PASS
  - Command: `corepack pnpm --filter @runacademy/web build`
- Run Python launcher tests: PASS
  - Command: `python -m unittest discover -v`
  - Result: 2 tests passed
- Py-compile launcher/test files: PASS
  - Command: `python -m py_compile local_app_launcher.py desktop_launcher.py cloudflare_setup_launcher.py tests/test_local_app_launcher.py`
- Open the static admin page and verify visible sections: PASS
  - URL: `http://127.0.0.1:32110/sourcing/admin.html`
  - Page title: `한이룸의 네이버 트렌드 마법사 1.0`
  - Visible headings included:
    - `Cloudflare Worker 연결`
    - `트렌드 분석 조건 입력`
    - `작업 결과 보기`
    - `데이터 취합`
    - `장기 인사이트 준비 중`
    - `최근 수집 월 미리보기`
    - `세일즈 트렌드 분석`
- Record screenshot and UI text evidence: PASS
  - `.omo/ulw-loop/evidence/naver-trend-maker-section-review-fullpage.png`
  - `.omo/ulw-loop/evidence/naver-trend-maker-selected-category-fullpage.png`
  - `.omo/ulw-loop/evidence/naver-trend-maker-section-structure.json`
  - `.omo/ulw-loop/evidence/naver-trend-maker-section-after-root-category.json`
  - `.omo/ulw-loop/evidence/naver-trend-maker-section-after-second-category.json`
- Runtime cleanup: PASS
  - Temporary static server on port 32110 was stopped.
- Run reviewer after evidence is collected: PENDING
- Generated implementation plan: PASS
  - `.omo/plans/naver-trend-auto-category-cycle.md`

## Browser QA Result

- First screen has 3 category selects.
- 1st category select has 13 root category options.
- Selecting `패션의류` enables 2nd category and loads 4 child category options.
- Selecting `여성의류` enables 3rd category and loads 17 leaf category options.
- Start button is disabled as `API 설정 필요` when no API endpoint is configured.
- No visible section named `카테고리 자동` or `자동 추천` exists in the current UI.

## Current Review Conclusion

- Feasible: yes.
- Current app does not already provide batch/category-autopilot behavior.
- The category hierarchy can be expanded and used as the source list for an autopilot.
- The backend queue and local collection pump are a good foundation for continuing work in the background.
- Before implementation, add persistent batch state and batch-specific result views; otherwise many category runs will be hidden or hard to manage.
- A lower-risk minimum version can keep the current "one category = one run" model, but it still needs board visibility, queue fairness, and UI status fixes.
