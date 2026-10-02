@echo off
rem Runs your own copy of the dashboard on this PC (see start-local.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
pause
