# Best Products Auto Excel Notepad

## Skill Survey
- Available skills were enumerated from the loaded system skill list. Relevant skills used/read: `omo:ulw-plan` for planning because scope is multi-step/multi-module; `omo:ulw-loop` for evidence-driven execution; `omo:start-work` for execution ledger expectations; `lazyweb-add-inspo-source` was read because the user named it, but it is for design inspiration source login and not directly applicable to Naver product data collection.

## Binding Goal
Implement and prove automatic category rotation that collects best products per category, keeps accumulating rows, and continuously updates a Desktop Excel-compatible workbook/file after each category.

## Success Criteria
1. Happy path: when two categories are processed, the system appends exactly Top 2 product rows per category and writes/updates a Desktop Excel-compatible file immediately after each category.
2. Empty/malformed product source: if a product lookup returns no usable items, the category records a failed/empty status without corrupting prior product rows or the file.
3. Dedup/update: rerunning the same category updates/replaces that category's current Top 2 rows instead of endlessly duplicating stale rows, while preserving other categories.
4. Regression: existing automatic category queue, brand-off settings, force fresh Naver trend collection, launcher API watchdog, and web build remain green.

## TDD Mapping
- New test file(s) TBD after code survey; must capture RED before production implementation and GREEN after.
- Manual QA channels planned: HTTP endpoint call against live local API, Browser use against real admin page, filesystem Excel/CSV artifact check on Desktop.

## Findings
- Existing app collects monthly keyword ranks, not product details.
- Local EXE Python launcher can write Desktop files; Cloudflare-style edge API cannot directly write local Excel, so local export/persistence boundary must be explicit.

## RED evidence - 2026-06-08
- python -m unittest tests.test_best_products_excel_export failed as expected: local_app_launcher.write_best_products_workbook missing.
- 
ode web\\tests\\admin-auto-collection.test.mjs failed as expected: collectBestProductsForCategory call/API/schema missing.


## GREEN evidence - unit/static - 2026-06-08
- python -m unittest tests.test_best_products_excel_export tests.test_local_app_launcher passed: 4 tests OK.
- corepack pnpm --filter @runacademy/shared build passed.
- corepack pnpm --filter @runacademy/web typecheck passed via Next build.
- 
ode web\\tests\\admin-auto-collection.test.mjs passed: 8 tests OK.
- 
ode shared\\tests\\trend-brand-settings.test.mjs passed: 3 tests OK.


## Runtime evidence - local API/export - 2026-06-08
- Local D1 schema applied successfully: 15 commands executed successfully.
- wrangler dev ready on http://127.0.0.1:8787.
- /v1/health returned ok true.
- /v1/products/best/collect for 니트 returned collectionStatus failed with failureReason NAVER_SHOPPING_CREDENTIALS_MISSING; no fake product rows were generated.
- /v1/products/best/export returned the stored failure row.
- Created workbook C:\\Users\\imda0\\Desktop\\Naver Trend Maker 10 베스트상품.xlsx; verified 2 rows x 15 columns and failure reason in the workbook.


## GREEN evidence - rerun after env handling - 2026-06-08
- python -m unittest tests.test_best_products_excel_export tests.test_local_app_launcher passed: 4 tests OK.
- corepack pnpm --filter @runacademy/web typecheck passed via Next build.
- corepack pnpm --filter @runacademy/shared build && node web\\tests\\admin-auto-collection.test.mjs && node shared\\tests\\trend-brand-settings.test.mjs passed: shared build, 8 web tests, 3 shared tests OK.
- Credential handling now checks Worker bindings and local inherited environment variables without passing secrets on the command line.


## Runtime evidence - post-rerun - 2026-06-08
- Restarted wrangler dev and verified /v1/products/best/collect still returns handled collectionStatus: failed with NAVER_SHOPPING_CREDENTIALS_MISSING when no credentials are present.
- /v1/products/best/export returned the persisted failure row after the new request.
- Stopped the verification Worker cleanly with Ctrl+C.


## Build evidence - 2026-06-08
- ./build_local_app_exe.ps1 completed successfully.
- PyInstaller included openpyxl hook during build.
- Desktop EXE updated: C:\\Users\\imda0\\Desktop\\Naver Trend Maker 10 로컬버전.exe, 29,390,754 bytes, LastWriteTime 2026-06-08 오전 7:18:36.
- Desktop workbook exists: C:\\Users\\imda0\\Desktop\\Naver Trend Maker 10 베스트상품.xlsx, 5,512 bytes.


