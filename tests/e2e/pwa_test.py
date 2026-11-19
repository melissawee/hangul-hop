"""PWA checks: manifest + icons, service worker + offline, install UX, shortcuts, CSP, update flow."""
import _shim  # noqa: F401  (CSP-safe wait_for_function)
import os, re, io, json, time, shutil, socket, subprocess, tempfile, urllib.request
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
from PIL import Image

BASE = os.environ.get("BASE_URL", "http://localhost:3000/")
REPO = Path(__file__).resolve().parents[2]

def get(path):
    with urllib.request.urlopen(urljoin(BASE, path)) as r:
        return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()

# ---------------------------------------------------------------- static checks (no browser)
st, h, body = get("")
html = body.decode()
assert st == 200 and "script-src 'self'" in h["content-security-policy"], "CSP header missing"
assert "frame-ancestors 'none'" in h["content-security-policy"] and h["x-content-type-options"] == "nosniff"
for needle in ('rel="manifest"', 'name="theme-color"', 'rel="apple-touch-icon"', 'viewport-fit=cover',
               'apple-mobile-web-app-capable', 'js/engine.js', 'js/app.js', 'css/styles.css'):
    assert needle in html, f"index.html missing {needle}"
assert "<script>" not in html, "inline scripts would violate the CSP"

st, h, body = get("manifest.webmanifest")
assert h["content-type"].startswith("application/manifest+json") and "max-age=0" in h["cache-control"]
m = json.loads(body)
for k in ("name", "short_name", "start_url", "scope", "display", "background_color", "theme_color", "icons"):
    assert m.get(k), f"manifest.{k} missing"
assert m["display"] == "standalone" and m["short_name"] == "Hangul Hop" and len(m["short_name"]) <= 12
purposes = {}
for icon in m["icons"]:
    s, hh, data = get(icon["src"])
    assert s == 200 and hh["content-type"] == icon["type"] == "image/png", icon
    w, hgt = Image.open(io.BytesIO(data)).size
    assert f"{w}x{hgt}" == icon["sizes"], (icon, w, hgt)
    purposes.setdefault(icon["purpose"], set()).add(w)
assert {192, 512} <= purposes["any"] and {192, 512} <= purposes["maskable"], purposes
# maskable art must be full-bleed (no transparent corners) so Android can mask it
mk = Image.open(io.BytesIO(get("icons/icon-maskable-512.png")[2])).convert("RGBA")
assert all(mk.getpixel(p)[3] == 255 for p in ((0, 0), (511, 0), (0, 511), (511, 511))), "maskable icon must be opaque to the corners"
ap = Image.open(io.BytesIO(get("icons/apple-touch-icon.png")[2]))
assert ap.size == (180, 180) and ap.convert("RGBA").getpixel((0, 0))[3] == 255
route_keys = {"level", "keys", "speed", "lessons", "free"}
for sc in m["shortcuts"]:
    assert sc["url"].startswith("./#") and sc["url"][3:] in route_keys, sc
    assert get(sc["icons"][0]["src"])[0] == 200
sw_text = get("sw.js")[2].decode()
st, h, _ = get("sw.js")
assert "max-age=0" in h["cache-control"] and h.get("service-worker-allowed") == "/", h
precache = re.findall(r"'([^']+)'", re.search(r"const PRECACHE = \[(.*?)\];", sw_text, re.S).group(1))
assert len(precache) >= 10
for p in precache:
    assert get(p if p != "./" else "")[0] == 200, f"precache entry missing: {p}"
print(f"static OK: manifest, {len(m['icons'])} icons (real sizes verified), {len(m['shortcuts'])} shortcuts, {len(precache)} precache files, CSP + headers")

# ---------------------------------------------------------------- browser checks
def new_ctx(b, **kw):
    ctx = b.new_context(**kw)
    ctx.route("**/fonts.*/**", lambda r: r.abort())      # no internet in CI: fonts fall back
    return ctx

