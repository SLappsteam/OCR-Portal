#Requires -Version 5.1
<#
.SYNOPSIS
    OCR Portal Deployment Script
.DESCRIPTION
    Deploys the OCR Portal application following the pattern:
    backup -> stop -> deploy -> config swap -> start -> verify -> rollback on failure
.PARAMETER Environment
    Target environment: development, qa, or production
.PARAMETER SkipBackup
    Skip the backup step (not recommended for production)
.PARAMETER SkipDbMigrate
    Skip database migration (prisma db push)
.PARAMETER RollbackTo
    Timestamp of a backup to roll back to (e.g. 20260218-143000)
.EXAMPLE
    .\deploy.ps1 -Environment qa
    .\deploy.ps1 -Environment production
    .\deploy.ps1 -RollbackTo 20260218-143000
#>
param(
    [ValidateSet('development', 'qa', 'production')]
    [string]$Environment = '',

    [switch]$SkipBackup,
    [switch]$SkipDbMigrate,
    [string]$RollbackTo = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Configuration ──────────────────────────────────────────────
$DEPLOY_PATH   = 'E:\OCR-Portal'
$BACKUP_ROOT   = 'E:\OCR-Portal-backups'
$PM2_NAME      = 'ocr-portal-backend'
$BACKEND_PORT  = 3000
$HEALTH_URL    = "http://localhost:$BACKEND_PORT/health"
$HEALTH_TIMEOUT = 30
$TIMESTAMP     = Get-Date -Format 'yyyyMMdd-HHmmss'

# ── Helpers ────────────────────────────────────────────────────
function Write-Step { param([string]$Message) Write-Host "`n>> $Message" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Message) Write-Host "   [OK] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "   [WARN] $Message" -ForegroundColor Yellow }
function Write-Fail { param([string]$Message) Write-Host "   [FAIL] $Message" -ForegroundColor Red }

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function Stop-BackendProcess {
    Write-Step 'Stopping backend...'

    # Use local pm2 from project dependencies
    Push-Location "$DEPLOY_PATH\backend"
    try {
        $pm2List = npx pm2 jlist 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
        $running = $pm2List | Where-Object { $_.name -eq $PM2_NAME -and $_.pm2_env.status -eq 'online' }
        if ($running) {
            npx pm2 stop $PM2_NAME 2>$null
            Write-Ok "Stopped PM2 process '$PM2_NAME'"
            Pop-Location
            return
        }
    } catch {
        # PM2 not yet installed or no processes — fall through to port kill
    }
    Pop-Location

    # Fallback: kill process on port
    $conn = netstat -ano | Select-String ":$BACKEND_PORT\s+.*LISTENING\s+(\d+)"
    if ($conn) {
        $pid = ($conn.Matches[0].Groups[1].Value)
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Ok "Killed process $pid on port $BACKEND_PORT"
    } else {
        Write-Warn "No process found on port $BACKEND_PORT — may already be stopped"
    }
}

function Start-BackendProcess {
    param([string]$Env = '')

    Write-Step 'Starting backend...'
    Push-Location "$DEPLOY_PATH\backend"

    $envFlag = if ($Env) { "--env $Env" } else { '' }
    $cmd = "npx pm2 start ecosystem.config.js $envFlag"
    Invoke-Expression $cmd 2>$null
    Write-Ok "Started via PM2 as '$PM2_NAME' (env: $Env)"

    # Save PM2 process list so it survives reboots
    npx pm2 save 2>$null
    Write-Ok 'PM2 process list saved'

    Pop-Location
}

function Test-HealthCheck {
    Write-Step "Verifying health ($HEALTH_URL)..."
    $deadline = (Get-Date).AddSeconds($HEALTH_TIMEOUT)
    $healthy = $false

    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-RestMethod -Uri $HEALTH_URL -TimeoutSec 5 -ErrorAction Stop
            if ($resp.data.status -eq 'ok') {
                $healthy = $true
                break
            }
            Write-Warn "Health status: $($resp.data.status) (database: $($resp.data.database)) — retrying..."
        } catch {
            Write-Warn "Health check not ready — retrying in 3s..."
        }
        Start-Sleep -Seconds 3
    }

    return $healthy
}

