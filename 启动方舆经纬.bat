@echo off
chcp 65001 >nul
cd /d %~dp0
rem 端口 9200：Windows 保留段 8115-9140 会吞掉旧默认 8613
echo 方舆经纬 · 读史方舆纪要 —— http://127.0.0.1:9200
start "" http://127.0.0.1:9200/index.html
python -m http.server 9200 --bind 127.0.0.1
