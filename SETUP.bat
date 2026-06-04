@echo off
title RMD Intelligent Agent - Setup
color 0A
echo.
echo  Starting RMD Agent Setup...
echo  Please wait, do not close this window.
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0SETUP.ps1"