# ── Rollback ───────────────────────────────────────────────────
function Invoke-Rollback {
    param([string]$BackupTimestamp)

    $backupDir = Join-Path $BACKUP_ROOT $BackupTimestamp
    if (-not (Test-Path $backupDir)) {
        Write-Fail "Backup not found: $backupDir"
        Write-Host "Available backups:"
        Get-ChildItem $BACKUP_ROOT -Directory | Sort-Object Name -Descending | Select-Object -First 10 Name
        exit 1
    }

    Write-Step "Rolling back to backup: $BackupTimestamp"
    Stop-BackendProcess

    # Restore backend
    if (Test-Path "$backupDir\backend") {
        # Preserve node_modules and storage data
        $preserve = @('node_modules', 'storage', 'watch', 'logs')
        Get-ChildItem "$DEPLOY_PATH\backend" -Exclude $preserve | Remove-Item -Recurse -Force
        Get-ChildItem "$backupDir\backend" -Exclude $preserve | Copy-Item -Destination "$DEPLOY_PATH\backend" -Recurse -Force
        Write-Ok 'Backend files restored'
    }

    # Restore frontend dist
    if (Test-Path "$backupDir\frontend\dist") {
        Remove-Item "$DEPLOY_PATH\frontend\dist" -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item "$backupDir\frontend\dist" -Destination "$DEPLOY_PATH\frontend\dist" -Recurse
        Write-Ok 'Frontend dist restored'
    }

    # Restore backend .env
    if (Test-Path "$backupDir\backend\.env") {
        Copy-Item "$backupDir\backend\.env" -Destination "$DEPLOY_PATH\backend\.env" -Force
        Write-Ok 'Backend .env restored'
    }

    $rollbackEnv = if ($Environment) { $Environment } else { $env:ENVIRONMENT }
    Start-BackendProcess -Env $rollbackEnv

    if (Test-HealthCheck) {
        Write-Ok "Rollback to $BackupTimestamp succeeded"
    } else {
        Write-Fail "Rollback health check failed — manual intervention required"
        exit 1
    }
}

# ── Handle rollback mode ──────────────────────────────────────
if ($RollbackTo) {
    Invoke-Rollback $RollbackTo
    exit 0
}

# ── Resolve environment ────────────────────────────────────────
if (-not $Environment) {
    $Environment = $env:ENVIRONMENT
    if (-not $Environment) {
        Write-Fail 'No environment specified. Use -Environment param or set ENVIRONMENT system variable.'
        exit 1
    }
}

Write-Host "============================================" -ForegroundColor White
Write-Host "  OCR Portal Deploy — $($Environment.ToUpper())" -ForegroundColor White
Write-Host "  Timestamp: $TIMESTAMP" -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor White

# ── Preflight checks ──────────────────────────────────────────
Write-Step 'Preflight checks...'

if (-not (Test-Path $DEPLOY_PATH)) {
    Write-Fail "Deploy path not found: $DEPLOY_PATH"
    exit 1
}

if (-not (Test-CommandExists 'node')) {
    Write-Fail 'node is not installed or not in PATH'
    exit 1
}

if (-not (Test-CommandExists 'npm')) {
    Write-Fail 'npm is not installed or not in PATH'
    exit 1
}

$envFile = "$DEPLOY_PATH\backend\.env.$Environment"
if (-not (Test-Path $envFile)) {
    Write-Fail "Environment config not found: $envFile"
    exit 1
}

# Check that the template has been filled in (no angle-bracket placeholders)
$placeholders = Select-String -Path $envFile -Pattern '<[A-Z_]+>' -AllMatches
if ($placeholders) {
    Write-Fail "Environment file $envFile still has unfilled placeholders:"
    $placeholders | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow }
    exit 1
}

Write-Ok "Environment file validated: .env.$Environment"

# ── Step 1: Backup ─────────────────────────────────────────────
if (-not $SkipBackup) {
    Write-Step "Creating backup ($TIMESTAMP)..."
    $backupDir = Join-Path $BACKUP_ROOT $TIMESTAMP
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

    # Backup backend (source + dist + config, skip node_modules and storage)
    $backendBackup = Join-Path $backupDir 'backend'
    New-Item -ItemType Directory -Path $backendBackup -Force | Out-Null

    $excludeBackend = @('node_modules', 'storage', 'watch', 'logs')
    Get-ChildItem "$DEPLOY_PATH\backend" -Exclude $excludeBackend |
        Copy-Item -Destination $backendBackup -Recurse -Force

    # Backup frontend dist
    if (Test-Path "$DEPLOY_PATH\frontend\dist") {
        Copy-Item "$DEPLOY_PATH\frontend\dist" -Destination "$backupDir\frontend\dist" -Recurse -Force
    }

    # Backup current .env
    if (Test-Path "$DEPLOY_PATH\backend\.env") {
        Copy-Item "$DEPLOY_PATH\backend\.env" -Destination "$backendBackup\.env" -Force
    }

    Write-Ok "Backup created: $backupDir"

    # Prune old backups (keep last 10)
    $allBackups = Get-ChildItem $BACKUP_ROOT -Directory | Sort-Object Name -Descending
    if ($allBackups.Count -gt 10) {
        $allBackups | Select-Object -Skip 10 | ForEach-Object {
            Remove-Item $_.FullName -Recurse -Force
            Write-Warn "Pruned old backup: $($_.Name)"
        }
    }
} else {
    Write-Warn 'Backup skipped (--SkipBackup)'
}

