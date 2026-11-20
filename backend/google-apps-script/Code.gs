/**
 * Hangul Hop — email sign-in collector (Google Apps Script web app).
 * Bound to a Google Sheet. Setup: docs/EMAIL_SIGNIN.md
 *
 * The game POSTs a small JSON body as text/plain (so the browser sends no CORS pre-flight):
 *   { email, consent:true, consentVersion, hp:'', source }
 * and gets back JSON: { ok:true, existing?:true } or { ok:false, error }.
 */
var SHEET_NAME = 'Players';
var HEADERS = ['Signed up (UTC)', 'Email', 'Consent version', 'Source'];
var MAX_EMAIL = 254;
var BAD = '\\s@<>"\',;:()\\[\\]\\\\';
var EMAIL_RE = new RegExp('^[^' + BAD + ']+@[^' + BAD + ']+\\.[^' + BAD + ']{2,}$');

/** Stops spreadsheet formula injection: a cell that starts with = + - @ is stored as text. */
function safeCell_(s) {
  s = String(s == null ? '' : s);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

/**
 * Pure(ish) logic, so it can be unit-tested without Google services.
 * deps = { sheet, now:Date, lock:{waitLock(ms),releaseLock()} }
 */
function processSignup_(body, deps) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad_request' };
  if (body.hp) return { ok: true };                                   // honeypot: a bot filled the hidden field — pretend success, store nothing
  if (body.consent !== true) return { ok: false, error: 'consent_required' };
  var email = String(body.email == null ? '' : body.email).trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return { ok: false, error: 'invalid_email' };
  var version = String(body.consentVersion || '').slice(0, 20);
  var source = /^https?:\/\/[^\s]{1,150}$/.test(String(body.source || '')) ? String(body.source) : '';
  deps.lock.waitLock(10000);
  try {
    var sheet = deps.sheet, last = sheet.getLastRow();
    if (last >= 2) {
      var emails = sheet.getRange(2, 2, last - 1, 1).getValues();
      for (var i = 0; i < emails.length; i++) {
        if (String(emails[i][0]).trim().toLowerCase() === email) return { ok: true, existing: true };
      }
    }
    sheet.appendRow([deps.now, safeCell_(email), safeCell_(version), safeCell_(source)]);
    return { ok: true };
  } finally {
    deps.lock.releaseLock();
  }
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) { sh.appendRow(HEADERS); sh.setFrozenRows(1); }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return json_(processSignup_(body, { sheet: getSheet_(), now: new Date(), lock: LockService.getScriptLock() }));
  } catch (err) {
    return json_({ ok: false, error: 'server_error' });
  }
}

/** Opening the URL in a browser just says it's alive (no data is exposed). */
function doGet() { return json_({ ok: true, service: 'hangul-hop-signin' }); }
