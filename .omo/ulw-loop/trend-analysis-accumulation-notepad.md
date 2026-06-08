# Goal

Naver Trend Maker 10 자동 누적 수집을 임의 Naver Shopping 상품검색 방식이 아니라 기존 트렌드 분석과 동일한 데이터/분석 경로로 바꾸고, 테스트와 실제 호출 증거로 검증한다.

## User Requirement
- 자동 순회/단일 분석 뒤에 쌓는 대상은 트렌드 분석 화면과 같은 방식으로 분석된 결과여야 한다.
- 트렌드 키워드를 임의로 Naver Shopping Search API query에 넣어 상품을 붙이면 안 된다.
- 엑셀은 카테고리별로 계속 누적되며, 매 카테고리 처리 후 최신 분석 누적 순위를 반영해야 한다.
- 브랜드 제외 설정은 기존 트렌드 분석 설정 그대로 따라야 한다.

## Current Finding
- `edge-api/src/index.ts`의 `/v1/products/best/collect`는 `trend_snapshots`를 읽은 뒤 `searchNaverShoppingItems()`로 `openapi.naver.com/v1/search/shop.json`을 호출한다.
- 현재 방식은 `트렌드키워드 -> Shopping 검색 상품` 흐름이라 사용자가 요구한 `트렌드 분석과 동일한 방식`이 아니다.
- `edge-api/src/trend-analysis.ts`에는 이미 `buildTrendAnalysis(profile, snapshots)`가 있고, 분석 카드/키워드 점수/근거를 만든다.

## Acceptance Criteria
- [ ] 자동/단일 누적 경로가 `buildTrendAnalysis()` 또는 같은 캐시 분석 결과만 사용한다.
- [ ] `/v1/products/best/collect`가 Naver Shopping Search credential 없이도 trend snapshots만 있으면 `collected`를 반환한다.
- [ ] `/v1/products/best/collect` 경로에서 `search/shop.json`, `searchNaverShoppingItems`, `NAVER_SHOPPING_CREDENTIALS_MISSING` 실패가 발생하지 않는다.
- [ ] 저장/엑셀 행은 상품 검색 결과가 아니라 분석 카드, 분석 키워드, 분석 점수, 근거를 보여준다.
- [ ] 기존 자동 시작/중지/브랜드 제외/forceRefresh 테스트가 계속 통과한다.
- [ ] 실제 로컬 Worker HTTP 호출로 trend snapshot 기반 누적이 되는 증거를 남긴다.

## Test Plan
- RED 1: `web/tests/admin-auto-collection.test.mjs`에서 Shopping Search 의존을 금지하고 기존 코드에서 실패하게 한다.
- RED 2: workbook 테스트에서 헤더와 row 값이 `검색어/상품검색순위/상품명`이 아니라 `분석카드/분석순위/분석키워드/분석근거` 중심임을 검증한다.
- GREEN: 서버 수집 로직을 trend-analysis 결과 저장으로 교체하고, UI/엑셀 문구를 맞춘다.
- Manual QA: 로컬 Worker에 테스트 카테고리/run snapshots를 넣고 `/v1/products/best/collect`를 호출해 credential 없이 `collected` 및 분석 키워드 rows를 확인한다.

## Evidence Log
- 2026-06-08: current source confirmed Shopping Search path in `collectBestProductsForCategory`.
- 2026-06-08 RED: `node web/tests/admin-auto-collection.test.mjs` failed because source still used Shopping Search/credential path.
- 2026-06-08 RED: `python -m unittest tests.test_best_products_excel_export` failed because workbook still used product-search headers.
- 2026-06-08 GREEN: `node web/tests/admin-auto-collection.test.mjs` passed 10/10.
- 2026-06-08 GREEN: `python -m unittest tests.test_best_products_excel_export tests.test_local_app_launcher` passed 7/7.
- 2026-06-08 GREEN: `corepack pnpm --filter @runacademy/web typecheck` passed.
- 2026-06-08 GREEN: `corepack pnpm exec wrangler deploy --dry-run --config edge-api/wrangler.jsonc` passed.
- 2026-06-08 HTTP QA: `POST /v1/products/best/collect` on local Worker returned `collected` with `여름점퍼`, `여성바람막이`, source `naver-shopping-insight:trend-analysis`, no shopping fields, and excluded `크로커다일레이디`.
- 2026-06-08 HTTP QA: malformed `{}` payload returned `INVALID_BEST_PRODUCT_INPUT`.
- 2026-06-08 Cleanup: QA Worker parent PID 30076 and child PID 25024 were stopped; port 8795 closed.
- 2026-06-08 Final HTTP QA: after credential/doc/score cleanup, `collect_response_final.json` returned `여름점퍼`, `여성바람막이`, source `naver-shopping-insight:trend-analysis`, blank shopping fields, and `bestScore === keywordScore`.
- 2026-06-08 Final HTTP QA: `export_response_final.json` preserved analysis card/rationale and blank product fields for QA rows.
- 2026-06-08 Final HTTP QA: malformed `{}` returned `INVALID_BEST_PRODUCT_INPUT` with the updated analysis-candidate message.
- 2026-06-08 Final Workbook QA: `export_workbook_final.xlsx` contains `분석점수`, `분석카드`, `분석순위`, `분석키워드` headers and QA analysis rows.
- 2026-06-08 Final Cleanup: QA Worker parent PID 15100 and child PID 4552 were stopped; port 8795 closed.
- 2026-06-08 Final automated verification: `node web/tests/admin-auto-collection.test.mjs` passed 10/10.
- 2026-06-08 Final automated verification: `python -m unittest tests.test_best_products_excel_export tests.test_local_app_launcher` passed 6/6.
- 2026-06-08 Final automated verification: `corepack pnpm --filter @runacademy/web typecheck` passed.
- 2026-06-08 Final automated verification: `corepack pnpm exec wrangler deploy --dry-run --config edge-api/wrangler.jsonc` passed.
- 2026-06-08 EXE: rebuilt `C:\Users\imda0\Desktop\Naver Trend Maker 10 로컬버전.exe`, size 29,391,093 bytes.
