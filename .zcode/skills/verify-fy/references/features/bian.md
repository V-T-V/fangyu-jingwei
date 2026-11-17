# 九边专题

## Sub-features
- ⚔ 九边底栏入口：明代九边防线专题面板
- 图上观九边全线：嘉峪关→山海关 红色虚线横贯
- 诸镇分述：辽东·蓟州·宣府·大同·山西·延绥·宁夏·固原·甘肃

## How to get to it (user POV)
底栏点「⚔ 九边」。

## Driving it with control-fy
```bash
python run_tests.py    # test_bian 断言
python tools/control_fy.py screenshot index.html ev-bian.png \
  --wait "window.map && window.map._loaded" --click "#boot .go"
# 九边线是矢量层 frontier——瓦片断供时依然可见（绢底降级不影响）
```

## Gotchas
- 九边线画在矢量层——底图瓦片失败时**仍应可见**（截图验证绢底降级模式的最佳标的）
- 面板文案含镇名与卷次——改文案跑 lint（版本一致性）+ test_bian
