# ============================================================================
# Script: Sincronizar código LOCAL para VPS (ignora GitHub)
# Uso: PowerShell -ExecutionPolicy Bypass -File "scripts\sync-codigo-para-vps.ps1"
# ============================================================================

param(
    [string]$VPS = "72.60.60.117",
    [string]$User = "root",
    [string]$RemotePath = "/docker/plataformaotus"
)

$ErrorActionPreference = "Stop"
$BaseDir = Split-Path -Parent $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SYNC DIRETO PC -> VPS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📁 Origem: $BaseDir" -ForegroundColor Yellow
Write-Host "📡 Destino: ${User}@${VPS}:${RemotePath}" -ForegroundColor Yellow
Write-Host ""

# ============================================================================
# PASSO 1: Preparar diretório temporário limpo
# ============================================================================
Write-Host "PASSO 1: Preparando arquivos para upload..." -ForegroundColor Yellow

$TempDir = "$env:TEMP\plataformaotus-sync-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Cria diretório temporário
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

Write-Host "Copiando arquivos essenciais (exceto node_modules, .git, .env)..." -ForegroundColor Gray

# Lista de arquivos/pastas para copiar
$ItemsToCopy = @(
    "frontend\src",
    "frontend\public",
    "frontend\index.html",
    "frontend\package.json",
    "frontend\vite.config.js",
    "backend\*.js",
    "backend\package.json",
    "backend\scripts",
    "Dockerfile",
    "docker-compose.yaml",
    ".dockerignore",
    ".gitignore"
)

foreach ($Item in $ItemsToCopy) {
    $SourcePath = Join-Path $BaseDir $Item
    
    if (Test-Path $SourcePath) {
        $DestPath = Join-Path $TempDir $Item
        $DestParent = Split-Path $DestPath -Parent
        
        if (!(Test-Path $DestParent)) {
            New-Item -ItemType Directory -Path $DestParent -Force | Out-Null
        }
        
        Copy-Item -Path $SourcePath -Destination $DestPath -Recurse -Force
        Write-Host "  ✓ $Item" -ForegroundColor DarkGray
    }
}

Write-Host "✅ Arquivos preparados em: $TempDir" -ForegroundColor Green
Write-Host ""

# ============================================================================
# PASSO 2: Compactar usando tar do Windows
# ============================================================================
Write-Host "PASSO 2: Compactando arquivos..." -ForegroundColor Yellow

$TempZip = "$env:TEMP\plataformaotus-code-$(Get-Date -Format 'yyyyMMdd-HHmmss').tar.gz"

# Tenta usar tar nativo do Windows 10+
try {
    Push-Location $TempDir
    tar -czf $TempZip *
    Pop-Location
    
    $FileSize = [math]::Round((Get-Item $TempZip).Length / 1MB, 2)
    Write-Host "✅ Arquivo compactado: $FileSize MB" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Tar não disponível, usando método alternativo..." -ForegroundColor Yellow
    $TempZip = $null
}

Write-Host ""

# ============================================================================
# PASSO 3: Fazer backup no VPS
# ============================================================================
Write-Host "PASSO 3: Fazendo backup no VPS..." -ForegroundColor Yellow
Write-Host "ATENÇÃO: Digite a senha do VPS quando solicitado" -ForegroundColor Yellow
Write-Host ""

ssh "${User}@${VPS}" "cd ${RemotePath}/.. ; if [ -d plataformaotus_backup ]; then rm -rf plataformaotus_backup; fi ; cp -r plataformaotus plataformaotus_backup ; echo 'Backup criado'"

Write-Host ""

# ============================================================================
# PASSO 4: Upload do código
# ============================================================================
Write-Host "PASSO 4: Enviando código para o VPS..." -ForegroundColor Yellow

if ($TempZip -and (Test-Path $TempZip)) {
    # Upload via tar.gz
    scp $TempZip "${User}@${VPS}:/tmp/plataformaotus-code.tar.gz"
    $UploadMethod = "tarball"
} else {
    # Upload via rsync ou scp recursivo
    Write-Host "Enviando arquivos via SCP recursivo..." -ForegroundColor Gray
    scp -r "$TempDir\*" "${User}@${VPS}:${RemotePath}/"
    $UploadMethod = "direct"
}

Write-Host "✅ Upload concluído!" -ForegroundColor Green
Write-Host ""

# ============================================================================
# PASSO 5: Extrair e aplicar no VPS
# ============================================================================
Write-Host "PASSO 5: Aplicando código no VPS..." -ForegroundColor Yellow

if ($UploadMethod -eq "tarball") {
    $commands = "cd ${RemotePath} ; " +
                "echo 'Parando containers...' ; " +
                "docker compose down ; " +
                "echo 'Extraindo codigo...' ; " +
                "tar -xzf /tmp/plataformaotus-code.tar.gz -C . ; " +
                "rm /tmp/plataformaotus-code.tar.gz ; " +
                "echo 'Reconstruindo imagem...' ; " +
                "docker compose build --no-cache --build-arg VITE_API_URL='' ; " +
                "echo 'Iniciando containers...' ; " +
                "docker compose up -d ; " +
                "sleep 5 ; " +
                "docker compose ps ; " +
                "docker compose logs --tail=20 plataformaotus-app"
} else {
    $commands = "cd ${RemotePath} ; " +
                "echo 'Parando containers...' ; " +
                "docker compose down ; " +
                "echo 'Reconstruindo imagem...' ; " +
                "docker compose build --no-cache --build-arg VITE_API_URL='' ; " +
                "echo 'Iniciando containers...' ; " +
                "docker compose up -d ; " +
                "sleep 5 ; " +
                "docker compose ps ; " +
                "docker compose logs --tail=20 plataformaotus-app"
}

ssh "${User}@${VPS}" $commands

Write-Host ""

# ============================================================================
# PASSO 6: Limpeza
# ============================================================================
Write-Host "PASSO 6: Limpando arquivos temporários..." -ForegroundColor Yellow

if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
if ($TempZip -and (Test-Path $TempZip)) { Remove-Item -Force $TempZip }

Write-Host "✅ Limpeza concluída!" -ForegroundColor Green
Write-Host ""

# ============================================================================
# FINALIZAÇÃO
# ============================================================================
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ SYNC CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Acesse: https://app.otusengenharia.com" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Dica: Se tiver problemas, o backup está em:" -ForegroundColor Yellow
Write-Host "   ${RemotePath}_backup" -ForegroundColor Yellow
Write-Host ""
