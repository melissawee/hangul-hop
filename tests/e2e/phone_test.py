import os
import _shim  # noqa: F401  (CSP-safe wait_for_function)
BASE = os.environ.get("BASE_URL", "http://localhost:3000/")
OUT = os.environ.get("TEST_OUT", "test-output")
os.makedirs(OUT, exist_ok=True)
from playwright.sync_api import sync_playwright
import json
devs=[('iphone15',390,844),('se',375,667),('small-android',360,640),('big',430,932)]
with sync_playwright() as p:
    b=p.chromium.launch()
    for name,w,h in devs:
        ctx=b.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=True,device_scale_factor=2)
        pg=ctx.new_page();errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.route('**/fonts.*/**',lambda r:r.abort())
        pg.goto(BASE)
        pg.tap('#bLessons');pg.wait_for_timeout(300)
        pg.tap('.lcard[data-i="0"]');pg.wait_for_timeout(400)
        pg.screenshot(path=os.path.join(OUT, f'ph_{name}_intro.png'))
        sw=pg.evaluate("document.documentElement.scrollWidth")
        pg.tap('#go');pg.wait_for_timeout(500)
        m=pg.evaluate("""()=>{const kb=document.querySelector('.kbwrap.dock').getBoundingClientRect();
          const rows=[...document.querySelectorAll('.kr')].map(r=>{const b=r.getBoundingClientRect();return [Math.round(b.left),Math.round(b.right)]});
          const k=document.querySelector('.key[data-code=KeyQ]').getBoundingClientRect();
          const typed=document.querySelector('#typed').getBoundingClientRect();
          const hint=document.querySelector('#hint').getBoundingClientRect();
          return {dockTop:Math.round(kb.top),dockBottom:Math.round(kb.bottom),vh:innerHeight,rows,keyW:Math.round(k.width),keyH:Math.round(k.height),typedBottom:Math.round(typed.bottom),hintBottom:Math.round(hint.bottom),scrollW:document.documentElement.scrollWidth}}""")
        print(name,w,h,json.dumps(m),'intro scrollW',sw)
        assert m['scrollW']<=w and sw<=w,'horizontal overflow'
        assert all(l>=0 and r<=w for l,r in m['rows']),'keyboard rows overflow'
        assert m['dockBottom']==h,'dock not at bottom'
        assert m['hintBottom']<=m['dockTop'],'hint hidden behind keyboard'
        # real touch typing through a whole lesson using on-screen keys only
        for r in range(10):
            tgt=pg.inner_text('#target')
            seq=pg.evaluate("t=>decomp(t).map(j=>JAMO2KEY[j])",tgt)
            for k in seq:
                if k['shift']: pg.tap('.shiftk',force=True)
                pg.tap(f'.key[data-code="{k["code"]}"]',force=True)
            pg.wait_for_timeout(850)
        assert 'Lesson complete' in pg.inner_text('.rank'),name
        pg.screenshot(path=os.path.join(OUT, f'ph_{name}_done.png'))
        assert not errs,errs
        # phrase pack with space bar + shift, mid-typing screenshot
        pg.tap('#map');pg.tap('.lcard[data-i="11"]');pg.tap('#go');pg.wait_for_timeout(400)
        seq=pg.evaluate("t=>decomp(t).map(j=>JAMO2KEY[j])",pg.inner_text('#target'))
        for k in seq[:5]:
            if k['shift']: pg.tap('.shiftk',force=True)
            pg.tap(f'.key[data-code="{k["code"]}"]',force=True)
        pg.wait_for_timeout(250);pg.screenshot(path=os.path.join(OUT, f'ph_{name}_phrase.png'))
        # speed test + free play layouts
        pg.tap('#back');pg.tap('#logo');pg.tap('#bSpeed');pg.tap('#go');pg.wait_for_timeout(400)
        s=pg.evaluate("""()=>({dockTop:Math.round(document.querySelector('.kbwrap.dock').getBoundingClientRect().top),typedB:Math.round(document.querySelector('#typed').getBoundingClientRect().bottom),sw:document.documentElement.scrollWidth})""")
        print('   speed',s);assert s['typedB']<=s['dockTop'],('speed overlap',s) and s['sw']<=w
        pg.screenshot(path=os.path.join(OUT, f'ph_{name}_speed.png'))
        ctx.close()
    b.close()
print('PHONE TESTS PASSED')
