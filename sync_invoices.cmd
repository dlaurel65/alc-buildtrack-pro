@echo off
title Sync Invoices from Outlook
echo Connecting to Outlook and checking for billing invoices...
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\sync_outlook_invoices.ps1" 
pause
