@echo off
REM Deploy completo para VPS Hostinger
REM Duplo-clique para executar

cd /d "%~dp0"
PowerShell -ExecutionPolicy Bypass -File "deploy-para-vps.ps1"
pause
