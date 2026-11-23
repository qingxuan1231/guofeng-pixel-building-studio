@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在打开「国风古建像素工坊」...
start "" "%~dp0index.html"
