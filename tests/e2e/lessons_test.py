import os
import _shim  # noqa: F401  (CSP-safe wait_for_function)
BASE = os.environ.get("BASE_URL", "http://localhost:3000/")
OUT = os.environ.get("TEST_OUT", "test-output")
os.makedirs(OUT, exist_ok=True)
import sys,re,json
from playwright.sync_api import sync_playwright
path=BASE
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={'width':1000,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('console',lambda m:errs.append(m.text) if m.type=='error' and 'fonts' not in m.text and 'net::' not in m.text else None)
    pg.route('**/fonts.*/**',lambda r:r.abort())
    pg.goto(path)
    pg.screenshot(path=os.path.join(OUT, 'home.png'))
    # Lessons map
    pg.click('#bLessons');pg.screenshot(path=os.path.join(OUT, 'map.png'))
    # play every lesson end-to-end using the engine's own decomposition
    eng=pg.evaluate("1")
    for i in range(29):
        pg.click('#bLessons') if pg.query_selector('#bLessons') else None
        pg.click(f'.lcard[data-i="{i}"]')
        if i in (0,7,11): pg.screenshot(path=os.path.join(OUT, f'intro_{i}.png'))
        pg.click('#go')
        for r in range(10):
            target=pg.inner_text('#target')
            seq=pg.evaluate("t=>decomp(t).map(j=>JAMO2KEY[j])",target)
            for k in seq:
                if k['shift']: pg.keyboard.down('Shift')
                pg.keyboard.press(k['code'])
                if k['shift']: pg.keyboard.up('Shift')
            if i==11 and r==0: pg.screenshot(path=os.path.join(OUT, 'phrase_done.png'))
            pg.wait_for_timeout(800)
        res=pg.inner_text('.rank')
        stars=pg.inner_text('.bigstars')
        assert 'Lesson complete' in res,(i,res)
        assert stars.count('★')==3 and '☆' not in stars, (i,stars)
        if i==0: pg.screenshot(path=os.path.join(OUT, 'result.png'))
        pg.click('#map')
    print('all 29 packs playable, 3 stars each, 0 mistakes')
    # a mistake is rejected + counted, and mid-lesson screenshot
    pg.click('.lcard[data-i="1"]');pg.click('#go')
    pg.keyboard.press('KeyQ')  # wrong key
    pg.wait_for_timeout(100)
    pg.screenshot(path=os.path.join(OUT, 'play.png'))
    assert pg.inner_text('#typed').strip()=='' ,'wrong key should be rejected'
    pg.click('#back')
    # speed test: type 10 words then wait for end with 30s? use time hack
    pg.click('#bSpeed') if pg.query_selector('#bSpeed') else (pg.click('#logo'),pg.click('#bSpeed'))
    pg.screenshot(path=os.path.join(OUT, 'setup.png'));pg.click('#segT button[data-v="30"]');pg.click('#segL button[data-v="hard"]');pg.click('#go')
    for n in range(12):
        target=pg.inner_text('#target')
        seq=pg.evaluate("t=>decomp(t).map(j=>JAMO2KEY[j])",target)
        for k in seq:
            if k['shift']: pg.keyboard.down('Shift')
            pg.keyboard.press(k['code'])
            if k['shift']: pg.keyboard.up('Shift')
    # mistake then backspace
    pg.keyboard.press('KeyQ');pg.keyboard.press('Backspace')
    pg.screenshot(path=os.path.join(OUT, 'speed.png'))
    pg.wait_for_selector('.big-num',timeout=40000)
    print('speed result:',pg.inner_text('.rank'),'|',pg.inner_text('.big-num'))
    pg.screenshot(path=os.path.join(OUT, 'speed_result.png'))
    # free play
    pg.click('#home');pg.click('#bFree')
    for c in ['KeyG','KeyK','KeyS','KeyR','KeyM','KeyF']: pg.keyboard.press(c)
    print('free play:',pg.inner_text('#box').strip())
    pg.screenshot(path=os.path.join(OUT, 'free.png'))
    # mobile
    pg.set_viewport_size({'width':390,'height':800});pg.click('#back');pg.screenshot(path=os.path.join(OUT, 'mobile_home.png'))
    pg.click('#bLessons');pg.click('.lcard[data-i="7"]');pg.click('#go');pg.screenshot(path=os.path.join(OUT, 'mobile_play.png'))
    b.close()
print('JS errors:',errs or 'none')
