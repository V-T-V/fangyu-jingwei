.PHONY: lint fix verify test health all

lint:
	python tools/lint.py

fix:
	python tools/lint.py --fix

verify:
	python verify.py

test:
	python run_tests.py

health:
	python tools/health.py

all: lint verify test
	@echo "═══ 全绿 ═══"
