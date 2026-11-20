"""Email sign-in gate: required login that posts to a Google Apps Script URL (mocked here)."""
import _shim  # noqa: F401  (CSP-safe wait_for_function)
import os, json
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3000/")
OUT = os.environ.get("TEST_OUT", "test-output"); os.makedirs(OUT, exist_ok=True)
FAKE = "https://script.google.com/macros/s/AKfycbTEST_123-abc/exec"
CORS = {"access-control-allow-origin": "*"}

def config_js(url=FAKE, contact=""):
    return f"const SIGNUP_URL={json.dumps(url)};const CONTACT_EMAIL={json.dumps(contact)};const CONSENT_VERSION='2026-11-20';"

def make(b, url=FAKE, contact="", replies=None, **kw):
    """context with a fake config.js and a fake Apps Script endpoint. replies: list of ('json',obj)|('abort',) consumed in order, last repeats"""
    ctx = b.new_context(service_workers="block", **kw)
    ctx.route("**/fonts.*/**", lambda r: r.abort())
    ctx.route("**/js/config.js", lambda r: r.fulfill(body=config_js(url, contact), content_type="application/javascript"))
    calls = []; replies = replies or [("json", {"ok": True})]
    def endpoint(route, request):
        calls.append({"method": request.method, "ctype": request.headers.get("content-type", ""), "body": request.post_data})
        rep = replies[min(len(calls) - 1, len(replies) - 1)]
        if rep[0] == "abort": return route.abort()
        route.fulfill(status=200, headers=CORS, content_type="application/json", body=json.dumps(rep[1]))
    ctx.route("https://script.google.com/**", endpoint)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("CSP: " + m.text) if "Content Security Policy" in m.text else None)
    return ctx, pg, calls, errs

def fill(pg, email, consent=True):
    pg.fill("#gEmail", email)
    if consent != pg.is_checked("#gConsent"): pg.click("#gConsent")

