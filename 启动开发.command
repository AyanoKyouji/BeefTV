#!/bin/bash
cd "$(dirname "$0")" || exit 1
python3 scripts/local-dev.py dev
result=$?
if [ "$result" -ne 0 ]; then
  read -r -p "启动失败，按回车关闭窗口。"
fi
exit "$result"
