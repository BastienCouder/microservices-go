#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


GREEN = "\033[32m"
RED = "\033[31m"
RESET = "\033[0m"


@dataclass
class ServiceResult:
    name: str
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    status: str = "PASS"
    exit_code: int = 0


def colorize(value: int, color: str) -> str:
    return f"{color}{value}{RESET}"


def decode_output_lines(lines: list[str]) -> str:
    chunks: list[str] = []
    for line in lines:
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            chunks.append(line)
            continue

        output = payload.get("Output")
        if isinstance(output, str):
            chunks.append(output)

    return "".join(chunks)


def run_service(service_dir: Path) -> ServiceResult:
    result = ServiceResult(name=service_dir.name)
    command = ["go", "test", "-json", "./..."]

    process = subprocess.Popen(
        command,
        cwd=service_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
    )

    raw_lines: list[str] = []
    seen_tests: set[tuple[str, str]] = set()

    assert process.stdout is not None
    for line in process.stdout:
        raw_lines.append(line)
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue

        action = payload.get("Action")
        test_name = payload.get("Test")
        package_name = payload.get("Package", "")
        if not isinstance(test_name, str) or action not in {"pass", "fail", "skip"}:
            continue

        key = (package_name, test_name)
        if key in seen_tests:
            continue
        seen_tests.add(key)

        if action == "pass":
            result.passed += 1
        elif action == "fail":
            result.failed += 1
        else:
            result.skipped += 1

    result.exit_code = process.wait()
    if result.exit_code != 0:
        result.status = "FAIL"
        sys.stdout.write(decode_output_lines(raw_lines))
        if raw_lines and not raw_lines[-1].endswith("\n"):
            sys.stdout.write("\n")

    return result


def print_summary(results: list[ServiceResult]) -> None:
    print()
    print(f"{'Test target':<30} | {'Passed':>6} | {'Failed':>6} | Status")
    print(f"{'-' * 30}-+-{'-' * 6}-+-{'-' * 6}-+------")

    total_passed = 0
    total_failed = 0
    for result in results:
        total_passed += result.passed
        total_failed += result.failed
        status = result.status if result.status == "PASS" else f"{RED}{result.status}{RESET}"
        print(
            f"{result.name:<30} | "
            f"{colorize(result.passed, GREEN):>15} | "
            f"{colorize(result.failed, RED):>15} | "
            f"{status}"
        )

    print()
    print(
        f"Passed tests: {colorize(total_passed, GREEN)} | "
        f"Failed tests: {colorize(total_failed, RED)}"
    )


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    services_dir = root / "services"
    service_dirs = sorted(path for path in services_dir.iterdir() if (path / "go.mod").is_file())

    results: list[ServiceResult] = []
    failed = False

    for service_dir in service_dirs:
        print(f"Testing {service_dir.relative_to(root)}")
        result = run_service(service_dir)
        results.append(result)
        if result.exit_code != 0:
            failed = True

    print_summary(results)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
