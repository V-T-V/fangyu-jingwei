# -*- coding: utf-8 -*-
"""无头浏览器收尸（教训 9 共享版，自 run_tests.py 内联实现抽出）

terminate() 只杀浏览器主进程，Windows 上 msedge 子进程会存活——尸体吃 CPU
会让下一轮 CDP 假超时。各 CDP 探针 finally 统一调 reap_browser(proc, port)：
  win32 : PowerShell 杀命令行带 headless 标记的 msedge
          （子进程命令行不含 remote-debugging-port，只能按 headless 标记兜住）
  POSIX : pkill 精确匹配本探针的 remote-debugging-port（并行会话不受扰）
幂等：proc 为 None 或已退出均安全；异常退出路径同样收尸。
"""
import subprocess
import sys


def reap_browser(proc, port=9333):
    """terminate 主进程 + 平台级清无头残留。各 CDP 探针 finally 调用。"""
    if proc is not None:
        try:
            proc.terminate()
        except OSError:
            pass                       # 进程已自行退出
    if sys.platform == "win32":
        subprocess.run(["powershell", "-NoProfile", "-Command",
                        "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | "
                        "Where-Object {$_.CommandLine -like '*headless*'} | "
                        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"],
                       capture_output=True, timeout=30)
    else:
        subprocess.run(["pkill", "-f", "remote-debugging-port=%d" % port],
                       capture_output=True, timeout=15)
