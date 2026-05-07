# Desktop artifacts

이 폴더는 바탕화면에 만들어 둔 Windows 실행 파일을 GitHub에 같이 보관하기 위한 폴더입니다.

- 저장소 루트의 `Naver Trend Maker 10.exe`: 대표 실행 파일, 아래 로컬 버전과 같은 파일
- `Naver Trend Maker 10 로컬버전.exe`: Cloudflare 없이 이 PC 안에서 실행하는 로컬 버전
- `Naver Trend Maker 10 Cloudflare 연결.exe`: Cloudflare Worker/D1 연결을 도와주는 실행 파일
- `Naver Trend Maker 10 Cloudflare 연결.cmd`: 같은 Cloudflare 연결 스크립트를 여는 명령 파일

원본 스크립트는 저장소 루트의 `local_app_launcher.py`, `cloudflare_setup_launcher.py`, `setup_cloudflare_worker.ps1`, `build_local_app_exe.ps1`, `build_cloudflare_setup_exe.ps1`입니다.
