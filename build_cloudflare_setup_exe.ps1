$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkspaceRoot = Split-Path -Parent $RepoRoot
$PythonExe = Join-Path $WorkspaceRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

Push-Location $RepoRoot
try {
    & $PythonExe -m pip install pyinstaller

    $LauncherPath = Join-Path $RepoRoot "cloudflare_setup_launcher.py"
    $DesktopPath = [Environment]::GetFolderPath("Desktop")
    $WorkPath = Join-Path $RepoRoot "build_cloudflare_setup_exe"

    & $PythonExe -m PyInstaller `
        --noconfirm `
        --clean `
        --onefile `
        --console `
        --name "Naver Trend Maker 10 Cloudflare 연결" `
        --distpath $DesktopPath `
        --workpath $WorkPath `
        --specpath $RepoRoot `
        $LauncherPath
}
finally {
    Pop-Location
}
