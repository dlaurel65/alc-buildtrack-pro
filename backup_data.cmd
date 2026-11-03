@echo off
title BuildTrack Pro - Database Backup
echo ====================================================
echo  BuildTrack Pro - Creating Timestamped Data Backup
echo ====================================================
cd /d "%~dp0"

if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" (
    "%APPDATA%\Antigravity\bin\agy-node.cmd" scripts\backup.js
) else (
    node scripts\backup.js
)

echo.
timeout /t 3 >nul
