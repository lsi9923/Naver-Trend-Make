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
    $BuildStartedAt = Get-Date
    $CloudflareConnectSuffix = -join (
        [char]0x0043, [char]0x006C, [char]0x006F, [char]0x0075, [char]0x0064, [char]0x0066, [char]0x006C, [char]0x0061, [char]0x0072, [char]0x0065,
        [char]0x0020,
        [char]0xC5F0, [char]0xACB0
    )
    $ExeName = "Naver Trend Maker 10 $CloudflareConnectSuffix"

    & $PythonExe -m PyInstaller `
        --noconfirm `
        --clean `
        --onefile `
        --console `
        --name $ExeName `
        --distpath $DesktopPath `
        --workpath $WorkPath `
        --specpath $RepoRoot `
        $LauncherPath

    $ExpectedExePath = Join-Path $DesktopPath "$ExeName.exe"
    $NewestExe = Get-ChildItem -LiteralPath $DesktopPath -File -Filter "Naver Trend Maker 10 Cloudflare*.exe" |
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
}
