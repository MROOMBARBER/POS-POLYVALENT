@echo off
title MAMOUN POS - AGENT TIROIR CAISSE
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Agent-Tiroir.ps1"
echo.
pause
