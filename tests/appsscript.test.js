// Unit tests for backend/google-apps-script/Code.gs (Google services are mocked).
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'google-apps-script', 'Code.gs'), 'utf8');
let fail = 0; const bad = (...a) => { fail++; console.log('FAIL', ...a); };

function mockSheet(rows = []) {
  const data = [['Signed up (UTC)', 'Email', 'Consent version', 'Source'], ...rows];
  return { data,
    getLastRow: () => data.length,
    getRange: (r, c, n) => ({ getValues: () => data.slice(r - 1, r - 1 + n).map(row => [row[c - 1]]) }),
    appendRow: row => data.push(row) };
}
function build(sheet) {
  const log = { lock: 0, unlock: 0 };
  const g = new Function(src + '; return {processSignup_, safeCell_, doPost, doGet, EMAIL_RE};')();
  const deps = { sheet, now: new Date('2026-11-20T08:00:00Z'), lock: { waitLock() { log.lock++; }, releaseLock() { log.unlock++; } } };
  return { g, deps, log };
}
const ok = { email: 'Hello@Example.com ', consent: true, consentVersion: '2026-11-20', hp: '', source: 'https://hangul-hop.vercel.app' };

// happy path: lower-cased, trimmed, stored once, lock balanced
{ const sh = mockSheet(), { g, deps, log } = build(sh);
  const r = g.processSignup_(ok, deps);
  if (!r.ok || r.existing) bad('first signup', r);
  if (sh.data.length !== 2 || sh.data[1][1] !== 'hello@example.com' || sh.data[1][2] !== '2026-11-20' || sh.data[1][3] !== 'https://hangul-hop.vercel.app') bad('row content', sh.data[1]);
  if (!(sh.data[1][0] instanceof Date)) bad('timestamp');
  if (log.lock !== 1 || log.unlock !== 1) bad('lock balance', log);
  // duplicate (any case) -> ok + existing, not appended
  const r2 = g.processSignup_({ ...ok, email: 'HELLO@example.COM' }, deps);
  if (!r2.ok || !r2.existing || sh.data.length !== 2) bad('duplicate handling', r2, sh.data.length);
  if (log.lock !== 2 || log.unlock !== 2) bad('lock balance after dup', log);
}
// consent is required
{ const sh = mockSheet(), { g, deps } = build(sh);
  for (const c of [false, undefined, 'true', 1, null]) { const r = g.processSignup_({ ...ok, consent: c }, deps); if (r.ok || r.error !== 'consent_required') bad('consent must be exactly true', c, r); }
  if (sh.data.length !== 1) bad('nothing stored without consent'); }
// invalid emails are rejected, valid odd ones accepted
{ const sh = mockSheet(), { g, deps } = build(sh);
  ['', ' ', 'plain', 'a@b', 'a@b.', '@x.com', 'a b@x.com', 'a@x .com', 'a@@x.com', 'a,b@x.com', '<a>@x.com', 'a@x.com;b@y.com', 'x'.repeat(250) + '@a.co', null, undefined, 42]
    .forEach(e => { const r = g.processSignup_({ ...ok, email: e }, deps); if (r.ok || r.error !== 'invalid_email') bad('should reject', JSON.stringify(e), r); });
  ['a@b.co', 'first.last+tag@sub.example.org', 'user_1@x-y.io', 'ünï@exämple.com'].forEach(e => { const r = g.processSignup_({ ...ok, email: e }, deps); if (!r.ok) bad('should accept', e, r); });
  if (sh.data.length !== 5) bad('only valid ones stored', sh.data.length); }
// honeypot: pretends success but stores nothing, even with consent and a good email
{ const sh = mockSheet(), { g, deps, log } = build(sh);
  const r = g.processSignup_({ ...ok, hp: 'http://spam' }, deps);
  if (!r.ok || sh.data.length !== 1 || log.lock !== 0) bad('honeypot', r, sh.data.length); }
// bad bodies
{ const { g, deps } = build(mockSheet());
  [null, undefined, 'str', 5].forEach(b => { const r = g.processSignup_(b, deps); if (r.ok || r.error !== 'bad_request') bad('bad body', b, r); }); }
// formula injection is neutralised; source must look like a URL
{ const sh = mockSheet(), { g, deps } = build(sh);
  if (g.safeCell_('=HYPERLINK("x")') !== "'=HYPERLINK(\"x\")" || g.safeCell_('+1') !== "'+1" || g.safeCell_('-1') !== "'-1" || g.safeCell_('@SUM') !== "'@SUM" || g.safeCell_('ok') !== 'ok') bad('safeCell_');
  const r = g.processSignup_({ ...ok, email: '=cmd@evil.com', source: 'javascript:alert(1)', consentVersion: '=1+1' }, deps);
  const row = sh.data[1]; if (!r.ok || row[1] !== "'=cmd@evil.com" || row[3] !== '' || row[2] !== "'=1+1") bad('injection row', row); }
// the lock is always released, even if the sheet throws
{ const sh = mockSheet(); sh.appendRow = () => { throw new Error('boom'); }; const { g, deps, log } = build(sh);
  let threw = false; try { g.processSignup_(ok, deps); } catch (e) { threw = true; }
  if (!threw || log.unlock !== 1) bad('lock released on error', threw, log); }
// doPost wiring with Google globals mocked
{ const sh = mockSheet(); let out;
  const globals = `
    var SpreadsheetApp={getActiveSpreadsheet:function(){return {getSheetByName:function(){return __sh;},insertSheet:function(){return __sh;}};}};
    var LockService={getScriptLock:function(){return {waitLock:function(){},releaseLock:function(){}};}};
    var ContentService={MimeType:{JSON:'json'},createTextOutput:function(t){return {t:t,setMimeType:function(m){this.m=m;return this;}};}};`;
  const g = new Function('__sh', globals + src + '; return {doPost, doGet};')(sh);
  out = g.doPost({ postData: { contents: JSON.stringify(ok) } });
  if (JSON.parse(out.t).ok !== true || out.m !== 'json' || sh.data.length !== 2) bad('doPost happy', out);
  out = g.doPost({ postData: { contents: 'not json' } }); if (JSON.parse(out.t).error !== 'server_error') bad('doPost bad json', out);
  out = g.doPost({}); if (JSON.parse(out.t).ok !== false && JSON.parse(out.t).error !== 'consent_required') bad('doPost empty', out);
  out = g.doGet(); if (JSON.parse(out.t).service !== 'hangul-hop-signin' || Object.keys(JSON.parse(out.t)).length !== 2) bad('doGet leaks nothing', out); }
console.log(fail ? fail + ' FAILURES' : 'ALL APPS SCRIPT TESTS PASSED');
process.exit(fail ? 1 : 0);
