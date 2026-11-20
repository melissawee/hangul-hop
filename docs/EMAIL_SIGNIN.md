# Email sign-in (required login → Google Sheet)

When turned on, players must enter their email (and tick a consent box) before they can play.
Each new email is added as a row in **your own Google Sheet**. It is **off by default**, so the game
works out of the box; it switches on when you paste a URL into `public/js/config.js`.

## 1. Create the Sheet + collector (about 5 minutes)

1. Make a new Google Sheet, e.g. **Hangul Hop players**. Keep it **private** (don't share it publicly).
2. In the Sheet: **Extensions → Apps Script**. Delete the sample code and paste in everything from
   [`backend/google-apps-script/Code.gs`](../backend/google-apps-script/Code.gs). Save.
3. **Deploy → New deployment → ⚙ Select type → Web app**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Click **Deploy**, approve the permissions, and copy the **Web app URL**
     (it looks like `https://script.google.com/macros/s/AKfy…/exec`).
4. Check it's alive: open that URL in a browser. You should see `{"ok":true,"service":"hangul-hop-signin"}`.

## 2. Turn it on in the game

Edit `public/js/config.js`:

```js
const SIGNUP_URL    = 'https://script.google.com/macros/s/AKfy…/exec';
const CONTACT_EMAIL = 'you@yourdomain.com';   // shown on the privacy page
```

Commit and push; Vercel redeploys. Open the game, sign in with a test email, and check a new row
appears in the **Players** tab (created automatically). Bump `VERSION` in `public/sw.js` so installed
copies pick up the change.

To turn the login **off** again, set `SIGNUP_URL = ''`.

## Changing the collector later
Edit `Code.gs` → **Deploy → Manage deployments → ✏ → Version: New version → Deploy**. The URL stays the same.

## What is stored
`Signed up (UTC) · Email · Consent version · Source (site address)`. Duplicates are ignored (case-insensitive).
Progress (stars, scores) never leaves the player's device.
If you change the consent wording or what you collect, update `CONSENT_VERSION` in `config.js` and `public/privacy.html`.

## Things to know (please read)
- **It identifies players; it doesn't verify them.** Anyone can type any address, so this is a sign-up list, not
  secure authentication. The sign-in doesn't sync progress between devices either (Sheets can't do that safely).
  If you later want verified emails or cross-device progress, the natural upgrade is Supabase magic-link login.
- **The collector URL is public** (the game has to call it). It validates emails, requires the consent flag, ignores
  bots that fill a hidden field, neutralises spreadsheet-formula tricks and de-duplicates. Apps Script has its own
  daily quotas; if you ever see abuse, redeploy to get a fresh URL.
- **Deleting someone's data:** find their row in the Sheet and delete it. "Not you?" in the game only signs out on that device.
- **Privacy law:** `public/privacy.html` is a plain-language starting point, not legal advice. You're collecting personal
  data from people who may be in Singapore (PDPA), the EU/UK (GDPR) and elsewhere; have it reviewed before a public launch.
  The consent box asks players to confirm they're 13+. Don't market the sign-in to younger children without parental consent.
