from __future__ import annotations

import pathlib
import subprocess
import sys


APP_TITLE = "Naver Trend Maker 10 Cloudflare 연결"
SCRIPT_PATH = pathlib.Path(
    r"C:\Users\imda0\Desktop\커서 ai 폴더\naver-trend-maker-10\setup_cloudflare_worker.ps1"
)


def wait_before_exit() -> None:
    try:
        input("\n창을 닫으려면 Enter를 누르세요...")
    except (EOFError, KeyboardInterrupt):
        pass


def main() -> int:
    print(f"=== {APP_TITLE} ===\n")

    if not SCRIPT_PATH.exists():
        print("Cloudflare 연결 스크립트를 찾지 못했습니다.")
        print(f"찾는 위치: {SCRIPT_PATH}")
        wait_before_exit()
        return 1

    print("Cloudflare 로그인과 Worker/D1 배포를 시작합니다.")
    print("브라우저가 열리면 Cloudflare 계정으로 로그인하세요.\n")

    command = [
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(SCRIPT_PATH),
    ]

    exit_code = subprocess.call(command)
    if exit_code == 0:
        print("\n완료되었습니다.")
        print("바탕화면의 'Naver Trend Maker 10 API 주소.txt' 파일을 확인하세요.")
    else:
        print(f"\n중간에 실패했습니다. 종료 코드: {exit_code}")
        print("위쪽에 나온 오류 메시지를 확인하세요.")

    wait_before_exit()
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
