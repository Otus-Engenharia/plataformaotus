# Envia .env e service-account-key.json para o VPS (plataformaotus)
# Duplo-clique ou: PowerShell -ExecutionPolicy Bypass -File "scripts\upload-env-para-vps.ps1"

$ErrorActionPreference = "Stop"
$vps = "72.60.60.117"
$user = "root"
$dest = "/docker/plataformaotus/backend"
$base = $PSScriptRoot + "\.."

Write-Host "Enviando arquivos para ${user}@${vps}:${dest} ..." -ForegroundColor Cyan

$envPath = Join-Path $base "backend\.env"
$keyPath = Join-Path $base "backend\service-account-key.json"

if (-not (Test-Path $envPath)) {
    Write-Host "ERRO: backend\.env nao encontrado." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $keyPath)) {
    Write-Host "ERRO: backend\service-account-key.json nao encontrado." -ForegroundColor Red
    exit 1
}

# Baixa e abre o .env que está no VPS para revisão
$tempRemoteEnv = Join-Path $base "remote_backend.env"
Write-Host "Baixando backend\.env que já está no VPS para comparação..." -ForegroundColor Cyan
try {
    ssh "${user}@${vps}" "cat ${dest}/.env" > "$tempRemoteEnv"
    Write-Host "Abrindo .env do VPS para revisão..." -ForegroundColor Cyan
    Start-Process notepad "$tempRemoteEnv" -Wait
} catch {
    Write-Host "⚠️ Não foi possível baixar o .env do VPS (talvez não exista ainda)." -ForegroundColor Yellow
}

# Abre o .env local para revisão
Write-Host "Abrindo local backend\.env para revisão..." -ForegroundColor Cyan
Start-Process notepad "$envPath" -Wait

$confirm = Read-Host "Deseja sobrescrever os arquivos no VPS com essa versão? (S/N)"
if ($confirm -notmatch '^[Ss]$') {
    Write-Host "Upload cancelado pelo usuário." -ForegroundColor Yellow
    exit 0
}

# Remove arquivos antigos antes de copiar
Write-Host "Removendo arquivos antigos no VPS..." -ForegroundColor Yellow
ssh "${user}@${vps}" "rm -f ${dest}/.env ${dest}/service-account-key.json"

# Um unico scp = pede senha so uma vez; envia os dois arquivos
scp "$envPath" "$keyPath" "${user}@${vps}:${dest}/"

Write-Host "Reiniciando projeto plataformaotus no VPS..." -ForegroundColor Cyan
ssh "${user}@${vps}" "cd /docker/plataformaotus && docker compose restart plataformaotus-app"

Write-Host "Pronto. Reinicie o projeto plataformaotus no Gerenciador Docker." -ForegroundColor Green

if (Test-Path "$tempRemoteEnv") {
    Remove-Item "$tempRemoteEnv" -ErrorAction SilentlyContinue
}
