@echo off
REM Envia .env e service-account-key para o VPS.
REM Duplo-clique neste arquivo.

cd /d "%~dp0.."
powershell -ExecutionPolicy Bypass -File "scripts\upload-env-para-vps.ps1"
pause
