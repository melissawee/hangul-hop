# 🐰 Hangul Hop

A cute pastel game that teaches and tests **Korean (Hangul) typing** — for learners who can speak a bit
(hello, Duolingo!) but have never typed it. Installable on your phone as a PWA, works offline.

**Features:** placement test · **Hop Trail** map where the bunny hops along 29 levels across 5 worlds · word-first lessons with a **3-step warm-up on every level** (find the keys → build blocks → type words), a **retry-missed-keys** button, and a **weak-key warm-up** that mixes your trickiest keys from every lesson · power-ups (shift, compound vowels, double finals) · 17 sentence levels up to the 3-part **Master Class** · speed test (타수/min) · Key Practice for memorising the 2-set keyboard · phone-sized keyboard.

## Install on your phone
Open the deployed site, then:
- **Android / Chrome:** tap **Install app** on the home screen (or ⋮ → *Install app*).
- **iPhone / Safari:** Share → **Add to Home Screen**.

## Deploy on Vercel
1. Push this repo to GitHub (done if you're reading this there).
2. In Vercel: **Add New → Project → import `hangul-hop`**.
3. Framework Preset: **Other**. Leave the build command empty. Output directory is read from `vercel.json` (`public`).
4. Deploy. `vercel.json` also sets security headers (strict CSP) and correct caching for `sw.js` and the manifest.

## Local development
```bash
npm start            # http://localhost:3000 — serves public/ with the same headers as vercel.json
npm test             # engine unit tests (node only)
npm run test:e2e     # Playwright suites (pip install playwright pillow; playwright install chromium)
npm run icons        # regenerate icons (needs rsvg-convert + Pillow)
```

## Structure
```
public/            the whole site (static, no build)
  index.html  css/styles.css  js/engine.js (pure logic)  js/app.js (UI)
  manifest.webmanifest  sw.js  icons/
scripts/           serve.mjs (dev server), make-icons.py (icon generator)
tests/             engine.test.js + e2e/ (PWA, trail, warm-ups, lessons, phone, placement, key practice)
vercel.json
```

## Notes
- **Updating:** bump `VERSION` in `public/sw.js` on each release; users get an "Update" toast.
- **Fonts:** Jua and Gowun Dodum load from Google Fonts and are cached by the service worker after the first online visit.
- No license file is included yet — add one if you want others to reuse the code.

## Adding levels
Append a pack to `LESSONS` in `public/js/engine.js` (`group` picks the world on the trail; items are `[korean, romanization, meaning, emoji]`). `npm test` checks every sentence is typable and that sentence packs keep getting longer. Then bump `VERSION` in `public/sw.js`.
