"""Test helper: makes Playwright's page.wait_for_function work on pages with a strict
Content-Security-Policy.

Playwright polls with eval(), which the app's CSP (script-src 'self', no 'unsafe-eval') rightly forbids.
We keep the CSP enforced in the tests (so violations are caught) and poll with page.evaluate instead.
Imported for its side effect by every suite.
"""
import re, time
from playwright.sync_api import Page, TimeoutError as PWTimeout

def _wait_for_function(self, expression, arg=None, timeout=30000, polling=None):
    limit = time.time() + (30000 if timeout is None else timeout) / 1000
    last = None
    is_fn = bool(re.match(r'^\s*(async\s*)?(\([^)]*\)|[\w$]+)\s*=>', expression)) or expression.lstrip().startswith('function')
    while True:
        try:
            if is_fn:
                ok = self.evaluate("async a=>!!(await (" + expression + ")(a))", arg)
            else:
                ok = self.evaluate("async()=>!!(await (" + expression + "))")
            if ok:
                return True
        except Exception as e:          # e.g. the page is mid-navigation
            last = e
        if time.time() > limit:
            raise PWTimeout(f"wait_for_function timed out: {expression[:90]} ({last})")
        time.sleep(0.05)

Page.wait_for_function = _wait_for_function
