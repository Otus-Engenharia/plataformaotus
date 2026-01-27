@echo off
REM Script para testar OKRs e Indicadores
REM Requer: Backend rodando

echo.
echo ========================================
echo Testando OKRs e Indicadores
echo ========================================
echo.

cd /d "%~dp0.."
node scripts/testar-okrs-indicadores.js

pause
