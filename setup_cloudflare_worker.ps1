$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $RepoRoot "edge-api\wrangler.jsonc"
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ApiUrlNotePath = Join-Path $DesktopPath "Naver Trend Maker 10 API 주소.txt"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Convert-OutputToText {
    param([object[]]$Output)
    return ($Output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
}

function Invoke-CommandCapture {
    param(
        [Parameter(Mandatory = $true)][string[]]$Command
    )

    $output = & $Command[0] $Command[1..($Command.Length - 1)] 2>&1
    $text = Convert-OutputToText $output
    if ($LASTEXITCODE -ne 0) {
        throw $text
    }
    if ($text) {
        Write-Host $text
    }
    return $text
}

function Get-D1Database {
    $jsonText = Invoke-CommandCapture @("corepack", "pnpm", "wrangler", "d1", "list", "--json")
    $items = $jsonText | ConvertFrom-Json
    $matches = @($items | Where-Object { $_.name -eq "naver-trend-maker-db" })
    if ($matches.Count -gt 0) {
        return $matches[0]
    }
    return $null
}

function Set-DatabaseIdInConfig {
    param([Parameter(Mandatory = $true)][string]$DatabaseId)

    $content = Get-Content $ConfigPath -Raw
    $updated = [regex]::Replace(
        $content,
        '"database_id"\s*:\s*"[^"]+"',
        "`"database_id`": `"$DatabaseId`"",
        1
    )
    Set-Content -Path $ConfigPath -Value $updated -Encoding UTF8
}

function Test-WranglerLogin {
    $output = & corepack pnpm wrangler whoami 2>&1
    $text = Convert-OutputToText $output
    if ($text) {
        Write-Host $text
    }

    if ($LASTEXITCODE -ne 0) {
        return $false
    }

    if ($text -match "not authenticated|not logged in|CLOUDFLARE_API_TOKEN") {
        return $false
    }

    return $true
}

Push-Location $RepoRoot
try {
    Write-Step "1. pnpm install"
    & corepack pnpm install
    if ($LASTEXITCODE -ne 0) {
        throw "pnpm install failed."
    }

    Write-Step "2. Cloudflare login check"
    if (-not (Test-WranglerLogin)) {
        Write-Host ""
        Write-Host "Cloudflare login is required. The browser login page will open." -ForegroundColor Yellow
        Write-Host "After login, come back to this window and wait for the next step." -ForegroundColor Yellow
        & corepack pnpm wrangler login
        if ($LASTEXITCODE -ne 0) {
            throw "wrangler login failed."
        }

        Write-Host ""
        Write-Host "Checking Cloudflare login again..." -ForegroundColor Cyan
        if (-not (Test-WranglerLogin)) {
            throw "Cloudflare login was not completed. Run this file again after logging in, or set CLOUDFLARE_API_TOKEN."
        }
    }

    Write-Step "3. D1 database check/create"
    $database = Get-D1Database
    if ($null -eq $database) {
        Invoke-CommandCapture @(
            "corepack", "pnpm", "wrangler", "d1", "create", "naver-trend-maker-db",
            "--location", "apac",
            "--binding", "DB",
            "--update-config",
            "--config", "edge-api/wrangler.jsonc"
        ) | Out-Null
        $database = Get-D1Database
    } else {
        Write-Host "Using existing DB: $($database.uuid)" -ForegroundColor Green
        Set-DatabaseIdInConfig -DatabaseId $database.uuid
    }

    if ($null -eq $database) {
        throw "D1 database was not created."
    }

    Write-Step "4. Apply D1 schema"
    & corepack pnpm wrangler d1 execute naver-trend-maker-db --remote --file edge-api/schema.sql
    if ($LASTEXITCODE -ne 0) {
        throw "wrangler d1 execute failed."
    }

    Write-Step "5. Deploy Worker"
    $deployText = Invoke-CommandCapture @("corepack", "pnpm", "wrangler", "deploy", "--config", "edge-api/wrangler.jsonc")
    $workerUrlMatch = [regex]::Match($deployText, 'https://[a-zA-Z0-9._/-]+\.workers\.dev')
    if (-not $workerUrlMatch.Success) {
        throw "Worker URL not found in deploy output."
    }

    $apiBaseUrl = "$($workerUrlMatch.Value.TrimEnd('/'))/v1"
    Write-Step "6. Save API URL note"
    $note = @(
        "아래 주소를 Naver Trend Maker 10 화면의 API 설정에 넣으세요.",
        "",
        $apiBaseUrl,
        "",
        "로컬 앱 주소는 고정입니다:",
        "http://127.0.0.1:32110/sourcing/admin.html"
    ) -join [Environment]::NewLine
    Set-Content -Path $ApiUrlNotePath -Value $note -Encoding UTF8
    Write-Host $note -ForegroundColor Green
    Write-Host ""
    Write-Host "Saved on Desktop: $ApiUrlNotePath" -ForegroundColor Green
}
finally {
    Pop-Location
}
