# Naver Trend Maker 10 이어받기 메모

이 파일은 예전에 같이 작업한 `Naver Trend Maker 10` 내용을 다시 수정하기 위해 모아 둔 기준 문서입니다.

## 현재 위치

- 프로젝트 루트: `C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10`
- 바탕화면 로컬 실행 파일: `C:\Users\imda0\Desktop\Naver Trend Maker 10 로컬버전.exe`
- 바탕화면 Cloudflare 연결 파일: `C:\Users\imda0\Desktop\Naver Trend Maker 10 Cloudflare 연결.exe`
- 바탕화면 Cloudflare CMD 파일: `C:\Users\imda0\Desktop\Naver Trend Maker 10 Cloudflare 연결.cmd`
- GitHub 원격: `https://github.com/lsi9923/Naver-Trend-Make.git`
- 현재 브랜치: `main`

## 이전에 했던 일

1. GitHub 저장소를 `naver-trend-maker-10` 폴더로 가져왔습니다.
2. 이 프로젝트가 네이티브 프로그램이 아니라 `Next.js 웹 관리자 화면 + Cloudflare Worker API` 구조인 것을 확인했습니다.
3. 웹앱을 Windows에서 바로 열 수 있도록 Python 실행기와 PyInstaller EXE를 만들었습니다.
4. 로컬 실행 버전은 고정 주소를 사용하게 만들었습니다.
   - 화면 주소: `http://127.0.0.1:32110/sourcing/admin.html`
   - 로컬 API 주소: `http://127.0.0.1:8787/v1`
5. Cloudflare Worker/D1 연결을 자동화하는 PowerShell 스크립트와 EXE를 만들었습니다.
6. 바탕화면 EXE 파일들을 `desktop-artifacts` 폴더에도 백업했습니다.
7. 최종적으로 `Naver Trend Maker 10.exe`를 저장소 루트의 대표 실행 파일로 올렸습니다.

## 중요 상태

- 로컬 EXE와 `desktop-artifacts` 안 백업 EXE는 같은 파일입니다.
- `git status`는 깨끗한 상태였습니다.
- Cloudflare 배포는 이전 작업 당시 인증 문제로 완전히 끝나지 않았습니다.
- 당시 막힌 이유:
  - `wrangler whoami` 결과가 인증 안 됨 상태였습니다.
  - `CLOUDFLARE_API_TOKEN` 환경변수도 없었습니다.
- 바탕화면에 `Naver Trend Maker 10 API 주소.txt`는 현재 확인되지 않았습니다.

## 수정할 때 주로 보는 원본 파일

- 웹 관리자 화면: `web/app/sourcing/admin/page.tsx`
- 웹 관리자 화면 CSS: `web/app/sourcing/admin/admin.module.css`
- Worker API: `edge-api/src/index.ts`
- 트렌드 분석 로직: `edge-api/src/trend-analysis.ts`
- D1 DB 스키마: `edge-api/schema.sql`
- Cloudflare 설정: `edge-api/wrangler.jsonc`
- 공유 타입/상수: `shared/src/trends.ts`, `shared/src/sourcing.ts`
- 로컬 앱 실행기: `local_app_launcher.py`
- Cloudflare 연결 실행기: `cloudflare_setup_launcher.py`
- Cloudflare 연결 스크립트: `setup_cloudflare_worker.ps1`
- 로컬 EXE 빌드 스크립트: `build_local_app_exe.ps1`
- Cloudflare 연결 EXE 빌드 스크립트: `build_cloudflare_setup_exe.ps1`

## 산출물이라 보통 직접 수정하지 않는 것

- `node_modules`
- `build_*`
- `__pycache__`
- `web/.next`
- `web/.next-prod`
- `edge-api/.wrangler`
- `desktop-artifacts/*.exe`
- 저장소 루트의 `Naver Trend Maker 10.exe`

원본을 수정한 뒤 다시 빌드해서 산출물을 갱신하는 방식이 맞습니다.

## 최근 관련 커밋

- `d10cfa9` `Set local desktop exe as primary artifact`
  - `Naver Trend Maker 10.exe`
  - `README.md`
  - `desktop-artifacts/README.md`
- `6b4ab52` `Back up desktop app and Cloudflare setup`
  - EXE 빌드 스크립트들
  - Cloudflare 연결 스크립트
  - 로컬 실행기
  - 바탕화면 산출물 백업
  - API 설정 UI 일부
- `d04f171` `Fix API setting hydration mismatch`
  - `web/app/sourcing/admin/page.tsx`
- `0d03c90` `Improve trend worker speed and status UI`
  - Worker 처리 속도 개선
  - 진행 상태 UI 개선
  - DB 스키마 일부 추가
- `e9f3695` `Add personal Cloudflare API setup`
  - 개인 Worker API 설정 UI
  - Cloudflare 설정 문서와 env 예시

## 실행/빌드 명령

입력 위치:

```powershell
PS C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10>
```

의존성 설치:

```powershell
corepack pnpm install
```

웹/공유 패키지 빌드:

```powershell
corepack pnpm --filter @runacademy/shared build
corepack pnpm --filter @runacademy/web build
```

로컬 실행 파일 다시 만들기:

```powershell
.\build_local_app_exe.ps1
```

Cloudflare 연결 실행 파일 다시 만들기:

```powershell
.\build_cloudflare_setup_exe.ps1
```

Cloudflare Worker/D1 연결 실행:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup_cloudflare_worker.ps1
```

정상 완료되면 바탕화면에 `Naver Trend Maker 10 API 주소.txt`가 생기고, 그 안의 `https://...workers.dev/v1` 주소를 앱의 `API 설정`에 넣습니다.

## 이전 최종 안내 내용

이전 작업 마지막 상태는 다음과 같았습니다.

- 프로그램과 자동 설정 스크립트는 준비됨
- Cloudflare 로그인만 완료되면 나머지는 거의 자동 진행
- `setup_cloudflare_worker.ps1`가 `로그인 확인 -> D1 생성/재사용 -> 스키마 적용 -> Worker 배포 -> API 주소 txt 저장`을 처리
- 바탕화면의 `Naver Trend Maker 10 Cloudflare 연결.cmd`를 더블클릭해도 같은 흐름 실행

## 수정 전 체크

1. `git status --short`로 현재 변경 상태 확인
2. UI 수정이면 `web/app/sourcing/admin/page.tsx`와 `admin.module.css` 먼저 확인
3. 데이터/API 수정이면 `edge-api/src/index.ts`, `edge-api/schema.sql`, `shared/src/*.ts` 같이 확인
4. 실행 파일까지 필요한 수정이면 소스 수정 후 `build_local_app_exe.ps1` 또는 `build_cloudflare_setup_exe.ps1` 실행
5. Cloudflare 실제 배포가 필요하면 먼저 `corepack pnpm wrangler whoami`로 로그인 확인
