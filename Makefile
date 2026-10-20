.DEFAULT_GOAL := help
.PHONY: dev stop restart status logs help

dev stop restart status logs:
	@python3 scripts/local-dev.py $@

help:
	@echo 'make dev      启动前后端并打开浏览器（后台运行）'
	@echo 'make stop     停止本脚本启动的服务'
	@echo 'make restart  重编译后端并重启；前端修改自动热更新'
	@echo 'make status   查看运行状态、地址和数据目录'
	@echo 'make logs     持续查看日志；Ctrl+C 仅退出日志'
