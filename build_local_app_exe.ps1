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

    & $PythonExe -m pip install pyinstaller openpyxl

    $LauncherPath = Join-Path $RepoRoot "local_app_launcher.py"
    $SitePath = Join-Path $RepoRoot "web\.next-prod"
    $DesktopPath = [Environment]::GetFolderPath("Desktop")
    $WorkPath = Join-Path $RepoRoot "build_local_app_exe"
    $BuildStartedAt = Get-Date
    $LocalVersionSuffix = -join ([char]0xB85C, [char]0xCEEC, [char]0xBC84, [char]0xC804)
    $ExeName = "Naver Trend Maker 10 $LocalVersionSuffix"

    & $PythonExe -m PyInstaller `
        --noconfirm `
        --clean `
        --onefile `
        --windowed `
        --name $ExeName `
        --distpath $DesktopPath `
        --workpath $WorkPath `
        --specpath $RepoRoot `
        --add-data "${SitePath};site" `
        $LauncherPath

    $ExpectedExePath = Join-Path $DesktopPath "$ExeName.exe"
    $NewestExe = Get-ChildItem -LiteralPath $DesktopPath -File -Filter "Naver Trend Maker 10*.exe" |
        Where-Object { $_.LastWriteTime -ge $BuildStartedAt.AddMinutes(-1) } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($NewestExe -and $NewestExe.FullName -ne $ExpectedExePath) {
        Copy-Item -LiteralPath $NewestExe.FullName -Destination $ExpectedExePath -Force
        Remove-Item -LiteralPath $NewestExe.FullName -Force
    }
}
finally {
    Pop-Location
    Remove-Item Env:\NEXT_PUBLIC_API_BASE_URL -ErrorAction SilentlyContinue
}
