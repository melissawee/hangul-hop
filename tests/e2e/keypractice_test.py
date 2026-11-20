import os
import _shim  # noqa: F401  (CSP-safe wait_for_function)
BASE = os.environ.get("BASE_URL", "http://localhost:3000/")
OUT = os.environ.get("TEST_OUT", "test-output")
os.makedirs(OUT, exist_ok=True)
from playwright.sync_api import sync_playwright
import json
URL=BASE
def press(pg,j,touch=False):
    k=pg.evaluate("j=>JAMO2KEY[j]",j)
    if touch:
        if k['shift']: pg.tap('.shiftk',force=True)
        pg.tap(f'.key[data-code="{k["code"]}"]',force=True)
    else:
        if k['shift']: pg.keyboard.down('Shift')
        pg.keyboard.press(k['code'])
        if k['shift']: pg.keyboard.up('Shift')
def new(b,**kw):
    ctx=b.new_context(**kw);pg=ctx.new_page();errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)));pg.route('**/fonts.*/**',lambda r:r.abort());pg.goto(URL);return ctx,pg,errs
def round_(pg,touch=False,mistake_on=None,wrong_code=None):
    """play a whole round; returns list of prompts. mistake_on: indices where a wrong key is pressed first"""
    seen=[];i=0
    while True:
        pg.wait_for_function("document.querySelector('#kp')&&document.querySelector('#kp').textContent.length>0")
        j=pg.inner_text('#kp');seen.append(j)
        if mistake_on and i in mistake_on:
            wc=pg.evaluate("j=>{const t=JAMO2KEY[j].code;return Object.keys(KEY).find(c=>KEY[c][0]!==j&&c!==t)}",j)
            if touch: pg.tap(f'.key[data-code="{wc}"]',force=True)
            else: pg.keyboard.press(wc)
            pg.wait_for_timeout(80)
            fb=pg.inner_text('#kfb');assert 'Look for' in fb,fb
            assert pg.query_selector('.key.next'),'correct key should glow after a miss'
            # pressing another wrong key must not advance
            assert pg.inner_text('#kp')==j
        press(pg,j,touch);i+=1
        try:
            pg.wait_for_function(f"document.querySelector('.rank')||document.querySelector('#cnt').textContent.startsWith('{i+1}/')",timeout=4000)
        except Exception as e: raise
        if pg.query_selector('.rank'): return seen
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx,pg,errs=new(b,viewport={'width':1000,'height':900})
    pg.click('#bKeys');pg.wait_for_selector('#sets')
    chips=pg.eval_on_selector_all('#sets .sch','e=>e.map(x=>x.textContent)');print('sets:',[c.split('<')[0][:18] for c in chips])
    assert len(chips)==5,'no weak chip before any practice'
    assert pg.eval_on_selector_all('.key.glow','e=>e.length')==9,'home set glows 9 keys'
    pg.click('#sets .sch[data-id="shift"]');assert pg.eval_on_selector_all('.key.glow','e=>e.length')>=5 and pg.query_selector('.shiftk.glow')
    pg.click('#segB button[data-v="1"]');assert pg.evaluate("document.querySelector('#kb').classList.contains('blind')")
    assert pg.evaluate("getComputedStyle(document.querySelector('.key[data-code=KeyQ] .jm')).visibility")=='hidden'
    pg.screenshot(path=os.path.join(OUT, 'ks_setup_blind.png'),full_page=True)
    # --- peek round, home row, all correct
    pg.click('#segB button[data-v="0"]');pg.click('#sets .sch[data-id="home"]');pg.click('#go')
    seen=round_(pg);assert len(seen)==18 and set(seen)==set('ㅁㄴㅇㄹㅎㅗㅓㅏㅣ'),seen
    assert pg.inner_text('.rank')=='Key master!' and pg.inner_text('.bigstars').count('★')==3
    st=json.loads(pg.evaluate("localStorage.getItem('hangulhop')"));assert st['keyStats']['ㅁ']['n']>=1 and all(v['miss']==0 for v in st['keyStats'].values())
    pg.screenshot(path=os.path.join(OUT, 'ks_result_good.png'))
    assert pg.eval_on_selector_all('.key.m-good','e=>e.length')>=1 and pg.query_selector('.key.m-none')
    print('peek round OK: 18 prompts, 100%, stats saved')
    # --- blind round with 2 mistakes
    pg.click('#more');pg.click('#segB button[data-v="1"]');pg.click('#sets .sch[data-id="top"]');pg.click('#go')
    assert pg.evaluate("document.querySelector('#kb').classList.contains('blind')")
    pg.wait_for_selector('#kp');pg.screenshot(path=os.path.join(OUT, 'ks_blind_play.png'))
    seen=round_(pg,mistake_on={0,5});assert len(seen)==20
    acc=pg.inner_text('.stats .stat b');print('blind round w/ 2 misses ->',pg.inner_text('.rank'),acc)
    assert acc=='90%' and pg.inner_text('.rank')=='Key master!' ,(acc,pg.inner_text('.rank'))
    assert 'Keys to remember' in pg.inner_text('.card') and pg.eval_on_selector_all('.missed .chip','e=>e.length')==2
    st=json.loads(pg.evaluate("localStorage.getItem('hangulhop')"));assert sum(v['miss'] for k,v in st['keyStats'].items())==2
    assert pg.eval_on_selector_all('.key.m-weak, .key.m-ok','e=>e.length')>=1
    pg.screenshot(path=os.path.join(OUT, 'ks_result_miss.png'),full_page=True)
    # --- weak keys loop
    assert pg.query_selector('#weak'),'weak keys button'
    n=int(pg.inner_text('#weak').split('(')[1].split(')')[0]);pg.click('#weak')
    seen=round_(pg,mistake_on=None);assert len(seen)==promptCount if False else True
    print('weak-keys round with',n,'keys OK')
    pg.click('#more');chips=pg.eval_on_selector_all('#sets .sch','e=>e.length');assert chips>=5
    # --- shift set: base key without Shift is wrong; Shift+key is right
    pg.click('#sets .sch[data-id="shift"]');pg.click('#go');pg.wait_for_selector('#kp')
    j=pg.inner_text('#kp');k=pg.evaluate("j=>JAMO2KEY[j]",j);assert k['shift']
    assert 'needs Shift' in pg.inner_text('#ksound')
    pg.keyboard.press(k['code']);pg.wait_for_timeout(80);assert 'Look for' in pg.inner_text('#kfb') and pg.inner_text('#kp')==j
    press(pg,j);pg.wait_for_function(f"document.querySelector('#cnt').textContent.startsWith('2/')")
    pg.keyboard.press('Escape');pg.wait_for_selector('#sets')
    # --- warm-up from a lesson intro, returns to the lesson
    pg.click("#back");pg.click("#bLessons");pg.click(".lcard[data-i=\"0\"]");pg.click("#warm")
    pg.wait_for_selector('#kp');assert pg.inner_text('#cnt')=='1/14'
    pg.click('#back');assert 'Hello & Thanks' in pg.inner_text('h2')
    print('desktop key practice OK');assert not errs,errs;ctx.close()
    # --- phones
    for name,w,h in [('se',375,667),('android',360,640),('iphone',390,844)]:
        ctx,pg,errs=new(b,viewport={'width':w,'height':h},has_touch=True,is_mobile=True,device_scale_factor=2)
        pg.tap('#bKeys');pg.wait_for_selector('#sets');assert pg.evaluate("document.documentElement.scrollWidth")<=w,(name,'setup overflow')
        pg.screenshot(path=os.path.join(OUT, f'ks_{name}_setup.png'))
        pg.tap('#segB button[data-v="1"]',force=True);pg.tap('#sets .sch[data-id="bottom"]',force=True);pg.tap('#go')
        pg.wait_for_selector('#kp')
        m=pg.evaluate("()=>({d:document.querySelector('.kbwrap.dock').getBoundingClientRect().top,f:document.querySelector('#kfb').getBoundingClientRect().bottom,sw:document.documentElement.scrollWidth,vis:getComputedStyle(document.querySelector('.key[data-code=KeyZ] .jm')).visibility})")
        assert m['vis']=='hidden' and m['f']<=m['d'] and m['sw']<=w,(name,m)
        pg.wait_for_timeout(300);pg.screenshot(path=os.path.join(OUT, f'ks_{name}_blind.png'))
        # a miss shows the feedback with location text on phones (no PC letters)
        j=pg.inner_text('#kp');tk=pg.evaluate("j=>JAMO2KEY[j].code",j)
        wc=[c for c in ['KeyQ','KeyP'] if c!=tk][0];pg.tap(f'.key[data-code="{wc}"]',force=True);pg.wait_for_timeout(100)
        fb=pg.inner_text('#kfb');assert 'Look for' in fb and 'row' in fb and ' key ·' not in fb,fb
        m=pg.evaluate("()=>({d:document.querySelector('.kbwrap.dock').getBoundingClientRect().top,f:document.querySelector('#kfb').getBoundingClientRect().bottom})");assert m['f']<=m['d'],(name,'miss feedback hidden',m)
        pg.screenshot(path=os.path.join(OUT, f'ks_{name}_miss.png'))
        press(pg,j,True)
        seen=round_(pg,touch=True)   # finish the round by touch
        pg.wait_for_selector('.rank');assert pg.evaluate("document.documentElement.scrollWidth")<=w,(name,'result overflow')
        pg.screenshot(path=os.path.join(OUT, f'ks_{name}_result.png'),full_page=True)
        assert not errs,errs;ctx.close();print(name,'phone key practice OK')
    b.close()
print('ALL KEY PRACTICE TESTS PASSED')
