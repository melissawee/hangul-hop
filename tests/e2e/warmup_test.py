"""Warm-ups: every lesson has a 3-step warm-up (find keys -> build blocks -> type words)."""
import _shim  # noqa: F401  (CSP-safe wait_for_function)
import os, json
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3000/")
OUT = os.environ.get("TEST_OUT", "test-output"); os.makedirs(OUT, exist_ok=True)

def press(pg, j, touch=False):
    k = pg.evaluate("j=>JAMO2KEY[j]", j)
    if touch:
        if k["shift"]: pg.tap(".shiftk", force=True)
        pg.tap(f'.key[data-code="{k["code"]}"]', force=True)
    else:
        if k["shift"]: pg.keyboard.down("Shift")
        pg.keyboard.press(k["code"])
        if k["shift"]: pg.keyboard.up("Shift")

def cur_step(pg): return pg.evaluate("document.querySelector('.wstep.cur')?.dataset.k")

def play_warmup(pg, touch=False, slip_at=None, log=None):
    """plays all 3 steps. slip_at=(step,index) presses a wrong key first. returns {step: [targets]}"""
    seen = {0: [], 1: [], 2: []}; idx = {0: 0, 1: 0, 2: 0}
    while True:
        if pg.query_selector("#go.big") and pg.query_selector(".bigstars"): return seen
        pg.wait_for_function("document.querySelector('.bigstars') || (document.querySelector('.wstep.cur') && (document.querySelector('#kp').textContent.length>0 || document.querySelector('#target').textContent.length>0))")
        if pg.query_selector(".bigstars"): return seen
        step = int(cur_step(pg)); r = idx[step]
        if step == 0:
            tgt = pg.inner_text("#kp"); seen[0].append(tgt)
            if slip_at == (0, r):
                wrong = pg.evaluate("j=>Object.keys(KEY).find(c=>KEY[c][0]!==j&&c!==JAMO2KEY[j].code)", tgt)
                pg.keyboard.press(wrong) if not touch else pg.tap(f'.key[data-code="{wrong}"]', force=True)
                pg.wait_for_function("document.querySelector('#hint').textContent.includes('Look for')")
            press(pg, tgt, touch)
            pg.wait_for_function("document.querySelector('.bigstars') || document.querySelector('#hint').textContent.includes('lives on')")
        else:
            kr = pg.inner_text("#target"); seen[step].append(kr)
            jamo = pg.evaluate("t=>decomp(t)", kr)
            for n, j in enumerate(jamo):
                if slip_at == (step, r) and n == 1:
                    wrong = pg.evaluate("j=>Object.keys(KEY).find(c=>KEY[c][0]!==j&&KEY[c][1]!==j&&c!==JAMO2KEY[j].code)", j)
                    pg.keyboard.press(wrong) if not touch else pg.tap(f'.key[data-code="{wrong}"]', force=True)
                    pg.wait_for_function("document.querySelector('#hint').textContent.includes('Almost')")
                    assert pg.query_selector(".key.next"), "wrong key should reveal the right key"
                press(pg, j, touch)
        idx[step] += 1
        # wait until the screen moves on to the next prompt / step / result
        pg.wait_for_function("([s,r])=>{if(document.querySelector('.bigstars'))return true;const c=document.querySelector('.wstep.cur');if(!c)return false;const k=+c.dataset.k;const n=document.querySelector('#cnt').textContent;return k!==s||n!==(r+1)+'/'+n.split('/')[1]}", [step, r], timeout=8000)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1000, "height": 900}); ctx.route("**/fonts.*/**", lambda r: r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.goto(BASE)

    # 1) EVERY lesson intro offers a warm-up (incl. sentence levels that have no new keys)
    pg.click("#bLessons"); pg.wait_for_selector(".node")
    for i in (0, 8, 11, 14, 20, 26, 28):
        pg.click(f'.node[data-i="{i}"]'); pg.wait_for_selector("#warm")
        assert "Warm up" in pg.inner_text("#warm"), i
        pg.click("#back"); pg.wait_for_selector(".node"); pg.wait_for_timeout(300)

    # 2) lesson 1 (20 new keys): full warm-up, with a slip in each step
    pg.click('.node[data-i="0"]'); pg.wait_for_selector("#warm"); assert "nudge" in pg.get_attribute("#warm", "class")
    pg.click("#warm"); pg.wait_for_selector("#kp")
    assert pg.eval_on_selector_all(".wstep", "e=>e.length") == 3 and cur_step(pg) == "0" and "Find the keys" in pg.inner_text("#wb")
    assert pg.inner_text("#cnt") == "1/14", pg.inner_text("#cnt")
    pg.screenshot(path=os.path.join(OUT, "warm_keys.png"))
    # step 2 look: syllable hints are on
    seen = {0: [], 1: [], 2: []}
    # play step 1 only far enough to move on, checking the other steps' UI along the way
    for _ in range(14):
        t = pg.inner_text("#kp"); press(pg, t); pg.wait_for_function("document.querySelector('#hint').textContent.includes('lives on')")
        pg.wait_for_function("([t,c])=>document.querySelector('#cnt').textContent!==c || document.querySelector('.wstep.cur').dataset.k!=='0'", [t, pg.inner_text("#cnt")], timeout=5000)
    assert cur_step(pg) == "1" and "Build blocks" in pg.inner_text("#wb")
    assert pg.evaluate("getComputedStyle(document.querySelector('#kp')).display") == "none"
    pg.wait_for_selector("#target"); tgt = pg.inner_text("#target"); assert len(tgt) == 1
    assert pg.query_selector(".key.next") and "Next:" in pg.inner_text("#hint"), "step 2 shows hints"
    for j in pg.evaluate("t=>decomp(t)", tgt): press(pg, j)
    pg.wait_for_function("document.querySelector('#cnt').textContent.startsWith('2/')", timeout=5000)
    pg.keyboard.press("Escape"); pg.wait_for_selector("#warm"); assert "Hello" in pg.inner_text("h2")   # Esc leaves
    assert not pg.query_selector(".note:has-text('Warmed up')"), "quitting early doesn't count"

    # 3) three different lessons, start to finish (desktop, real keys), with slips
    for i, slip in ((0, (1, 1)), (8, (2, 0)), (14, (0, 2)), (28, (2, 1))):
        pg.click("#back") if pg.query_selector("#back") and not pg.query_selector("#warm") else None
        if not pg.query_selector("#warm"):
            pg.goto(BASE); pg.click("#bLessons"); pg.wait_for_selector(".node"); pg.click(f'.node[data-i="{i}"]'); pg.wait_for_selector("#warm")
        else:
            pg.click("#back"); pg.wait_for_selector(".node"); pg.click(f'.node[data-i="{i}"]'); pg.wait_for_selector("#warm")
        pg.click("#warm"); pg.wait_for_selector("#kp")
        seen = play_warmup(pg, slip_at=slip)
        assert len(seen[0]) >= 8 and 3 <= len(seen[1]) <= 8 and 3 <= len(seen[2]) <= 4, {k: len(v) for k, v in seen.items()}
        assert all(len(x) == 1 for x in seen[1]), "step 2 is single blocks"
        if i >= 11: assert any(" " in x for x in seen[2]), "sentence levels practise Space"
        assert "warmed up" in pg.inner_text(".rank").lower() or "let's go" in pg.inner_text(".rank").lower()
        assert pg.eval_on_selector_all(".bigstars", "e=>e.length") == 1 and "%" in pg.inner_text(".stats")
        st = json.loads(pg.evaluate("localStorage.getItem('hangulhop')"))
        lid = pg.evaluate("i=>LESSONS[i].id", i)
        assert st["warm"][lid] in (1, 2, 3) and st["keyStats"], st.get("warm")
        if i == 8: pg.screenshot(path=os.path.join(OUT, "warm_result.png"))
        print(f"lesson {i+1}: warm-up OK  steps {len(seen[0])}/{len(seen[1])}/{len(seen[2])}  stars={st['warm'][lid]}  e.g. {seen[1][:3]} {seen[2][:2]}")
        # Start the lesson from the result screen -> real lesson screen; coming back shows the badge
        pg.click("#go"); pg.wait_for_selector("#target"); assert pg.query_selector(".dots")
        pg.keyboard.press("Escape"); pg.wait_for_selector(".node")
        pg.click(f'.node[data-i="{i}"]'); pg.wait_for_selector("#warm"); assert "Warmed up" in pg.inner_text(".intro"), "badge on the intro"
        assert "nudge" not in pg.get_attribute("#warm", "class")
    # the slipped keys were recorded as weak-ish in key stats
    st = json.loads(pg.evaluate("localStorage.getItem('hangulhop')")); assert any(v["miss"] > 0 for v in st["keyStats"].values())
    assert not errs, errs; ctx.close()

    # 3b) "retry missed keys": slip in a lesson warm-up -> retry button -> custom warm-up on just those keys
    ctx = b.new_context(viewport={"width": 1000, "height": 900}); ctx.route("**/fonts.*/**", lambda r: r.abort())
    r_ = ctx.new_page(); errs = []; r_.on("pageerror", lambda e: errs.append(str(e))); r_.goto(BASE)
    r_.click("#bLessons"); r_.wait_for_selector(".node"); r_.click('.node[data-i="14"]'); r_.wait_for_selector("#warm"); r_.click("#warm"); r_.wait_for_selector("#kp")
    play_warmup(r_, slip_at=(0, 1))
    assert r_.query_selector("#retry"), "retry button after a slip"
    missed = r_.eval_on_selector_all(".missed .chip b", "e=>e.map(x=>x.textContent)"); assert len(missed) >= 1
    assert f"({len(missed)})" in r_.inner_text("#retry")
    before = json.loads(r_.evaluate("localStorage.getItem('hangulhop')"))["warm"]
    r_.click("#retry"); r_.wait_for_selector("#kp")
    assert "missed" in r_.inner_text("#wb"), r_.inner_text("#wb")
    firsts = []
    for _ in range(8):
        t = r_.inner_text("#kp"); firsts.append(t); press(r_, t)
        r_.wait_for_function("([t,c])=>document.querySelector('#cnt').textContent!==c || document.querySelector('.wstep.cur').dataset.k!=='0'", [t, r_.inner_text("#cnt")], timeout=5000)
    assert set(firsts) <= set(missed), (firsts, missed)
    assert cur_step(r_) == "1"
    play_warmup(r_)          # finish the custom warm-up
    assert "Full warm-up" in r_.inner_text("#again") and not r_.query_selector("#retry")
    assert json.loads(r_.evaluate("localStorage.getItem('hangulhop')"))["warm"] == before, "retry rounds don't change lesson warm-up stars"
    r_.click("#go"); r_.wait_for_selector(".dots")           # still leads into the lesson
    assert not errs, errs; ctx.close()

    # 3c) weak-key warm-up across all lessons (from the home screen and the trail)
    ctx = b.new_context(viewport={"width": 1000, "height": 900}); ctx.route("**/fonts.*/**", lambda r: r.abort())
    w_ = ctx.new_page(); errs = []; w_.on("pageerror", lambda e: errs.append(str(e))); w_.goto(BASE)
    assert not w_.query_selector("#bWeak"), "no weak button with no history"
    w_.evaluate("""()=>localStorage.setItem('hangulhop',JSON.stringify({stars:{},keyStats:{'ㅂ':{n:5,miss:5},'ㅊ':{n:4,miss:3},'ㅈ':{n:5,miss:3},'ㅁ':{n:6,miss:0}}}))""")
    w_.reload(); w_.wait_for_selector("#bWeak"); assert "3 keys" in w_.inner_text("#bWeak")
    w_.click("#bLessons"); w_.wait_for_selector("#bWeak2"); w_.click("#back"); w_.wait_for_selector("#bWeak")
    w_.click("#bWeak"); w_.wait_for_selector("#kp")
    assert "trickiest" in w_.inner_text("#wb"), w_.inner_text("#wb")
    ks = []
    for _ in range(8):
        t = w_.inner_text("#kp"); ks.append(t); press(w_, t)
        w_.wait_for_function("([t,c])=>document.querySelector('#cnt').textContent!==c || document.querySelector('.wstep.cur').dataset.k!=='0'", [t, w_.inner_text("#cnt")], timeout=5000)
    assert set(ks) <= {"ㅂ", "ㅊ", "ㅈ"}, ks
    seen = play_warmup(w_)
    assert w_.query_selector("#trail") and not w_.query_selector("#go"), "weak result goes back to the trail, no lesson"
    assert "Weak keys" in w_.inner_text(".rank")
    assert all(len(x) == 1 for x in seen[1])
    w_.click("#trail"); w_.wait_for_selector(".node")
    w_.screenshot(path=os.path.join(OUT, "warm_weak_trail.png"))
    assert not errs, errs; ctx.close()

    # 4) phone: tap through a sentence-level warm-up, no overflow, keyboard docked
    ctx = b.new_context(viewport={"width": 375, "height": 667}, has_touch=True, is_mobile=True, device_scale_factor=2); ctx.route("**/fonts.*/**", lambda r: r.abort())
    q = ctx.new_page(); errs = []; q.on("pageerror", lambda e: errs.append(str(e))); q.goto(BASE)
    q.tap("#bLessons"); q.wait_for_selector(".node"); q.tap('.node[data-i="17"]'); q.wait_for_selector("#warm"); q.tap("#warm"); q.wait_for_selector("#kp")
    assert q.evaluate("document.documentElement.scrollWidth") <= 375
    q.screenshot(path=os.path.join(OUT, "warm_phone_keys.png"))
    seen = play_warmup(q, touch=True)
    assert q.evaluate("document.documentElement.scrollWidth") <= 375 and q.query_selector(".bigstars")
    q.screenshot(path=os.path.join(OUT, "warm_phone_result.png"))
    print("phone warm-up OK", {k: len(v) for k, v in seen.items()})
    assert not errs, errs
    b.close()
print("ALL WARM-UP TESTS PASSED")
