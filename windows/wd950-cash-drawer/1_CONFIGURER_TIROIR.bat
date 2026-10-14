@echo off
title MAMOUN POS - Configurer Tiroir Caisse
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Configurer-Tiroir.ps1"
echo.
pause