with sync_playwright() as p:
    b = p.chromium.launch()

    # 1) gate on, validation, success, remembered, sign-out
    ctx, pg, calls, errs = make(b, viewport={"width": 1000, "height": 900}, contact="hello@example.com")
    pg.goto(BASE); pg.wait_for_selector("#gateForm")
    assert not pg.query_selector("#bLessons"), "game must not be reachable before sign-in"
    assert pg.evaluate("document.activeElement.id") == "gEmail", "desktop: email field focused"
    pg.screenshot(path=os.path.join(OUT, "gate_desktop.png"))
    # typing in the box must not trigger game keys (letters/space/backspace work normally)
    pg.keyboard.type("a b")
    assert pg.input_value("#gEmail") == "a b", pg.input_value("#gEmail"); pg.fill("#gEmail", "")
    fill(pg, "not-an-email"); pg.click("#gGo")
    assert "doesn't look right" in pg.inner_text("#gMsg") and not calls
    fill(pg, "kim@example.com", consent=False); pg.click("#gGo")
    assert "tick the box" in pg.inner_text("#gMsg") and not calls
    # honeypot: bots fill the hidden field and get "in" without anything being sent
    hp_ctx, hp, hp_calls, hp_errs = make(b); hp.goto(BASE); hp.wait_for_selector("#gateForm")
    hp.fill("#gEmail", "bot@spam.com"); hp.click("#gConsent"); hp.evaluate("document.querySelector('#gHp').value='http://x'"); hp.click("#gGo"); hp.wait_for_selector("#bLessons")
    assert not hp_calls, "honeypot sends nothing"; hp_ctx.close()
    # success
    fill(pg, "  Kim@Example.COM ", consent=True); pg.click("#gGo"); pg.wait_for_selector("#bLessons")
    assert len(calls) == 1 and calls[0]["method"] == "POST" and calls[0]["ctype"].startswith("text/plain"), calls
    body = json.loads(calls[0]["body"])
    assert body == {"email": "kim@example.com", "consent": True, "consentVersion": "2026-11-20", "hp": "", "source": BASE.rstrip("/")}, body
    assert "kim@example.com" in pg.inner_text(".who")
    st = json.loads(pg.evaluate("localStorage.getItem('hangulhop')")); assert st["email"] == "kim@example.com" and st["consent"]["v"] == "2026-11-20"
    pg.reload(); pg.wait_for_selector("#bLessons"); assert len(calls) == 1, "remembered: no second request, no gate"
    # play a little, then sign out: progress stays, gate returns, new email works
    pg.evaluate("()=>{const s=JSON.parse(localStorage.getItem('hangulhop'));s.stars={greet:3};localStorage.setItem('hangulhop',JSON.stringify(s))}")
    pg.reload(); pg.wait_for_selector("#bSignOut"); pg.click("#bSignOut"); pg.wait_for_selector("#gateForm")
    st = json.loads(pg.evaluate("localStorage.getItem('hangulhop')")); assert st["email"] is None and st["stars"] == {"greet": 3}, st
    fill(pg, "lee@example.com"); pg.click("#gGo"); pg.wait_for_selector("#bLessons"); assert len(calls) == 2
    assert not errs, errs; ctx.close()

    # 2) server says no / network drops / offline: friendly message, button recovers, retry works
    ctx, pg, calls, errs = make(b, replies=[("json", {"ok": False, "error": "server_error"}), ("abort",), ("abort",), ("json", {"ok": True})])
    pg.goto(BASE); pg.wait_for_selector("#gateForm"); fill(pg, "a@b.co")
    pg.click("#gGo"); pg.wait_for_function("document.querySelector('#gMsg').textContent.length>0")
    assert "try again" in pg.inner_text("#gMsg") and not pg.is_disabled("#gGo") and "hop" in pg.inner_text("#gGo").lower() and not pg.query_selector("#bLessons")
    pg.click("#gGo"); pg.wait_for_function("document.querySelector('#gMsg').textContent.length>0 && !document.querySelector('#gGo').disabled")
    assert json.loads(pg.evaluate("localStorage.getItem('hangulhop')") or "{}").get("email") in (None,), "failed attempts never log you in"
    ctx.set_offline(True); pg.click("#gGo"); pg.wait_for_function("document.querySelector('#gMsg').textContent.includes('offline')"); ctx.set_offline(False)
    pg.click("#gGo"); pg.wait_for_selector("#bLessons")
    assert len(calls) == 4, len(calls); ctx.close()

    # 3) app-icon shortcut survives the gate (#keys opens Key Practice after sign-in)
    ctx, pg, calls, errs = make(b); pg.goto(BASE + "#keys"); pg.wait_for_selector("#gateForm")
    fill(pg, "k@x.io"); pg.click("#gGo"); pg.wait_for_selector("#sets"); assert pg.evaluate("location.hash") == ""; ctx.close()

    # 4) gate stays OFF when the URL is empty or not a script.google.com web-app URL
    for url in ("", "http://evil.example/x", "https://script.google.com/macros/s/ABC/exec?x=1", "https://evil.com/macros/s/ABC/exec", "javascript:alert(1)"):
        ctx, pg, calls, errs = make(b, url=url); pg.goto(BASE); pg.wait_for_selector("#bLessons"); assert not pg.query_selector("#gateForm"), url; ctx.close()

    # 5) privacy page: link target, contact filled from config, empty contact has a fallback
    ctx, pg, calls, errs = make(b, contact="hello@example.com"); pg.goto(BASE); pg.wait_for_selector("#gateForm")
    link = pg.query_selector("#gateForm a"); assert link.get_attribute("target") == "_blank" and "noopener" in link.get_attribute("rel") and link.get_attribute("href") == "privacy.html"
    pg.goto(BASE + "privacy.html"); pg.wait_for_selector("#contact a"); assert pg.get_attribute("#contact a", "href") == "mailto:hello@example.com"
    assert "13 or older" in pg.inner_text(".legal") and "email address" in pg.inner_text(".legal"); pg.screenshot(path=os.path.join(OUT, "privacy.png"))
    assert not errs, errs; ctx.close()
    ctx, pg, calls, errs = make(b, contact="not an email<script>"); pg.goto(BASE + "privacy.html"); pg.wait_for_selector("#contact")
    assert "contact the person" in pg.inner_text("#contact") and not pg.query_selector("#contact a"); ctx.close()

    # 6) phone: typing through the on-screen browser keyboard flow, no overflow, field not hidden
    for name, w, h in (("se", 375, 667), ("iphone", 390, 844)):
        ctx, pg, calls, errs = make(b, viewport={"width": w, "height": h}, has_touch=True, is_mobile=True, device_scale_factor=2)
        pg.goto(BASE); pg.wait_for_selector("#gateForm")
        assert pg.evaluate("document.documentElement.scrollWidth") <= w, name
        assert pg.evaluate("document.activeElement.id") != "gEmail", "phone: don't pop the keyboard before the player taps"
        pg.tap("#gEmail"); pg.keyboard.type("tiny@bunny.com"); pg.tap("#gConsent"); pg.screenshot(path=os.path.join(OUT, f"gate_{name}.png"))
        pg.tap("#gGo"); pg.wait_for_selector("#bLessons"); assert json.loads(calls[0]["body"])["email"] == "tiny@bunny.com"
        assert pg.evaluate("document.documentElement.scrollWidth") <= w; assert not errs, errs; ctx.close()
    b.close()
print("ALL LOGIN TESTS PASSED")