## GREEN evidence - existing API readiness fix - 2026-06-08
- Added readiness guard so a healthy old local API without /v1/products/best/export is restarted instead of reused.
- python -m unittest tests.test_best_products_excel_export tests.test_local_app_launcher passed: 5 tests OK.
- corepack pnpm --filter @runacademy/shared build && node web\\tests\\admin-auto-collection.test.mjs && node shared\\tests\\trend-brand-settings.test.mjs passed before the final launcher-only fix.


## Final build evidence - 2026-06-08
- Rebuilt after existing-API readiness fix with ./build_local_app_exe.ps1 successfully.
- Final Desktop EXE: C:\\Users\\imda0\\Desktop\\Naver Trend Maker 10 로컬버전.exe, 29,459,886 bytes, LastWriteTime 2026-06-08 오전 7:24:31.


## Credential forwarding evidence - 2026-06-08
- Headless Edge against Naver Shopping search still returned HTTP 418 block page, so browser scraping is not a reliable keyless source.
- Added temporary Wrangler env-file forwarding from Windows environment variables NAVER_CLIENT_ID/NAVER_CLIENT_SECRET or NAVER_SHOPPING_CLIENT_ID/NAVER_SHOPPING_CLIENT_SECRET.
- python -m unittest tests.test_local_app_launcher tests.test_best_products_excel_export passed: 7 tests OK.
- Runtime dummy credential check through local_app_launcher.start_local_api() returned NAVER_SHOPPING_HTTP_401 instead of NAVER_SHOPPING_CREDENTIALS_MISSING, proving credentials are forwarded into the Worker without putting secret values in the command line.


## Docs/setup evidence - 2026-06-08
- Added .env.example entries for NAVER_SHOPPING_CLIENT_ID and NAVER_SHOPPING_CLIENT_SECRET.
- Added README section explaining Windows user env vars NAVER_CLIENT_ID and NAVER_CLIENT_SECRET, and that missing credentials produce explicit Excel failure rows instead of fake products.
- Final Desktop EXE after credential forwarding fix: C:\\Users\\imda0\\Desktop\\Naver Trend Maker 10 로컬버전.exe, 29,392,798 bytes, LastWriteTime 2026-06-08 오전 7:35:18.


## Best-product status UI evidence - 2026-06-08
- Added `/v1/products/best/status` endpoint returning `ready`, `credentialStatus`, source, output file name, and env var names.
- Admin auto panel now shows product collection credential readiness and the Excel file name before auto start.
- `python -m unittest tests.test_local_app_launcher tests.test_best_products_excel_export` passed: 7 tests OK.
- `corepack pnpm --filter @runacademy/web typecheck` passed via Next build.
- `corepack pnpm --filter @runacademy/shared build && node web\tests\admin-auto-collection.test.mjs && node shared\tests\trend-brand-settings.test.mjs` passed: 9 web tests, 3 shared tests OK.
- Runtime `GET /v1/products/best/status` without credentials returned `ready:false`, `credentialStatus:"missing"`.

## Final build evidence after status UI - 2026-06-08
- Rebuilt after best-product status UI with `./build_local_app_exe.ps1` successfully.
- Final Desktop EXE: `C:\Users\imda0\Desktop\Naver Trend Maker 10 로컬버전.exe`, 29,393,602 bytes, LastWriteTime 2026-06-08 오전 7:45:12.

## Real Naver product collection evidence - 2026-06-08
- Saved provided Naver API credentials into Windows User environment variables and current session without echoing the secret value in final output.
- Runtime `local_app_launcher.start_local_api()` status check returned `ready:true`, `credentialStatus:"configured"`.
- Real product collect returned `collectionStatus:"collected"` for 니트 with 2 items and 원피스 with 2 items.
- Real background Excel pump test collected 가디건 and 블라우스, waited between categories, then verified workbook auto-updated.
- Workbook verification: 8 data rows, 8 collected rows, 8 non-empty links, 8 non-empty prices, workbook mtime increased.
- Workbook path: `C:\Users\imda0\Desktop\Naver Trend Maker 10 베스트상품.xlsx`.

## Accumulated reranking fix - 2026-06-08
- Corrected user intent: Top 2 was only an example, not a fixed per-category limit.
- Changed product collection default from fixed 2 to a wider candidate set: default 10, max 20.
- Auto UI text now says candidates are accumulated and globally re-ranked instead of promising fixed Top 2.
- Export now computes `bestScore` and `globalRank` at export time, sorting all accumulated collected products by score.
- Desktop workbook now includes `전체순위` and `베스트점수` columns before the original product details.
- Tests passed: Python workbook/launcher 7 tests, shared build, web auto collection 9 tests, web typecheck.
- Real Naver API check: 니트 collected 10, 원피스 collected 10; workbook had 24 collected rows, first global ranks 1-10, first scores descending [1037, 1034, 1031, 1031, 996, 995, 991, 990, 955, 952].
