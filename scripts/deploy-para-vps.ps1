# Deploy completo para VPS Hostinger
# Faz commit, push, pull no VPS, rebuild e restart
# Uso: PowerShell -ExecutionPolicy Bypass -File "scripts\deploy-para-vps.ps1"

param(
    [string]$CommitMessage = "Deploy via script"
)

$ErrorActionPreference = "Stop"
$vps = "72.60.60.117"
$user = "root"
$projectPath = "/docker/plataformaotus"
$base = $PSScriptRoot + "\.."

# ============================================================================
# VALIDAÇÃO: Garantir que estamos no branch main
# ============================================================================
cd $base
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "ERRO: Deploy só pode ser feito a partir do branch 'main'!" -ForegroundColor Red
    Write-Host "Branch atual: $currentBranch" -ForegroundColor Red
    Write-Host ""
    Write-Host "Para fazer deploy, primeiro faça merge de develop para main:" -ForegroundColor Yellow
    Write-Host "  git checkout main" -ForegroundColor Gray
    Write-Host "  git pull origin main" -ForegroundColor Gray
    Write-Host "  git merge --no-ff develop" -ForegroundColor Gray
    Write-Host "  git push origin main" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY PARA VPS HOSTINGER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# PASSO 1: Git Local (Commit e Push)
# ============================================================================
Write-Host "PASSO 1: Commit e Push das mudanças locais..." -ForegroundColor Yellow
Write-Host ""

cd $base

# Verifica se há mudanças
$status = git status --porcelain
if ($status) {
    Write-Host "Mudanças detectadas:" -ForegroundColor Green
    git status --short
    Write-Host ""
    
    $confirm = Read-Host "Deseja fazer commit dessas mudanças? (S/N)"
    if ($confirm -match '^[Ss]$') {
        git add .
        git commit -m "$CommitMessage"
        Write-Host "Commit realizado!" -ForegroundColor Green
    }
} else {
    Write-Host "Nenhuma mudança local para commitar." -ForegroundColor Gray
}

Write-Host "Fazendo push para o GitHub..." -ForegroundColor Cyan
git push
Write-Host "Push concluído!" -ForegroundColor Green
Write-Host ""

# ============================================================================
# PASSO 2: Deploy no VPS
# ============================================================================
Write-Host "PASSO 2: Deploy no VPS..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Conectando ao VPS ${user}@${vps}..." -ForegroundColor Cyan
Write-Host "IMPORTANTE: Você precisará digitar a senha do VPS" -ForegroundColor Yellow
Write-Host ""

# Comandos a serem executados no VPS (em uma única sessão SSH)
$vpsCommands = @"
echo '===================================='
echo 'Navegando para o diretório do projeto...'
cd $projectPath || exit 1

echo ''
echo 'Fazendo pull do código atualizado...'
git fetch origin
git reset --hard origin/main
git pull origin main

echo ''
echo 'Parando containers antigos...'
docker compose down

echo ''
echo 'Fazendo rebuild da imagem Docker...'
docker compose build --no-cache

echo ''
echo 'Iniciando containers...'
docker compose up -d

echo ''
echo 'Aguardando 5 segundos para o container iniciar...'
sleep 5

echo ''
echo 'Verificando status dos containers...'
docker compose ps

echo ''
echo 'Últimas 20 linhas do log:'
docker compose logs --tail=20 plataformaotus-app

echo ''
echo '===================================='
echo 'Deploy concluído!'
echo '===================================='
"@

# Executa os comandos no VPS
ssh "${user}@${vps}" "$vpsCommands"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOY CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Acesse: https://app.otusengenharia.com" -ForegroundColor Cyan
Write-Host ""
