@echo off
title Automated Logic - BuildTrack Pro
cd /d "%~dp0"

echo ==========================================================
echo        AUTOMATED LOGIC - BUILDTRACK PRO
echo       Controls & Building Automation Project Manager
echo ==========================================================
echo.

:: Auto-snapshot database before start
if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" (
    "%APPDATA%\Antigravity\bin\agy-node.cmd" scripts\backup.js
) else (
    node scripts\backup.js
)

echo.
echo Launching Web Interface at http://localhost:3000 ...
start http://localhost:3000

echo.
echo ==========================================================
echo  LIVE SHARING LINKS:
echo  1. Your Computer:       http://localhost:3000
echo  2. Share on same Wi-Fi: http://192.168.1.175:3000
echo.
echo  Keep this window open to keep the tool live for others!
echo  Press Ctrl+C to stop sharing and shut down.
echo ==========================================================
echo.

if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" (
    "%APPDATA%\Antigravity\bin\agy-node.cmd" server.js
) else (
    node server.js
)
pause
