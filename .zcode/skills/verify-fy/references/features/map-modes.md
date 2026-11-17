# 启动与三模式（舆图 · 形势 · 川渎）

## Sub-features
- boot 封面：`#boot`，`.go`「展卷」按钮（呼吸动画引导首击）
- 底栏三模式切换：舆图（默认）/ 形势 / 川渎，`body` 的 `m-*` class 驱动
- 形势模式：时代轴（唐虞三代→明 九卷），←/→ 翻卷，都城朱印+要地墨签，▶ 自动播放（TTS 旁白）
- 川渎模式：七水沿流（河江淮汉漕盘海），点要邑入其府
- 深链：`#mode=舆图&p=<省id>&fu=<府名>`、`#era=N`

## How to get to it (user POV)
开站先见封面 → 点「展卷」入舆图。底栏切三模式；形势模式底部出现时代卷轴。

## Driving it with control-fy
```bash
python tools/control_fy.py drive index.html --wait "window.map && window.map._loaded"
python tools/control_fy.py screenshot index.html ev.png --wait "window.map && window.map._loaded" --click "#boot .go"
python tools/control_fy.py drive "index.html#mode=形势&era=8" --wait "window.__era===8 || document.body.classList.contains('m-形势')"
```

## Gotchas
- **`#boot` 封面盖着地图**：等 `map._loaded` 后截图只能拍到封面——必须 `--click "#boot .go"`
- `window.__era` 等 var 挂 window（var 非 let），但 app.js 中途崩溃会留 TDZ——判存在用 `typeof`
- 形势自动播放走 TTS：无头环境 TTS 不可用属预期，断言只看卷号与标签
- 深链 hash 变化不触发 reload——drive 每次开新页（CLI 已如此）
