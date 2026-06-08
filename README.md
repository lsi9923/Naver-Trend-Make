# Naver Trend Maker 10

네이버 쇼핑인사이트 카테고리별 월간 인기검색어를 수집하고, 트렌드 분석 후보를 자동으로 누적하는 Windows용 로컬/Cloudflare 관리자 도구입니다.

이 저장소에는 원본 소스, Cloudflare Worker API, Next.js 관리자 화면, 공유 타입, 테스트, Windows 실행 파일 빌드 스크립트, 바탕화면용 실행 파일 아티팩트가 들어 있습니다.

## 핵심 기능

- 네이버 쇼핑인사이트 카테고리 트리 조회
- 카테고리별 월간 인기검색어 랭킹 수집
- 선택 카테고리 단일 분석
- 전체 또는 선택 카테고리 하위 leaf 카테고리 자동 순회
- 자동 순회 중 카테고리마다 트렌드 분석 후보 누적
- 바탕화면 `Naver Trend Maker 10 베스트상품.xlsx` 자동 갱신
- 브랜드 제외 설정과 사용자 제외어 분리 적용
- 로컬 API가 잠깐 재시작되어도 현재 카테고리/run에서 재연결 대기 후 이어가기
- Cloudflare Worker + D1 배포 지원
- Windows 단일 EXE 실행 파일 생성

## 폴더 구성

- `web/`: Next.js 관리자 화면입니다. 실제 화면은 `/sourcing/admin`입니다.
- `edge-api/`: Cloudflare Worker API와 D1 스키마입니다.
- `shared/`: 웹과 Worker가 같이 쓰는 타입, 카테고리, 자동순회 로직입니다.
- `tests/`: Python 로컬 런처/엑셀 내보내기 테스트입니다.
- `web/tests/`: 자동 카테고리 순회와 화면 로직 테스트입니다.
- `shared/tests/`: 공유 설정 로직 테스트입니다.
- `desktop-artifacts/`: 다른 PC에서 바로 받을 수 있는 Windows 실행 파일 보관 폴더입니다.
- `.env.example`: 환경변수 예시입니다. 실제 비밀키는 넣지 않습니다.

## 바로 실행 파일로 쓰기

GitHub에서 저장소를 받은 뒤 아래 파일을 실행하면 됩니다.

- `Naver Trend Maker 10.exe`: 대표 로컬 실행 파일입니다.
- `desktop-artifacts/Naver Trend Maker 10 로컬버전.exe`: 위 파일과 같은 로컬 실행 파일입니다.
- `desktop-artifacts/Naver Trend Maker 10 Cloudflare 연결.exe`: Cloudflare Worker/D1 연결을 돕는 실행 파일입니다.
- `desktop-artifacts/Naver Trend Maker 10 Cloudflare 연결.cmd`: Cloudflare 연결 스크립트 실행용 cmd입니다.

로컬 실행 파일은 앱을 켜면 로컬 UI와 로컬 API를 같이 띄우고 브라우저를 엽니다. 브라우저를 닫거나 앱 창을 종료하면 로컬 서버도 같이 종료됩니다.

## 다른 컴퓨터에서 소스로 실행하기

### 1. 필요한 것

- Windows 10 또는 Windows 11
- Node.js 20 이상
- Python 3.13 권장
- Git
- Cloudflare 배포까지 할 경우 Cloudflare 계정

### 2. 저장소 받기

PowerShell에서 원하는 폴더로 이동한 뒤 실행합니다.

```powershell
git clone https://github.com/lsi9923/Naver-Trend-Make.git
cd Naver-Trend-Make
```

### 3. 패키지 설치

```powershell
corepack enable
corepack pnpm install
```

### 4. 공유 패키지 빌드

```powershell
corepack pnpm --filter @runacademy/shared build
```

### 5. 웹 화면 실행

```powershell
corepack pnpm --filter @runacademy/web dev
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:3000/sourcing/admin
```

## 자동 카테고리 순회와 엑셀 누적 방식

`자동 시작`을 누르면 선택한 카테고리의 하위 leaf 카테고리들을 순서대로 돕니다. 선택 카테고리가 없으면 전체 카테고리 기준으로 leaf 카테고리를 순회합니다.

중간에 멈췄거나 컴퓨터를 껐다가 다시 켜서 이어 돌리고 싶으면 카테고리 선택창에서 시작할 카테고리를 고른 뒤 `여기부터 자동 시작`을 누릅니다. 이 모드는 전체 자동순회 큐에서 선택한 카테고리 앞부분은 건너뛰고, 그 카테고리부터 뒤쪽 카테고리를 계속 순회합니다.

