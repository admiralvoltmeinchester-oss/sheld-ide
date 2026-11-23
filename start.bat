@echo off
title Sheld! AI Studio
cd /d "%~dp0"
start "" "http://localhost:3456"
node server.js
pause
