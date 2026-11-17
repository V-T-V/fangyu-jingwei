# 阅读器（原文 · TTS · 夜读）

## Sub-features
- 原文阅读面板：府/县卡片 →「读原文」；跨链接（XL 名录 1,694 地名互跳——州属县入链后实测）
- TTS 朗读：🔊 自当前视口段落起读、逐段高亮跟随，⏹ 停止
- 夜读：☾ 墨色主题（localStorage 记忆）
- 阅读进度条 + 回顶按钮

## How to get to it (user POV)
点府印章 → 卡片 → 读原文；reader 顶栏 ☾/🔊。

## Driving it with control-fy
```bash
# 夜读与 TTS 各有断言页（虚拟时间通道）：
python run_tests.py   # test_night · test_tts 在内
# 证据截图（夜读态）：
python tools/control_fy.py drive "index.html#p=henan&fu=%E5%BC%80%E5%B0%81%E5%BA%9C" --wait "document.getElementById('reader') && document.getElementById('reader').classList.contains('open')"
```

## Gotchas
- 无头环境 `speechSynthesis` 可能空实现——TTS 断言页只验证启停状态机，不验证出声
- 夜读态存 localStorage `fynight`——跨页断言前清存储（fresh profile 的 drive 天然干净）
- reader 打开后 Esc 收起；跨链接点击会预取目标卷——网络慢时给 --timeout
