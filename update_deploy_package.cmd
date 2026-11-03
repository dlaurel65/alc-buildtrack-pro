@echo off
title BuildTrack Pro - Update Cloud Deployment Package
echo ========================================================
echo   Updating Cloud Deployment Folder and ZIP Package...
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\make_zip.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\extract_deploy.ps1"
echo.
echo [SUCCESS] render_deploy_folder and BuildTrack_Pro_Cloud_Deploy.zip are now up to date!
explorer.exe "%~dp0render_deploy_folder"
pause