# ── Step 2: Stop ───────────────────────────────────────────────
Stop-BackendProcess

# ── Step 3: Deploy (pull latest code) ─────────────────────────
Write-Step 'Pulling latest code from git...'
Push-Location $DEPLOY_PATH
try {
    git fetch origin
    git reset --hard origin/master
    Write-Ok 'Code updated from origin/master'
} catch {
    Write-Fail "Git pull failed: $_"
    Pop-Location
    if (-not $SkipBackup) {
        Write-Warn 'Attempting rollback...'
        Invoke-Rollback $TIMESTAMP
    }
    exit 1
}
Pop-Location

# ── Step 4: Config swap ───────────────────────────────────────
Write-Step "Applying config for '$Environment'..."
Copy-Item $envFile -Destination "$DEPLOY_PATH\backend\.env" -Force
Write-Ok "Copied .env.$Environment -> backend/.env"

# Set system-level ENVIRONMENT variable for this process tree
$env:ENVIRONMENT = $Environment
Write-Ok "ENVIRONMENT=$Environment"

# ── Step 5: Build ──────────────────────────────────────────────
Write-Step 'Installing backend dependencies...'
Push-Location "$DEPLOY_PATH\backend"
try {
    npm ci --production=false 2>&1 | Out-Null
    Write-Ok 'Backend npm ci complete'
} catch {
    Write-Fail "Backend npm ci failed: $_"
    Pop-Location
    if (-not $SkipBackup) { Invoke-Rollback $TIMESTAMP }
    exit 1
}

Write-Step 'Generating Prisma client...'
npx prisma generate 2>&1 | Out-Null
Write-Ok 'Prisma client generated'

if (-not $SkipDbMigrate) {
    Write-Step 'Running database migration...'
    try {
        npx prisma db push --accept-data-loss 2>&1
        Write-Ok 'Database migration complete'
    } catch {
        Write-Warn "Database migration issue (may be non-fatal): $_"
    }
}

Write-Step 'Building backend...'
try {
    npm run build 2>&1 | Out-Null
    Write-Ok 'Backend build complete'
} catch {
    Write-Fail "Backend build failed: $_"
    Pop-Location
    if (-not $SkipBackup) { Invoke-Rollback $TIMESTAMP }
    exit 1
}
Pop-Location

Write-Step 'Building frontend...'
Push-Location "$DEPLOY_PATH\frontend"
try {
    # Copy environment-specific frontend config
    $frontendEnvFile = "$DEPLOY_PATH\frontend\.env.$Environment"
    if (Test-Path $frontendEnvFile) {
        Copy-Item $frontendEnvFile -Destination "$DEPLOY_PATH\frontend\.env" -Force
        Write-Ok "Applied frontend .env.$Environment"
    }

    npm ci --production=false 2>&1 | Out-Null
    npm run build 2>&1 | Out-Null
    Write-Ok 'Frontend build complete'
} catch {
    Write-Fail "Frontend build failed: $_"
    Pop-Location
    if (-not $SkipBackup) { Invoke-Rollback $TIMESTAMP }
    exit 1
}
Pop-Location

# ── Step 6: Start ──────────────────────────────────────────────
Start-BackendProcess -Env $Environment

# ── Step 7: Verify ─────────────────────────────────────────────
if (Test-HealthCheck) {
    Write-Ok 'Health check passed'
    Write-Host "`n============================================" -ForegroundColor Green
    Write-Host "  DEPLOY SUCCEEDED — $($Environment.ToUpper())" -ForegroundColor Green
    Write-Host "  Backend:  http://localhost:$BACKEND_PORT" -ForegroundColor Green
    Write-Host "  Health:   $HEALTH_URL" -ForegroundColor Green
    Write-Host "  PM2:      npx pm2 status / npx pm2 logs" -ForegroundColor Green
    Write-Host "  Backup:   $TIMESTAMP" -ForegroundColor Gray
    Write-Host "============================================" -ForegroundColor Green
} else {
    Write-Fail 'Health check FAILED after deploy'
    Write-Warn "Initiating automatic rollback to $TIMESTAMP..."
    Invoke-Rollback $TIMESTAMP
    exit 1
}
