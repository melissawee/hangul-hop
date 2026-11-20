"""Hop Trail: the gamified lesson map — worlds, HUD, hopping bunny, tap-to-hop."""
import _shim  # noqa: F401  (CSP-safe wait_for_function)
import os, json
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3000/")
OUT = os.environ.get("TEST_OUT", "test-output"); os.makedirs(OUT, exist_ok=True)

def seed(pg, stars, pos=None):
    pg.goto(BASE)
    pg.evaluate("s=>localStorage.setItem('hangulhop',JSON.stringify(s))", {"stars": stars, "pos": pos} if pos is not None else {"stars": stars})
    pg.reload()

def hopper_vs_node(pg, i):
    return pg.evaluate("""i=>{const h=document.querySelector('#hopper').getBoundingClientRect(),n=document.querySelector('.node[data-i="'+i+'"] .orb').getBoundingClientRect();
      return {dx:Math.abs((h.left+h.width/2)-(n.left+n.width/2)),dy:(n.top)-(h.top+h.height/2)}}""", i)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True); ctx.route("**/fonts.*/**", lambda r: r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    seed(pg, {"greet": 3, "family": 2, "food": 3, "animals": 1}, pos=0)
    pg.click("#bLessons"); pg.wait_for_selector(".node")
    assert pg.eval_on_selector_all(".node", "e=>e.length") == 29
    assert pg.eval_on_selector_all(".world", "e=>e.length") == 5, "5 worlds"
    names = pg.eval_on_selector_all(".world b", "e=>e.map(x=>x.textContent)")
    assert names == ["Meadow of Words", "Power-up Peaks", "Phrase Pond", "Sentence City", "Master Mountain"], names
    assert pg.eval_on_selector_all(".node.done", "e=>e.length") == 4 and pg.query_selector(".node.next").get_attribute("data-i") == "4"
    assert "4 / 8" in pg.inner_text(".world")
    hud = pg.inner_text(".hud"); assert "9" in hud and "/ 87" in hud and "4" in hud and "/ 29" in hud, hud
    # bunny starts at saved spot (level 1) and hops to the next level (5): it must be mid-trail soon, then settle there
    pg.wait_for_timeout(300); mid = hopper_vs_node(pg, 4)
    pg.wait_for_function("document.querySelector('#hopper') && !document.querySelector('#hopper').classList.contains('hopping')", timeout=8000)
    pg.wait_for_timeout(300); end = hopper_vs_node(pg, 4)
    assert end["dx"] < 6 and 5 < end["dy"] < 25, ("bunny should sit just above the next level", end)
    assert json.loads(pg.evaluate("localStorage.getItem('hangulhop')"))["pos"] == 4
    pg.screenshot(path=os.path.join(OUT, "trail_phone.png"))
    # tap a far level: bunny hops there, THEN the intro opens; position is remembered
    pg.tap('.node[data-i="8"]'); pg.wait_for_selector("#go", timeout=6000)
    assert "Shift Magic" in pg.inner_text(".intro h2") and json.loads(pg.evaluate("localStorage.getItem('hangulhop')"))["pos"] == 8
    pg.click("#back"); pg.wait_for_selector(".node"); pg.wait_for_function("document.querySelector('#hopper') && !document.querySelector('#hopper').classList.contains('hopping')", timeout=8000); pg.wait_for_timeout(200)
    assert hopper_vs_node(pg, 4)["dx"] < 6, "after returning, the bunny hops back to the next level"
    assert pg.evaluate("document.documentElement.scrollWidth") <= 390
    # finishing every level: bunny rests on the last node, worlds show cleared
    seed(pg, {l: 3 for l in ["greet","family","food","animals","things","places","time","feelings","shift","compound","double","phrases","travel","chat","stories","culture","work","friends","health","dreams","korea","shop","tech","nature","opinions","story","master","master2","master3"]}, pos=29)
    pg.click("#bLessons"); pg.wait_for_selector(".node")
    assert pg.eval_on_selector_all(".world.cleared", "e=>e.length") == 5, "all five worlds cleared"
    # reduced motion: no animation, bunny placed instantly
    ctx2 = b.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce"); ctx2.route("**/fonts.*/**", lambda r: r.abort())
    q = ctx2.new_page(); seed(q, {"greet": 3}, pos=0); q.click("#bLessons"); q.wait_for_selector(".node")
    assert hopper_vs_node(q, 1)["dx"] < 6 and not q.evaluate("document.querySelector('#hopper').classList.contains('hopping')")
    # desktop width: trail stays centred and narrow
    ctx3 = b.new_context(viewport={"width": 1200, "height": 800}); ctx3.route("**/fonts.*/**", lambda r: r.abort())
    d = ctx3.new_page(); seed(d, {"greet": 3}, pos=1); d.click("#bLessons"); d.wait_for_selector(".node")
    w = d.evaluate("document.querySelector('#trail').getBoundingClientRect().width"); assert 480 <= w <= 521, w
    d.screenshot(path=os.path.join(OUT, "trail_desktop.png"))
    assert not errs, errs
    b.close()
print("ALL TRAIL TESTS PASSED")
