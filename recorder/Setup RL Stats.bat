@echo off
rem Sets up RL Stats (safe to run again) and starts the widget.
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File "%~dp0Setup.ps1"
