from __future__ import annotations

import http.server
import pathlib
import socketserver
import sys
import threading
import tkinter as tk
import tkinter.messagebox as messagebox
import urllib.parse
import webbrowser


APP_TITLE = "Naver Trend Maker 10"
WINDOW_SIZE = "560x240"
LOCAL_PORT = 32110


def resolve_site_dir() -> pathlib.Path:
    if getattr(sys, "frozen", False):
        # PyInstaller extracts bundled data into sys._MEIPASS at runtime.
        return pathlib.Path(sys._MEIPASS) / "site"  # type: ignore[attr-defined]
    return pathlib.Path(__file__).resolve().parent / "web" / ".next-prod"


class ExportRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, format: str, *args) -> None:
        return

    def do_GET(self) -> None:
        self.path = self.rewrite_path(self.path)
        super().do_GET()

    def do_HEAD(self) -> None:
        self.path = self.rewrite_path(self.path)
        super().do_HEAD()

    def rewrite_path(self, raw_path: str) -> str:
        parts = urllib.parse.urlsplit(raw_path)
        clean_path = urllib.parse.unquote(parts.path)

        if not clean_path or clean_path == "/":
            return raw_path

        local_root = pathlib.Path(self.directory)
        relative_path = clean_path.lstrip("/")
        direct_path = local_root / relative_path
        html_path = local_root / f"{relative_path}.html"
        index_path = local_root / relative_path / "index.html"

        if direct_path.exists():
            return raw_path

        if html_path.exists():
            updated_path = f"{clean_path}.html"
            return urllib.parse.urlunsplit(("", "", updated_path, parts.query, parts.fragment))

        if index_path.exists():
            updated_path = f"{clean_path.rstrip('/')}/"
            return urllib.parse.urlunsplit(("", "", updated_path, parts.query, parts.fragment))

        return raw_path


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def start_server(site_dir: pathlib.Path) -> tuple[ThreadedHTTPServer, int]:
    handler = lambda *args, **kwargs: ExportRequestHandler(*args, directory=str(site_dir), **kwargs)
    server = ThreadedHTTPServer(("127.0.0.1", LOCAL_PORT), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, int(server.server_port)


def open_browser(url: str) -> None:
    opened = webbrowser.open(url)
    if not opened:
        messagebox.showinfo(
            APP_TITLE,
            "Browser did not open automatically.\n\n"
            f"Open this address manually:\n{url}",
        )


def build_window(url: str, server: ThreadedHTTPServer) -> tk.Tk:
    root = tk.Tk()
    root.title(APP_TITLE)
    root.geometry(WINDOW_SIZE)
    root.resizable(False, False)

    frame = tk.Frame(root, padx=20, pady=20)
    frame.pack(fill="both", expand=True)

    header = tk.Label(
        frame,
        text="관리자 화면을 브라우저로 열었습니다.",
        font=("Malgun Gothic", 14, "bold"),
        anchor="w",
        justify="left",
    )
    header.pack(fill="x")

    lines = [
        "이 창을 닫으면 로컬 서버도 같이 종료됩니다.",
        "처음 실행이면 화면 상단 API 설정에 본인 Cloudflare Worker 주소(/v1)를 넣어야 합니다.",
        "",
        f"현재 주소: {url}",
    ]
    body = tk.Label(
        frame,
        text="\n".join(lines),
        font=("Malgun Gothic", 10),
        anchor="w",
        justify="left",
    )
    body.pack(fill="x", pady=(14, 18))

    button_row = tk.Frame(frame)
    button_row.pack(fill="x")

    reopen_button = tk.Button(
        button_row,
        text="브라우저 다시 열기",
        width=18,
        command=lambda: open_browser(url),
    )
    reopen_button.pack(side="left")

    close_button = tk.Button(
        button_row,
        text="종료",
        width=12,
        command=root.destroy,
    )
    close_button.pack(side="right")

    def on_close() -> None:
        server.shutdown()
        server.server_close()
        root.destroy()

    root.protocol("WM_DELETE_WINDOW", on_close)
    return root


def main() -> int:
    site_dir = resolve_site_dir()
    if not site_dir.exists():
        messagebox.showerror(
            APP_TITLE,
            "Bundled site files were not found.\n\n"
            f"Expected folder:\n{site_dir}",
        )
        return 1

    try:
        server, port = start_server(site_dir)
    except OSError:
        messagebox.showerror(
            APP_TITLE,
            "앱 전용 로컬 포트(32110)를 열지 못했습니다.\n\n"
            "이미 같은 앱이 실행 중이거나 다른 프로그램이 이 포트를 사용 중입니다.\n"
            "열려 있는 Naver Trend Maker 10 창을 닫고 다시 실행해 주세요.",
        )
        return 1

    url = f"http://127.0.0.1:{port}/sourcing/admin.html"
    open_browser(url)
    window = build_window(url, server)
    window.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
