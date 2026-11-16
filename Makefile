.PHONY: lint verify test health all

lint:
	python tools/lint.py

verify:
	python verify.py

test:
	python run_tests.py

health:
	python tools/health.py

all: lint verify test
	@echo "═══ 全绿 ═══"
