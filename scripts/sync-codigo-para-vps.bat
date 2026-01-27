@echo off
REM Sincroniza código LOCAL para VPS (ignora GitHub)
REM Duplo-clique para executar

cd /d "%~dp0"
PowerShell -ExecutionPolicy Bypass -File "sync-codigo-para-vps.ps1"
pause
