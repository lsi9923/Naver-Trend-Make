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
    corepack pnpm --filter @runacademy/web build

    & $PythonExe -m pip install pyinstaller

    $LauncherPath = Join-Path $RepoRoot "desktop_launcher.py"
    $SitePath = Join-Path $RepoRoot "web\.next-prod"
    $DesktopPath = [Environment]::GetFolderPath("Desktop")
    $WorkPath = Join-Path $RepoRoot "build_naver_trend_maker_10"

    & $PythonExe -m PyInstaller `
        --noconfirm `
        --clean `
        --onefile `
        --windowed `
        --name "Naver Trend Maker 10" `
        --distpath $DesktopPath `
        --workpath $WorkPath `
        --specpath $RepoRoot `
        --add-data "${SitePath};site" `
        $LauncherPath
}
finally {
    Pop-Location
}
