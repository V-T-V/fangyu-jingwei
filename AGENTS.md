# 方舆经纬 · Agent 开发指南

> 本文件是信任金字塔的最底层（文字指令）。上层的 lint / 测试 / 哨兵是确定性的——
> 当本文件与 lint 冲突时，**lint 是对的**。修 lint，不是绕 lint。

## 快速开始

```bash
python -m http.server 9200 &          # 起本地服务
python tools/lint.py                   # 11 类确定性检查（先跑这个）
python verify.py                       # 数据完整性
python run_tests.py                    # 全套回归（含 lint · 14 页 · 哨兵 · CLI）
```

## 架构（目录即上下文）

```
index.html · 3d.html        # 两个世界（入口）
js/                          # 前端模块（defer 链有严格顺序——lint 校验）
  config → map → panels → rail → search → reader → bookmarks → fulltext → app → modes → analytics → wenxin → bian
data/
  site_data.js               # 结构化数据（build_data.py 生成，勿手改）
  mentions.js                # 府名被引（build_mentions.py 生成）
  text/*.js                  # 260 万字全文（懒加载，18 文件）
vendor/                      # Leaflet + MapLibre（自托管）
tests/                       # 断言页（14 页）+ pose 页
tools/                       # lint · 哨兵 · 健康检查
docs/                        # 论文 PDF · 配套数据 · 截图
```

## 禁止清单（lint 会拒绝，不要浪费时间写然后再改）

| 禁止 | 原因 | 替代 |
|---|---|---|
| `map.fire("click", ...)` | 委托分发不可靠 | `canvas.dispatchEvent(new MouseEvent(...))` |
| `innerHTML.indexOf("...")` 验证 | `&` 序列化为 `&amp;` | `element.textContent` 或 `.href` |
| `window._ftw` 访问闭包量 | `let` 不在 window 上 | 用 `ftWorkerProgress()` 等存取函数 |
| `git mv -q` | flag 不存在 | 去掉 `-q` |
| Worker 中引用 `document/window` | Worker 无 DOM | 纯数据计算 + `postMessage` |
| 核心模块引用特性模块 DOM ID | 架构分层 | 用 `typeof` 守卫回调 |
| 版本号手列清单 bump | 教训 13 | `glob` 全站 `?v=` |

## 数据纪律

- **凡数字必出自脚本**（`paper_stats.js`）——视觉读图不作数据源
- **凡语料必同一口径**（`data/text/*.js` 纯文本，不含 JS 键名）
- 修改 `data/site_data.js` 前先跑 `python build_data.py`（管线可重入）
- 改 `ANALYSIS.md` 后必须跑 `python docs/build_paper_pdf.py`（哨兵会拦）

## 版本 bump

```bash
# 全站版本号一步到位（lint 会校验一致性）
sed -i 's/?v=OLD/?v=NEW/g' index.html sw.js 3d.html tests/*.html
sed -i 's/VERSION = "vOLD"/VERSION = "vNEW"/' sw.js
```

## 发版

```bash
git tag -a vN.N.N -m "描述"
git push origin main vN.N.N
gh release create vN.N.N --title "..." --notes "..." [附件]
```
