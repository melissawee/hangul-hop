#!/usr/bin/env python3
"""Starts the local server (with the Vercel headers) and runs every test suite.

    python3 tests/e2e/run_all.py          # or: npm run test:e2e

Needs: node, python3, `pip install playwright pillow`, `playwright install chromium`.
Screenshots land in ./test-output/.
"""
import os, subprocess, sys, time, socket, urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
with socket.socket() as s: s.bind(("", 0)); port = s.getsockname()[1]
base = f"http://localhost:{port}/"
srv = subprocess.Popen(["node", str(REPO / "scripts" / "serve.mjs")], env={**os.environ, "PORT": str(port)}, stdout=subprocess.DEVNULL)
failed = []
try:
    for _ in range(50):
        try: urllib.request.urlopen(base).read(); break
        except Exception: time.sleep(.1)
    suites = ["pwa_test.py", "trail_test.py", "warmup_test.py", "login_test.py", "lessons_test.py", "phone_test.py", "placement_test.py", "keypractice_test.py"]
    only = sys.argv[1:]
    for name in suites:
        if only and name not in only: continue
        print(f"\n=== {name} ===", flush=True)
        r = subprocess.run([sys.executable, str(HERE / name)], env={**os.environ, "BASE_URL": base}, cwd=REPO)
        if r.returncode: failed.append(name)
finally:
    srv.terminate()
print("\n" + ("FAILED: " + ", ".join(failed) if failed else "ALL E2E SUITES PASSED"))
sys.exit(1 if failed else 0)