각 카테고리에서는 네이버 쇼핑인사이트 랭킹을 먼저 수집하고, 화면의 트렌드 분석과 같은 기준으로 분석 후보를 누적합니다. 별도 Naver Shopping Search API를 호출하지 않습니다.

바탕화면에는 아래 파일이 계속 갱신됩니다.

```text
Naver Trend Maker 10 베스트상품.xlsx
```

엑셀에는 상품 검색 Top 2 같은 고정 결과가 아니라, 트렌드 분석 기반 후보가 누적됩니다. 주요 컬럼은 분석카드, 분석순위, 분석키워드, 분석근거, 최근점수, 변화량, 모멘텀, 계절지수, 종합점수입니다.

API가 잠깐 죽었다가 watchdog으로 다시 켜지는 경우에는 자동순회가 처음부터 다시 시작하지 않습니다. 현재 카테고리와 현재 runId에서 최대 60회, 3초 간격으로 재연결을 기다린 뒤 이어갑니다.

## 브랜드 제외 설정

브랜드 제외를 끄면 사용자 제외어도 자동으로 비워집니다.

예를 들어 `excludeBrandProducts:false` 상태에서는 `customExcludedTerms:["나이키","아디다스"]`가 API 요청에 남지 않도록 처리합니다. 브랜드 제외를 켠 경우에만 사용자 제외어가 정규화되어 전달됩니다.

## Cloudflare Worker / D1 배포

### 1. Cloudflare 로그인

```powershell
corepack pnpm wrangler login
```

### 2. D1 데이터베이스 생성

```powershell
corepack pnpm wrangler d1 create naver-trend-maker-db
```

출력에 나오는 `database_id`를 `edge-api/wrangler.jsonc`의 `REPLACE_WITH_YOUR_D1_DATABASE_ID` 자리에 넣습니다.

### 3. D1 스키마 적용

```powershell
corepack pnpm wrangler d1 execute naver-trend-maker-db --remote --file edge-api/schema.sql
```

### 4. Worker 배포

```powershell
corepack pnpm wrangler deploy --config edge-api/wrangler.jsonc
```

배포 후 나온 Worker 주소 뒤에 `/v1`을 붙여 API 주소로 씁니다.

```text
https://your-worker.your-subdomain.workers.dev/v1
```

### 5. 화면에 API 주소 연결

관리자 화면 상단의 `API 설정`에 Worker API 주소를 저장합니다.

또는 `.env.local`을 만들어 아래처럼 넣을 수 있습니다.

```env
NEXT_PUBLIC_API_BASE_URL=https://your-worker.your-subdomain.workers.dev/v1
```

`.env.local`과 실제 비밀키 파일은 GitHub에 올리지 않습니다.

## 로컬 EXE 다시 빌드하기

PowerShell에서 저장소 루트로 이동한 뒤 실행합니다.

```powershell
.\build_local_app_exe.ps1
```

빌드 결과는 바탕화면에 생성됩니다.

```text
Naver Trend Maker 10 로컬버전.exe
```

## Cloudflare 연결 EXE 다시 빌드하기

```powershell
.\build_cloudflare_setup_exe.ps1
```

빌드 결과는 바탕화면에 생성됩니다.

```text
Naver Trend Maker 10 Cloudflare 연결.exe
```

## 테스트

자동순회/설정/로컬 런처 쪽을 확인할 때 사용한 명령입니다.

```powershell
node web/tests/admin-auto-collection.test.mjs
node shared/tests/trend-brand-settings.test.mjs
python -m unittest tests.test_best_products_excel_export tests.test_local_app_launcher
corepack pnpm --filter @runacademy/web typecheck
corepack pnpm exec wrangler deploy --dry-run --config edge-api/wrangler.jsonc
```

## GitHub에 포함하지 않는 파일

아래 파일과 폴더는 다른 컴퓨터에서 다시 만들 수 있는 산출물이거나 개인 런타임 데이터라서 커밋하지 않습니다.

- `.env`, `.env.local`, `.env.*`
- `node_modules/`
- `web/.next/`, `web/.next-prod/`
- `shared/dist/`
- `build_*/`
- `*.log`
- `__pycache__/`
- `edge-api/.wrangler/`

필요한 설정값은 `.env.example`을 복사해서 각 PC에서 직접 채우면 됩니다.

## 참고 문서

- Cloudflare Wrangler: https://developers.cloudflare.com/workers/wrangler/
- Cloudflare D1 시작하기: https://developers.cloudflare.com/d1/get-started/
- D1 Wrangler 명령어: https://developers.cloudflare.com/d1/wrangler-commands/
- Wrangler 설정: https://developers.cloudflare.com/workers/wrangler/configuration/
