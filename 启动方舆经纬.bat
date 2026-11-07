@echo off
chcp 65001 >nul
cd /d %~dp0
echo 方舆经纬 · 读史方舆纪要 —— http://127.0.0.1:8613
start "" http://127.0.0.1:8613/index.html
python -m http.server 8613 --bind 127.0.0.1
