@echo off
rem Starts the RL Stats widget without a console window.
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File "%~dp0RLStatsWidget.ps1"