def watch(page, bag):
    page.on("pageerror", lambda e: bag.append("pageerror: " + str(e)))
    page.on("console", lambda m_: bag.append("console: " + m_.text) if "Content Security Policy" in m_.text or m_.type == "error" and "net::" not in m_.text and "fonts" not in m_.text else None)

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---- 1. service worker installs, precaches, app still works under the CSP
    ctx = new_ctx(b, viewport={"width": 1000, "height": 900}); pg = ctx.new_page(); errs = []; watch(pg, errs)
    pg.goto(BASE)
    pg.wait_for_function("navigator.serviceWorker.ready.then(r=>!!r.active&&r.active.state==='activated')", timeout=15000)
    info = pg.evaluate("""async()=>{const reg=await navigator.serviceWorker.getRegistration();
      const names=await caches.keys();const shell=names.find(n=>n.startsWith('hangul-hop-shell-'));
      const keys=(await (await caches.open(shell)).keys()).map(r=>new URL(r.url).pathname);
      return {scope:reg.scope,names,keys}}""")
    assert info["scope"].endswith("/") and info["names"], info
    for need in ("/index.html", "/js/app.js", "/js/engine.js", "/css/styles.css", "/manifest.webmanifest", "/icons/icon-192.png"):
        assert need in info["keys"], (need, info["keys"])
    pg.click("#bLessons"); pg.click('.lcard[data-i="0"]'); pg.click("#go")
    pg.wait_for_function("document.querySelector('#target')&&document.querySelector('#target').textContent.length")
    for k in pg.evaluate("t=>decomp(t).map(j=>JAMO2KEY[j])", pg.inner_text("#target")):
        pg.keyboard.press(k["code"])
    pg.wait_for_function("document.querySelectorAll('.dot.done').length===1", timeout=5000)
    assert not errs, errs
    print("service worker active, shell cached, game plays under the CSP (0 violations)")

    # ---- 2. offline: reload + cold navigation + deep link all work with the network off
    pg.click("#logo"); pg.wait_for_selector("#bPlace")
    ctx.set_offline(True)
    pg.reload(); pg.wait_for_selector("#bPlace", timeout=8000)
    assert pg.evaluate("navigator.onLine") is False
    p2 = ctx.new_page(); watch(p2, errs); p2.goto(BASE + "#keys"); p2.wait_for_selector("#sets", timeout=8000)
    assert p2.evaluate("location.hash") == "", "hash should be cleared after routing"
    p3 = ctx.new_page(); p3.goto(BASE + "?utm=offline"); p3.wait_for_selector("#bPlace", timeout=8000)
    p3.click("#bLessons"); p3.click('.lcard[data-i="3"]'); p3.click("#go"); p3.wait_for_selector("#target")   # a lesson runs fully offline
    assert not errs, errs
    ctx.set_offline(False); ctx.close()
    print("offline reload, cold start, ?query URL, deep link and a lesson all work with no network")

    # ---- 3. shortcut deep links (online)
    ctx = new_ctx(b); expect = {"level": "#beg", "keys": "#sets", "speed": "#segT", "lessons": ".lcard", "free": "#box"}
    for hsh, sel in expect.items():
        q = ctx.new_page(); q.goto(BASE + "#" + hsh); q.wait_for_selector(sel, timeout=5000); assert q.evaluate("location.hash") == ""; q.close()
    ctx.close(); print("5 shortcut deep links open the right screens")

    # ---- 4. install button (Android / desktop Chrome flow)
    ctx = new_ctx(b); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_selector("#install", state="attached")
    assert pg.inner_html("#install").strip() == "", "no install UI before the browser offers one"
    pg.evaluate("""()=>{const e=new Event('beforeinstallprompt',{cancelable:true});window.__prompted=0;
        e.prompt=()=>{window.__prompted++};e.userChoice=Promise.resolve({outcome:'accepted'});dispatchEvent(e)}""")
    pg.wait_for_selector("#bInstall"); pg.click("#bInstall")
    pg.wait_for_function("window.__prompted===1 && !document.querySelector('#bInstall')")
    pg.evaluate("dispatchEvent(new Event('appinstalled'))"); pg.wait_for_selector(".toast")
    assert "Installed" in pg.inner_text(".toast"); ctx.close()
    print("install button appears on beforeinstallprompt, triggers the prompt, disappears; appinstalled toast shows")

    # ---- 5. iPhone hint, and nothing when already installed
    ios = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    ctx = new_ctx(b, user_agent=ios, viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_selector(".install-tip"); assert "Add to Home Screen" in pg.inner_text(".install-tip")
    pg.screenshot(path=os.path.join(os.environ.get("TEST_OUT", "test-output"), "pwa_ios_hint.png")); ctx.close()
    ctx = new_ctx(b, user_agent=ios, viewport={"width": 390, "height": 844})
    ctx.add_init_script("""const mm=window.matchMedia.bind(window);window.matchMedia=q=>/display-mode/.test(q)?{matches:true,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}:mm(q);""")
    pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_selector("#bPlace")
    assert pg.inner_html("#install").strip() == "", "installed (standalone) app must not show install hints"; ctx.close()
    ctx = new_ctx(b); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_selector("#bPlace"); assert pg.query_selector(".install-tip") is None; ctx.close()
    print("iPhone shows the Add-to-Home-Screen hint; installed/standalone and desktop do not")

    # ---- 6. update flow: a new service worker waits, user taps Update, app reloads on the new version
    tmp = Path(tempfile.mkdtemp()); shutil.copytree(REPO / "public", tmp / "public"); shutil.copy(REPO / "vercel.json", tmp / "vercel.json")
    with socket.socket() as s: s.bind(("", 0)); port = s.getsockname()[1]
    srv = subprocess.Popen(["node", str(REPO / "scripts" / "serve.mjs")], env={**os.environ, "ROOT": str(tmp), "PORT": str(port)}, stdout=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try: urllib.request.urlopen(f"http://localhost:{port}/").read(); break
            except Exception: time.sleep(.1)
        url = f"http://localhost:{port}/"
        ctx = new_ctx(b); pg = ctx.new_page(); errs = []; watch(pg, errs); pg.goto(url)
        pg.wait_for_function("navigator.serviceWorker.ready.then(r=>!!r.active&&r.active.state==='activated')", timeout=15000)
        old = pg.evaluate("caches.keys().then(k=>k.filter(n=>n.includes('shell')))"); assert len(old) == 1
        assert pg.query_selector(".toast") is None, "no update toast on a first install"
        swp = tmp / "public" / "sw.js"; swp.write_text(re.sub(r"const VERSION = '[^']+'", "const VERSION = 'test-v2'", swp.read_text()))
        pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())")
        pg.wait_for_selector(".toast", timeout=10000); assert "new version" in pg.inner_text(".toast")
        pg.click(".toast button:not(.x)")
        for _ in range(60):
            try:
                names = pg.evaluate("caches.keys()")
                if "hangul-hop-shell-test-v2" in names and old[0] not in names: break
            except Exception: pass
            time.sleep(.25)
        else: raise AssertionError("update never activated")
        pg.wait_for_selector("#bPlace"); assert pg.query_selector(".toast") is None
        assert not errs, errs
        print("update flow: toast appears → Update → new cache active, old cache deleted, page reloaded")
        ctx.close()
    finally:
        srv.terminate(); shutil.rmtree(tmp, ignore_errors=True)
    b.close()
print("ALL PWA TESTS PASSED")
