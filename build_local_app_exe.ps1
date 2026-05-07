$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkspaceRoot = Split-Path -Parent $RepoRoot
$PythonExe = Join-Path $WorkspaceRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

Push-Location $RepoRoot
try {
    corepack pnpm install
    corepack pnpm --filter @runacademy/shared build

    $env:NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:8787/v1"
    corepack pnpm --filter @runacademy/web build
    Remove-Item Env:\NEXT_PUBLIC_API_BASE_URL -ErrorAction SilentlyContinue

    & $PythonExe -m pip install pyinstaller

    $LauncherPath = Join-Path $RepoRoot "local_app_launcher.py"
    $SitePath = Join-Path $RepoRoot "web\.next-prod"
    $DesktopPath = [Environment]::GetFolderPath("Desktop")
    $WorkPath = Join-Path $RepoRoot "build_local_app_exe"

    & $PythonExe -m PyInstaller `
        --noconfirm `
        --clean `
        --onefile `
        --windowed `
        --name "Naver Trend Maker 10 로컬버전" `
        --distpath $DesktopPath `
        --workpath $WorkPath `
        --specpath $RepoRoot `
        --add-data "${SitePath};site" `
        $LauncherPath
}
finally {
    Pop-Location
    Remove-Item Env:\NEXT_PUBLIC_API_BASE_URL -ErrorAction SilentlyContinue
}
