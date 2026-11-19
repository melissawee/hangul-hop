import os
import _shim  # noqa: F401  (CSP-safe wait_for_function)
BASE = os.environ.get("BASE_URL", "http://localhost:3000/")
OUT = os.environ.get("TEST_OUT", "test-output")
os.makedirs(OUT, exist_ok=True)
from playwright.sync_api import sync_playwright
import json
URL=BASE
def typ(pg,word=None,touch=False):
    t=word or pg.inner_text('#target')
    seq=pg.evaluate("t=>decomp(t).map(j=>JAMO2KEY[j])",t)
    for k in seq:
        if touch:
            if k['shift']: pg.tap('.shiftk',force=True)
            pg.tap(f'.key[data-code="{k["code"]}"]',force=True)
        else:
            if k['shift']: pg.keyboard.down('Shift')
            pg.keyboard.press(k['code'])
            if k['shift']: pg.keyboard.up('Shift')
def new(b,**kw):
    ctx=b.new_context(**kw);pg=ctx.new_page();errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)));pg.route('**/fonts.*/**',lambda r:r.abort())
    pg.goto(URL);return ctx,pg,errs
with sync_playwright() as p:
    b=p.chromium.launch()
    # --- 1. perfect run
    ctx,pg,errs=new(b,viewport={'width':1000,'height':900})
    assert pg.query_selector('#bPlace'),'home should offer Find my level first'
    pg.click('#bPlace');pg.screenshot(path=os.path.join(OUT, 'pl_intro.png'),full_page=True);pg.click('#go')
    for band in range(7):
        for w in range(2):
            pg.wait_for_function("document.querySelector('#target').textContent.length>0")
            typ(pg);pg.wait_for_timeout(760)
    pg.wait_for_selector('.rank');name=pg.inner_text('.rank')
    print('perfect run ->',name,'|',pg.inner_text('.recc').replace('\n',' '))
    assert name=='Cloud Queen' and 'Lesson 15' in pg.inner_text('.recc')
    pg.screenshot(path=os.path.join(OUT, 'pl_result_all.png'))
    pg.click('#go');assert 'Stories' in pg.inner_text('h2'),'should open recommended lesson'
    # home reflects level, map shows banner
    pg.click('#logo');assert 'Your level: Cloud Queen' in pg.inner_text('.level-chip')
    pg.click('#bLessons');assert 'Your level' in pg.inner_text('.banner')
    assert pg.query_selector('.lcard.next').get_attribute('data-i')=='14'
    assert pg.inner_text('.grid').count('passed by the test')==14
    pg.screenshot(path=os.path.join(OUT, 'map_placed.png'),full_page=True)
    # --- 2. fail at shift stage with "I don't know"
    pg.click('#back');pg.click('#bRetake');pg.click('#go')
    for band in range(2):
        for w in range(2):
            pg.wait_for_function("document.querySelector('#target').textContent.length>0");typ(pg);pg.wait_for_timeout(760)
    typ(pg);pg.wait_for_timeout(760)      # first shift word ok
    pg.click('#idk');pg.wait_for_selector('.rank')
    print('idk at stage 3 ->',pg.inner_text('.rank'),'|',pg.inner_text('.recc').replace('\n',' '))
    assert pg.inner_text('.rank')=='Happy Kitten' and 'Lesson 9: Shift Magic' in pg.inner_text('.recc')
    pg.screenshot(path=os.path.join(OUT, 'pl_result_mid.png'))
    # --- 3. too many typos fails immediately
    pg.click('#again');pg.click('#go')
    for _ in range(6): pg.keyboard.press('KeyQ')     # wrong for 엄마
    pg.wait_for_selector('.rank');assert pg.inner_text('.rank')=='Fresh Sprout'
    assert 'Lesson 1:' in pg.inner_text('.recc')
    # --- 4. timeout fails
    pg.click('#again');pg.evaluate("PLACE[0].limit=1");pg.click('#go');pg.wait_for_selector('.rank',timeout=5000)
    assert pg.inner_text('.rank')=='Fresh Sprout';pg.evaluate("PLACE[0].limit=30")
    # --- 5. a typo + backspace is forgiven
    pg.click('#again');pg.click('#go');pg.wait_for_function("document.querySelector('#target').textContent.length>0")
    pg.keyboard.press('KeyQ');pg.keyboard.press('Backspace');typ(pg);pg.wait_for_timeout(760)
    assert 'word 2/2' in pg.inner_text('#lbl'),pg.inner_text('#lbl')
    pg.click('#back')
    # --- 6. brand new
    pg.click('#bRetake');pg.click('#beg');assert pg.query_selector('.lcard.next').get_attribute('data-i')=='0'
    print('placement paths OK');assert not errs,errs
    ctx.close()
    # --- 7. every new sentence pack plays through on desktop; speed Sentences mode
    ctx,pg,errs=new(b,viewport={'width':1000,'height':900})
    pg.click('#bLessons')
    for i in range(11,16):
        pg.click(f'.lcard[data-i="{i}"]');pg.click('#go')
        for r in range(10):
            pg.wait_for_function("document.querySelector('#target').textContent.length>0");typ(pg);pg.wait_for_timeout(800)
        assert 'Lesson complete' in pg.inner_text('.rank') and pg.inner_text('.bigstars').count('★')==3,i
        if i==15: pg.screenshot(path=os.path.join(OUT, 'res_culture.png'))
        pg.click('#map')
    print('packs 12-16 playable, 3 stars each')
    pg.click('#back');pg.click('#bSpeed');pg.click('#segT button[data-v="30"]');pg.click('#segL button[data-v="sent"]');pg.screenshot(path=os.path.join(OUT, 'speed_setup.png'))
    pg.click('#go')
    for n in range(4): typ(pg);pg.wait_for_timeout(100)
    pg.screenshot(path=os.path.join(OUT, 'speed_sent.png'))
    pg.wait_for_selector('.big-num',timeout=40000);print('sentence speed:',pg.inner_text('.rank'),pg.inner_text('.big-num'))
    assert not errs,errs;ctx.close()
    # --- 8. phones: long sentences must fit above the keyboard; touch placement
    for name,w,h in [('se',375,667),('android',360,640),('iphone',390,844)]:
        ctx,pg,errs=new(b,viewport={'width':w,'height':h},has_touch=True,is_mobile=True,device_scale_factor=2)
        pg.tap('#bLessons');pg.tap('.lcard[data-i="15"]');pg.tap('#go')
        worst=0
        for r in range(10):
            pg.wait_for_function("document.querySelector('#target').textContent.length>0")
            m=pg.evaluate("()=>({d:document.querySelector('.kbwrap.dock').getBoundingClientRect().top,h:document.querySelector('#hint').getBoundingClientRect().bottom,sw:document.documentElement.scrollWidth,len:document.querySelector('#target').textContent.length})")
            assert m['h']<=m['d']+1,(name,'hint behind keyboard',m);assert m['sw']<=w,(name,'overflow',m)
            if r==0: pg.screenshot(path=os.path.join(OUT, f'ph2_{name}_long.png'))
            typ(pg,touch=True)
            if r==4: pg.screenshot(path=os.path.join(OUT, f'ph2_{name}_mid.png'))
            pg.wait_for_timeout(800)
        # touch placement start
        pg.tap('#map');pg.tap('#back');pg.tap('#bPlace');pg.tap('#go');pg.wait_for_timeout(400)
        m=pg.evaluate("()=>({d:document.querySelector('.kbwrap.dock').getBoundingClientRect().top,b:document.querySelector('#idk').getBoundingClientRect().bottom,t:document.querySelector('#typed').getBoundingClientRect().bottom})")
        assert m['b']<=m['d'] and m['t']<=m['d'],(name,m)
        pg.screenshot(path=os.path.join(OUT, f'ph2_{name}_place.png'))
        assert not errs,errs;ctx.close();print(name,'phone layout OK')
    b.close()
print('ALL PLACEMENT/SENTENCE TESTS PASSED')
