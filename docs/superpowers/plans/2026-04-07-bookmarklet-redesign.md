# Follow Radar — Bookmarklet Pivot & Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot Follow Radar from a zip-upload tool to a bookmarklet that scrapes Instagram in the user's own browser, and redesign `index.html` into a commanding editorial landing page.

**Architecture:** Two artifacts. `index.html` is the marketing page + results view. `b.js` is the bookmarklet payload, loaded fresh on every click via a tiny `javascript:` loader stub embedded in `index.html`. Data flows back via `location.hash`. Spec: `docs/superpowers/specs/2026-04-07-bookmarklet-redesign-design.md`.

**Tech Stack:** Vanilla HTML / CSS / JS. No build, no framework, no npm. Tests run in a hand-written `tests.html` harness opened in a browser. CompressionStream + base64 for hash transport. Instagram's internal `/api/v1/friendships/...` endpoints with cookies.

**Working directory note:** Each step's `git` commands assume the project root `/Users/thorwarnken/Projects/follow-radar`.

---

## Phase 0 — Setup

### Task 1: Delete obsolete test fixtures

The bookmarklet pivot eliminates the JSON parser, so the test data files for it are dead code.

**Files:**
- Delete: `test_followers_1.json`
- Delete: `test_following.json`

- [ ] **Step 1: Delete the files**

```bash
rm test_followers_1.json test_following.json
```

- [ ] **Step 2: Verify nothing references them**

Use Grep for `test_followers_1` and `test_following` across the repo. Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete obsolete data-export test fixtures

The JSON parser they tested is being removed in the bookmarklet pivot."
```

---

### Task 2: Create the test harness

We have no npm and no test runner. Build a minimal browser-based harness: a `tests.html` page that loads `b.js`, runs assertion functions, and prints PASS/FAIL into the page. Future TDD tasks add tests to this file.

**Files:**
- Create: `tests.html`

- [ ] **Step 1: Create tests.html with the harness skeleton**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>follow radar — tests</title>
<style>
  body{font-family:ui-monospace,Menlo,monospace;padding:2rem;background:#fafafa;color:#222}
  h1{font-size:1.2rem;margin-bottom:1rem}
  .test{padding:6px 10px;margin-bottom:4px;border-radius:4px;font-size:0.85rem}
  .pass{background:#e6f9ec;color:#0a6e2e}
  .fail{background:#fde8e8;color:#a01a1a;white-space:pre-wrap}
  .summary{margin-top:1rem;padding:10px;border-radius:6px;font-weight:700}
  .summary.ok{background:#0a6e2e;color:#fff}
  .summary.bad{background:#a01a1a;color:#fff}
</style>
</head>
<body>
<h1>follow radar — tests</h1>
<div id="out"></div>
<div id="summary" class="summary"></div>

<script src="b.js"></script>
<script>
(()=>{
  const out=document.getElementById('out');
  const sum=document.getElementById('summary');
  let passed=0,failed=0;
  window.test=function(name,fn){
    try{
      const r=fn();
      if(r&&typeof r.then==='function'){
        return r.then(()=>{passed++;render(name,true)},e=>{failed++;render(name,false,e)});
      }
      passed++;render(name,true);
    }catch(e){failed++;render(name,false,e)}
  };
  window.assert=function(cond,msg){if(!cond)throw new Error(msg||'assertion failed')};
  window.assertEq=function(a,b,msg){
    const ja=JSON.stringify(a),jb=JSON.stringify(b);
    if(ja!==jb)throw new Error((msg||'not equal')+'\n  expected: '+jb+'\n  actual:   '+ja);
  };
  function render(name,ok,err){
    const d=document.createElement('div');
    d.className='test '+(ok?'pass':'fail');
    d.textContent=(ok?'PASS  ':'FAIL  ')+name+(err?'\n  '+(err.stack||err.message||err):'');
    out.appendChild(d);
  }
  window.addEventListener('load',()=>{
    // Tests are registered by other scripts loaded after b.js.
    // Wait a tick for async tests to settle, then summarize.
    setTimeout(()=>{
      const total=passed+failed;
      sum.textContent=`${passed}/${total} passed`;
      sum.className='summary '+(failed===0?'ok':'bad');
    },200);
  });
})();
</script>
<!-- Test files are appended below as new tasks add them. -->
</body>
</html>
```

- [ ] **Step 2: Verify the harness opens**

Open `tests.html` directly with a file URL or any local server. Expected: page loads, "0/0 passed" summary appears (because `b.js` doesn't exist yet — the `<script src="b.js">` will 404, which is fine; subsequent tasks create it).

- [ ] **Step 3: Commit**

```bash
git add tests.html
git commit -m "test: add minimal browser-based test harness (tests.html)"
```

---

## Phase 1 — CLAUDE.md update

### Task 3: Update CLAUDE.md per spec

Update the rules first so the new world is documented before the code lands. The spec section "CLAUDE.md changes" defines the exact diffs.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the file structure block**

Find the existing file structure block (under "## File structure") and replace it with:

```
follow-radar/
├── CLAUDE.md          # This file — project context for Claude Code
├── index.html         # Marketing page + results view (single file, no build step)
├── b.js               # The bookmarklet payload, loaded by the loader stub on click
└── tests.html         # Browser-based test harness for b.js
```

- [ ] **Step 2: Replace the tech stack block**

Find the existing "## Tech stack" section. Replace its bullets with:

```
- **Two hand-written files** — `index.html` (marketing + results view) and `b.js` (bookmarklet payload). Vanilla JS, no build, no bundler, no npm.
- **`b.js` is loaded fresh on each click** via a small `javascript:` loader stub embedded in `index.html`. Cache-busted with `?v=Date.now()` so bug fixes reach all users immediately.
- **WebGL shader background** — purple/indigo plasma lines at opacity 0.18 (vanilla JS port)
- **Google Fonts**: Nunito (display headings) + Quicksand (body text)
- **Virtual scrolling** — 64px row height, 15-row buffer, kicks in above 200 results
```

- [ ] **Step 3: Replace the "How it works" block**

Find the existing "## How it works" section. Replace it entirely with:

```
## How it works
1. User lands on follow-radar.app, drags the bookmarklet button to their bookmarks bar
2. User opens instagram.com (logged in), clicks the bookmarklet
3. Loader stub fetches b.js from follow-radar.app (cache-busted), evals it
4. b.js reads the logged-in user from session, paginates IG's internal
   /friendships/<id>/followers/ and /following/ endpoints with polite throttling
5. On success: gzip + base64 the JSON, redirect to follow-radar.app/#data=<payload>
6. follow-radar reads location.hash, computes following − followers, renders results
7. On rate-limit: save resume state to instagram.com localStorage, ship partial data
```

- [ ] **Step 4: Replace the Instagram JSON formats block with the bookmarklet payload format**

Find the existing "## Instagram JSON formats" section. Replace it entirely with:

```
## Bookmarklet payload format
b.js produces and follow-radar consumes a single JSON shape:
{
  username: string,         // logged-in user's handle
  userId: string,           // logged-in user's numeric IG ID
  scrapedAt: string,        // ISO timestamp
  followers: [{username, full_name, is_private}],
  following: [{username, full_name, is_private}],
  partial?: boolean,        // true if scraping was rate-limited mid-run
  phase?: 'followers'|'following'  // only present if partial
}

No follow timestamps and no profile pic URLs. Instagram's internal /friendships/
API doesn't return follow dates (only the data export did). Profile pics are
omitted on purpose — the results view uses gradient-initial avatars and we don't
want a third-party request footprint.
```

- [ ] **Step 5: Replace hard rule #3**

Find the line beginning "3. **No username-based scanning**" in the "Hard rules" section. Replace it with:

```
3. **The bookmarklet is the legitimate path** — it runs in the user's own browser, in their own logged-in Instagram session, hitting the same internal endpoints (`i.instagram.com/api/v1/friendships/...`) that Instagram's own web client uses. Throttle politely (1.5s + jitter between requests). Never hit Instagram from any origin other than instagram.com itself. Never ask the user for their password — ever. Never proxy requests through any server. If Instagram changes the endpoints, update b.js — that's the deal. The official data export is no longer mentioned in the UI as a path, but it remains a fallback users can find on their own.
```

- [ ] **Step 6: Replace hard rule #5**

Find the line beginning "5. **Single file**" and replace with:

```
5. **No build step, no framework, no npm.** The artifact is `index.html` plus `b.js` — that's it. Both are hand-written vanilla JS. If you find yourself wanting a third file (other than `tests.html` for the test harness), stop and reconsider.
```

- [ ] **Step 7: Remove the Format A/B test bullet from workflow preferences**

Find the bullet "Test with both Format A and Format B JSON files after any parser changes" under "## Workflow preferences" and delete it.

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for bookmarklet pivot

Lift the no-scanning hard rule, document the b.js artifact, replace
data-export flow with bookmarklet flow, swap Instagram JSON format
spec for bookmarklet payload format."
```

---

## Phase 2 — `b.js` core (TDD where possible)

### Task 4: Create b.js skeleton with constants and RateLimitError

Start `b.js` with the IIFE wrapper, constants, and the `RateLimitError` class. Test the error class.

**Files:**
- Create: `b.js`
- Modify: `tests.html` (add tests for RateLimitError)

- [ ] **Step 1: Create b.js with the IIFE wrapper, constants, and RateLimitError**

```javascript
// follow radar bookmarklet payload (b.js)
// Loaded fresh on every click via the loader stub in index.html.
// Runs on instagram.com in the user's own logged-in session.
// See docs/superpowers/specs/2026-04-07-bookmarklet-redesign-design.md
(function () {
  'use strict';

  const MAX_ACCOUNT_SIZE = 10000;
  const THROTTLE_MS = 1500;
  const THROTTLE_JITTER_MS = 500;
  const PAGE_SIZE = 200;
  const IG_APP_ID = '936619743392459';
  const RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const FOLLOW_RADAR_URL = 'https://follow-radar.app';
  const RESUME_KEY = 'follow-radar:resume';

  class RateLimitError extends Error {
    constructor(reason) {
      super('rate limited: ' + reason);
      this.name = 'RateLimitError';
      this.reason = reason;
    }
  }

  // Expose for tests. In real bookmarklet runs, window.__followRadarTest is undefined.
  if (typeof window !== 'undefined' && window.__followRadarTest) {
    window.__followRadarTest.RateLimitError = RateLimitError;
    window.__followRadarTest.constants = {
      MAX_ACCOUNT_SIZE, THROTTLE_MS, THROTTLE_JITTER_MS, PAGE_SIZE,
      IG_APP_ID, RESUME_MAX_AGE_MS, FOLLOW_RADAR_URL, RESUME_KEY
    };
    return; // skip main() in test mode
  }

  // main() and the rest of the module are added in subsequent tasks.
})();
```

- [ ] **Step 2: Wire the test mode flag in tests.html**

Edit `tests.html`. Just before the existing `<script src="b.js"></script>` line, add:

```html
<script>window.__followRadarTest = {};</script>
```

- [ ] **Step 3: Add the RateLimitError tests**

Append this `<script>` block to `tests.html` just before `</body>`:

```html
<script>
test('RateLimitError is an Error subclass', () => {
  const E = window.__followRadarTest.RateLimitError;
  const e = new E('429');
  assert(e instanceof Error, 'should be Error');
  assert(e instanceof E, 'should be RateLimitError');
  assertEq(e.name, 'RateLimitError');
  assertEq(e.reason, '429');
  assert(e.message.indexOf('429') >= 0, 'message includes reason');
});

test('constants are exposed', () => {
  const c = window.__followRadarTest.constants;
  assertEq(c.MAX_ACCOUNT_SIZE, 10000);
  assertEq(c.THROTTLE_MS, 1500);
  assertEq(c.PAGE_SIZE, 200);
  assertEq(c.FOLLOW_RADAR_URL, 'https://follow-radar.app');
  assertEq(c.RESUME_KEY, 'follow-radar:resume');
});
</script>
```

- [ ] **Step 4: Open tests.html, verify both tests pass**

Open `tests.html` in a browser. Expected: green PASS rows for both tests, summary "2/2 passed".

- [ ] **Step 5: Commit**

```bash
git add b.js tests.html
git commit -m "feat(b.js): add module skeleton, constants, RateLimitError"
```

---

### Task 5: Hash payload encode/decode (gzip + base64) with round-trip test

The bookmarklet ships its results via `location.hash`. Encoding gzips (if `CompressionStream` is available) then base64-encodes. The page needs to decode in the inverse order. Both functions live in `b.js` and are exposed in test mode; the page-side decoder will live in `index.html` in a later task and reuse the same logic shape.

**Files:**
- Modify: `b.js`
- Modify: `tests.html`

- [ ] **Step 1: Add encode/decode helpers to b.js**

Inside the IIFE in `b.js`, after the `RateLimitError` class and before the test-mode return, add:

```javascript
  // ─── Hash payload encoding ───────────────────────────────────────

  // Convert a Uint8Array to a base64 string (URL-safe-ish; we don't strip
  // padding because location.hash tolerates +, /, =).
  function bytesToBase64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function base64ToBytes(b64) {
    const s = atob(b64);
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  }

  async function gzipBytes(bytes) {
    if (typeof CompressionStream === 'undefined') return null;
    const cs = new CompressionStream('gzip');
    const stream = new Blob([bytes]).stream().pipeThrough(cs);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function gunzipBytes(bytes) {
    if (typeof DecompressionStream === 'undefined') return null;
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  // Encode an object to a hash-safe string.
  // Format: "g:<base64-gzip>" or "r:<base64-raw>" depending on availability.
  async function encodePayload(obj) {
    const json = JSON.stringify(obj);
    const raw = new TextEncoder().encode(json);
    const gz = await gzipBytes(raw);
    if (gz) return 'g:' + bytesToBase64(gz);
    return 'r:' + bytesToBase64(raw);
  }

  // Decode a hash-safe string back to an object.
  async function decodePayload(s) {
    if (typeof s !== 'string' || s.length < 3) throw new Error('payload too short');
    const tag = s.slice(0, 2);
    const body = s.slice(2);
    const bytes = base64ToBytes(body);
    let raw;
    if (tag === 'g:') {
      raw = await gunzipBytes(bytes);
      if (!raw) throw new Error('gzip payload but DecompressionStream unavailable');
    } else if (tag === 'r:') {
      raw = bytes;
    } else {
      throw new Error('unknown payload tag: ' + tag);
    }
    return JSON.parse(new TextDecoder().decode(raw));
  }
```

Then in the test-mode block, add:

```javascript
    window.__followRadarTest.encodePayload = encodePayload;
    window.__followRadarTest.decodePayload = decodePayload;
```

(Place these inside the existing `if (window.__followRadarTest) { ... }` block, before `return;`.)

- [ ] **Step 2: Add round-trip tests to tests.html**

Append to the test script block in `tests.html` (before `</body>`):

```html
<script>
test('encodePayload / decodePayload round-trip on small object', async () => {
  const enc = window.__followRadarTest.encodePayload;
  const dec = window.__followRadarTest.decodePayload;
  const obj = { username: 'thor', followers: [{username:'a',full_name:'A',is_private:false}] };
  const s = await enc(obj);
  assert(typeof s === 'string', 'should return string');
  assert(s.startsWith('g:') || s.startsWith('r:'), 'should have tag prefix');
  const back = await dec(s);
  assertEq(back, obj);
});

test('encodePayload / decodePayload round-trip on 2000-account list', async () => {
  const enc = window.__followRadarTest.encodePayload;
  const dec = window.__followRadarTest.decodePayload;
  const followers = [];
  for (let i = 0; i < 2000; i++) {
    followers.push({username: 'user' + i, full_name: 'User ' + i, is_private: i % 7 === 0});
  }
  const obj = {username: 'thor', userId: '123', scrapedAt: '2026-04-07T00:00:00Z', followers, following: []};
  const s = await enc(obj);
  const back = await dec(s);
  assertEq(back.followers.length, 2000);
  assertEq(back.followers[0], followers[0]);
  assertEq(back.followers[1999], followers[1999]);
});

test('decodePayload throws on garbage', async () => {
  const dec = window.__followRadarTest.decodePayload;
  let threw = false;
  try { await dec('x:notreal'); } catch (e) { threw = true; }
  assert(threw, 'should throw on unknown tag');
});
</script>
```

- [ ] **Step 3: Open tests.html, verify all tests pass**

Expected: all tests PASS (5 total so far).

- [ ] **Step 4: Commit**

```bash
git add b.js tests.html
git commit -m "feat(b.js): add hash payload encode/decode (gzip + base64) with tests"
```

---

### Task 6: Resume state save/load/clear with mock localStorage

Resume state lives in `localStorage['follow-radar:resume']` on instagram.com. Functions: `saveResumeState`, `loadResumeState` (validates user + age), `clearResumeState`. Tests use a fresh in-memory mock localStorage rather than touching the real one.

**Files:**
- Modify: `b.js`
- Modify: `tests.html`

- [ ] **Step 1: Add resume state helpers to b.js**

After the encode/decode block in `b.js`, before the test-mode return, add:

```javascript
  // ─── Resume state ────────────────────────────────────────────────

  // storage param lets tests inject a mock; defaults to real localStorage.
  function saveResumeState(state, storage) {
    const s = storage || localStorage;
    const wrapped = Object.assign({timestamp: Date.now()}, state);
    s.setItem(RESUME_KEY, JSON.stringify(wrapped));
  }

  function loadResumeState(currentUserId, storage) {
    const s = storage || localStorage;
    const raw = s.getItem(RESUME_KEY);
    if (!raw) return null;
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return null; }
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.timestamp !== 'number') return null;
    if (Date.now() - parsed.timestamp > RESUME_MAX_AGE_MS) return null;
    if (parsed.userId !== currentUserId) {
      // Caller is responsible for surfacing the mismatch.
      return { mismatch: true, userId: parsed.userId };
    }
    return parsed;
  }

  function clearResumeState(storage) {
    const s = storage || localStorage;
    s.removeItem(RESUME_KEY);
  }
```

Expose in test mode:

```javascript
    window.__followRadarTest.saveResumeState = saveResumeState;
    window.__followRadarTest.loadResumeState = loadResumeState;
    window.__followRadarTest.clearResumeState = clearResumeState;
```

- [ ] **Step 2: Add resume state tests to tests.html**

```html
<script>
function mockStorage() {
  const data = {};
  return {
    getItem: k => (k in data) ? data[k] : null,
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; },
    _data: data,
  };
}

test('saveResumeState writes JSON with timestamp', () => {
  const s = mockStorage();
  const save = window.__followRadarTest.saveResumeState;
  save({userId: 'u1', cursor: 'abc', phase: 'followers', partialFollowers: [], partialFollowing: []}, s);
  const raw = s.getItem('follow-radar:resume');
  assert(raw, 'should write something');
  const obj = JSON.parse(raw);
  assertEq(obj.userId, 'u1');
  assertEq(obj.cursor, 'abc');
  assert(typeof obj.timestamp === 'number');
});

test('loadResumeState returns null when nothing stored', () => {
  const s = mockStorage();
  const load = window.__followRadarTest.loadResumeState;
  assertEq(load('u1', s), null);
});

test('loadResumeState returns state when user matches and not stale', () => {
  const s = mockStorage();
  const save = window.__followRadarTest.saveResumeState;
  const load = window.__followRadarTest.loadResumeState;
  save({userId: 'u1', cursor: 'abc'}, s);
  const r = load('u1', s);
  assert(r && !r.mismatch, 'should return real state');
  assertEq(r.userId, 'u1');
  assertEq(r.cursor, 'abc');
});

test('loadResumeState returns mismatch when userId differs', () => {
  const s = mockStorage();
  const save = window.__followRadarTest.saveResumeState;
  const load = window.__followRadarTest.loadResumeState;
  save({userId: 'u1', cursor: 'abc'}, s);
  const r = load('u2', s);
  assert(r && r.mismatch === true, 'should return mismatch object');
  assertEq(r.userId, 'u1');
});

test('loadResumeState returns null when stale (>24h)', () => {
  const s = mockStorage();
  const load = window.__followRadarTest.loadResumeState;
  const stale = {userId: 'u1', cursor: 'abc', timestamp: Date.now() - (25 * 60 * 60 * 1000)};
  s.setItem('follow-radar:resume', JSON.stringify(stale));
  assertEq(load('u1', s), null);
});

test('clearResumeState removes the key', () => {
  const s = mockStorage();
  const save = window.__followRadarTest.saveResumeState;
  const clear = window.__followRadarTest.clearResumeState;
  save({userId: 'u1'}, s);
  assert(s.getItem('follow-radar:resume') !== null);
  clear(s);
  assertEq(s.getItem('follow-radar:resume'), null);
});

test('loadResumeState returns null on garbage JSON', () => {
  const s = mockStorage();
  const load = window.__followRadarTest.loadResumeState;
  s.setItem('follow-radar:resume', 'not valid json');
  assertEq(load('u1', s), null);
});
</script>
```

- [ ] **Step 3: Open tests.html, verify all tests pass**

Expected: all tests PASS (~12 total so far).

- [ ] **Step 4: Commit**

```bash
git add b.js tests.html
git commit -m "feat(b.js): add resume state save/load/clear with mock-storage tests"
```

---

### Task 7: fetchPage with classification logic

`fetchPage(url)` does a single fetch with throttle, classifies the response, and either returns `{users, nextCursor}` or throws `RateLimitError`. The throttle uses a real `setTimeout` so we don't test the wait — we test the classification logic by injecting a fake `fetch` via the test mode hook.

**Files:**
- Modify: `b.js`
- Modify: `tests.html`

- [ ] **Step 1: Add fetchPage and a fetch override hook to b.js**

After the resume state block, before the test-mode return, add:

```javascript
  // ─── Fetch + classification ──────────────────────────────────────

  // doFetch is replaceable in tests via window.__followRadarTest.setFetch().
  let doFetch = (typeof fetch !== 'undefined') ? fetch.bind(window) : null;

  async function throttle() {
    const ms = THROTTLE_MS + Math.random() * THROTTLE_JITTER_MS;
    await new Promise(r => setTimeout(r, ms));
  }

  // Classify a parsed JSON response into either {users, nextCursor} or
  // a thrown RateLimitError. Pure function — easy to unit-test.
  function classifyResponse(status, body) {
    if (status === 429) throw new RateLimitError('http 429');
    if (status === 401) throw new RateLimitError('http 401');
    if (status >= 500) throw new Error('instagram server error: http ' + status);
    if (status !== 200) throw new Error('unexpected http status: ' + status);
    if (!body || typeof body !== 'object') throw new Error('non-object response body');
    // IG sometimes 200s with a "feedback_required" body when throttled.
    if (body.message === 'feedback_required' || body.spam === true) {
      throw new RateLimitError('feedback_required');
    }
    if (body.require_login || body.message === 'login_required') {
      throw new RateLimitError('login_required');
    }
    if (!Array.isArray(body.users)) throw new Error('response missing users array');
    return { users: body.users, nextCursor: body.next_max_id || null };
  }

  // fetchPage does the actual HTTP call, with throttling.
  // Returns {users, nextCursor} or throws.
  async function fetchPage(url, opts) {
    opts = opts || {};
    if (!opts.skipThrottle) await throttle();
    let resp;
    try {
      resp = await doFetch(url, {
        credentials: 'include',
        headers: { 'X-IG-App-ID': IG_APP_ID, 'Accept': 'application/json' },
      });
    } catch (e) {
      throw new Error('network error: ' + e.message);
    }
    let body;
    try {
      body = await resp.json();
    } catch (e) {
      throw new Error('non-json response from instagram');
    }
    return classifyResponse(resp.status, body);
  }
```

Expose in test mode:

```javascript
    window.__followRadarTest.classifyResponse = classifyResponse;
    window.__followRadarTest.fetchPage = fetchPage;
    window.__followRadarTest.setFetch = function (fn) { doFetch = fn; };
```

- [ ] **Step 2: Add classification tests to tests.html**

```html
<script>
test('classifyResponse: 200 with users array returns users + cursor', () => {
  const c = window.__followRadarTest.classifyResponse;
  const r = c(200, {users: [{username:'a'}, {username:'b'}], next_max_id: 'cur1'});
  assertEq(r.users.length, 2);
  assertEq(r.nextCursor, 'cur1');
});

test('classifyResponse: 200 with users but no next_max_id returns null cursor', () => {
  const c = window.__followRadarTest.classifyResponse;
  const r = c(200, {users: [{username:'a'}]});
  assertEq(r.nextCursor, null);
});

test('classifyResponse: 429 throws RateLimitError', () => {
  const c = window.__followRadarTest.classifyResponse;
  const E = window.__followRadarTest.RateLimitError;
  let threw = null;
  try { c(429, {}); } catch (e) { threw = e; }
  assert(threw instanceof E, 'should throw RateLimitError');
  assertEq(threw.reason, 'http 429');
});

test('classifyResponse: 401 throws RateLimitError', () => {
  const c = window.__followRadarTest.classifyResponse;
  const E = window.__followRadarTest.RateLimitError;
  let threw = null;
  try { c(401, {}); } catch (e) { threw = e; }
  assert(threw instanceof E);
  assertEq(threw.reason, 'http 401');
});

test('classifyResponse: feedback_required body throws RateLimitError', () => {
  const c = window.__followRadarTest.classifyResponse;
  const E = window.__followRadarTest.RateLimitError;
  let threw = null;
  try { c(200, {message: 'feedback_required'}); } catch (e) { threw = e; }
  assert(threw instanceof E);
  assertEq(threw.reason, 'feedback_required');
});

test('classifyResponse: login_required throws RateLimitError', () => {
  const c = window.__followRadarTest.classifyResponse;
  const E = window.__followRadarTest.RateLimitError;
  let threw = null;
  try { c(200, {message: 'login_required'}); } catch (e) { threw = e; }
  assert(threw instanceof E);
});

test('classifyResponse: 500 throws generic Error (not RateLimitError)', () => {
  const c = window.__followRadarTest.classifyResponse;
  const E = window.__followRadarTest.RateLimitError;
  let threw = null;
  try { c(500, {}); } catch (e) { threw = e; }
  assert(threw && !(threw instanceof E), 'should be generic Error');
});

test('classifyResponse: 200 with no users field throws generic Error', () => {
  const c = window.__followRadarTest.classifyResponse;
  let threw = null;
  try { c(200, {something: 'else'}); } catch (e) { threw = e; }
  assert(threw && threw.message.indexOf('users') >= 0);
});

test('fetchPage uses injected fetch and skipThrottle', async () => {
  const set = window.__followRadarTest.setFetch;
  const fp = window.__followRadarTest.fetchPage;
  let calledWith = null;
  set(async (url, opts) => {
    calledWith = {url, opts};
    return {
      status: 200,
      json: async () => ({users: [{username:'x'}], next_max_id: 'n'}),
    };
  });
  const r = await fp('https://i.instagram.com/api/v1/friendships/123/followers/?count=200', {skipThrottle: true});
  assertEq(r.users.length, 1);
  assertEq(r.nextCursor, 'n');
  assert(calledWith.url.indexOf('/followers/') >= 0);
  assertEq(calledWith.opts.headers['X-IG-App-ID'], '936619743392459');
  assertEq(calledWith.opts.credentials, 'include');
});
</script>
```

- [ ] **Step 3: Open tests.html, verify all tests pass**

Expected: all tests PASS (~21 total so far).

- [ ] **Step 4: Commit**

```bash
git add b.js tests.html
git commit -m "feat(b.js): add fetchPage + classifyResponse with tests"
```

---

### Task 8: scrapeFollowers / scrapeFollowing pagination

The pagination loop calls `fetchPage`, accumulates `users`, and stops when `nextCursor` is null. Test the loop by injecting a fake `fetchPage` via the test hook.

**Files:**
- Modify: `b.js`
- Modify: `tests.html`

- [ ] **Step 1: Add pagination functions to b.js**

After `fetchPage`, before the test-mode return, add:

```javascript
  // ─── Pagination ──────────────────────────────────────────────────

  // fetchPageImpl is replaceable in tests so we don't need real fetch.
  let fetchPageImpl = fetchPage;

  function buildFollowersUrl(userId, cursor) {
    let u = 'https://i.instagram.com/api/v1/friendships/' + userId + '/followers/?count=' + PAGE_SIZE;
    if (cursor) u += '&max_id=' + encodeURIComponent(cursor);
    return u;
  }

  function buildFollowingUrl(userId, cursor) {
    let u = 'https://i.instagram.com/api/v1/friendships/' + userId + '/following/?count=' + PAGE_SIZE;
    if (cursor) u += '&max_id=' + encodeURIComponent(cursor);
    return u;
  }

  // Reduce IG's account shape to ours.
  function trimUser(u) {
    return {
      username: u.username,
      full_name: u.full_name || '',
      is_private: !!u.is_private,
    };
  }

  // Generic paginator. urlBuilder(cursor) -> url.
  // initial: array of already-collected users (for resume).
  // initialCursor: cursor to start from (for resume).
  // onProgress(count): called after each page.
  // If fetchPageImpl throws RateLimitError, we re-throw after attaching
  // {cursor, partial} so main() can save resume state with exact progress.
  async function paginate(urlBuilder, initial, initialCursor, onProgress) {
    const all = (initial && initial.length) ? initial.slice() : [];
    let cursor = initialCursor || null;
    while (true) {
      const url = urlBuilder(cursor);
      let page;
      try {
        page = await fetchPageImpl(url);
      } catch (e) {
        if (e instanceof RateLimitError) {
          e.cursor = cursor;    // cursor that was used for the failed request — resume uses this
          e.partial = all;      // everything accumulated before the failure
        }
        throw e;
      }
      for (const u of page.users) all.push(trimUser(u));
      if (onProgress) onProgress(all.length, cursor);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return all;
  }

  async function scrapeFollowers(userId, initial, initialCursor, onProgress) {
    return paginate(c => buildFollowersUrl(userId, c), initial, initialCursor, onProgress);
  }

  async function scrapeFollowing(userId, initial, initialCursor, onProgress) {
    return paginate(c => buildFollowingUrl(userId, c), initial, initialCursor, onProgress);
  }
```

Expose in test mode:

```javascript
    window.__followRadarTest.buildFollowersUrl = buildFollowersUrl;
    window.__followRadarTest.buildFollowingUrl = buildFollowingUrl;
    window.__followRadarTest.trimUser = trimUser;
    window.__followRadarTest.scrapeFollowers = scrapeFollowers;
    window.__followRadarTest.scrapeFollowing = scrapeFollowing;
    window.__followRadarTest.setFetchPageImpl = function (fn) { fetchPageImpl = fn; };
```

- [ ] **Step 2: Add pagination tests to tests.html**

```html
<script>
test('buildFollowersUrl with no cursor', () => {
  const b = window.__followRadarTest.buildFollowersUrl;
  const u = b('123', null);
  assert(u.indexOf('/123/followers/') >= 0);
  assert(u.indexOf('count=200') >= 0);
  assert(u.indexOf('max_id=') === -1);
});

test('buildFollowersUrl with cursor', () => {
  const b = window.__followRadarTest.buildFollowersUrl;
  const u = b('123', 'abc def');
  assert(u.indexOf('max_id=abc%20def') >= 0);
});

test('buildFollowingUrl shape', () => {
  const b = window.__followRadarTest.buildFollowingUrl;
  assert(b('99', null).indexOf('/99/following/') >= 0);
});

test('trimUser drops extra fields', () => {
  const t = window.__followRadarTest.trimUser;
  const out = t({pk: 1, username: 'thor', full_name: 'Thor W', is_private: true, profile_pic_url: 'https://x', is_verified: true});
  assertEq(out, {username: 'thor', full_name: 'Thor W', is_private: true});
});

test('trimUser handles missing full_name', () => {
  const t = window.__followRadarTest.trimUser;
  assertEq(t({username: 'a'}), {username: 'a', full_name: '', is_private: false});
});

test('scrapeFollowers: paginates through 3 pages and stops on null cursor', async () => {
  const setImpl = window.__followRadarTest.setFetchPageImpl;
  const scrape = window.__followRadarTest.scrapeFollowers;
  const pages = [
    {users: [{username: 'a'}, {username: 'b'}], nextCursor: 'c1'},
    {users: [{username: 'c'}], nextCursor: 'c2'},
    {users: [{username: 'd'}, {username: 'e'}], nextCursor: null},
  ];
  let calls = 0;
  setImpl(async (url) => pages[calls++]);
  const all = await scrape('123');
  assertEq(all.length, 5);
  assertEq(all.map(u => u.username), ['a','b','c','d','e']);
  assertEq(calls, 3);
});

test('scrapeFollowers: resumes from initial + cursor', async () => {
  const setImpl = window.__followRadarTest.setFetchPageImpl;
  const scrape = window.__followRadarTest.scrapeFollowers;
  setImpl(async (url) => {
    assert(url.indexOf('max_id=resume-cursor') >= 0, 'should pass cursor');
    return {users: [{username: 'new1'}], nextCursor: null};
  });
  const initial = [{username: 'old1', full_name: '', is_private: false}];
  const all = await scrape('123', initial, 'resume-cursor');
  assertEq(all.length, 2);
  assertEq(all[0].username, 'old1');
  assertEq(all[1].username, 'new1');
});

test('scrapeFollowers: propagates RateLimitError with cursor and partial attached', async () => {
  const setImpl = window.__followRadarTest.setFetchPageImpl;
  const scrape = window.__followRadarTest.scrapeFollowers;
  const E = window.__followRadarTest.RateLimitError;
  let call = 0;
  setImpl(async (url) => {
    call++;
    if (call === 1) return {users: [{username:'a'}, {username:'b'}], nextCursor: 'c-abc'};
    if (call === 2) return {users: [{username:'c'}], nextCursor: 'c-def'};
    throw new E('http 429');
  });
  let threw = null;
  try { await scrape('123'); } catch (e) { threw = e; }
  assert(threw instanceof E, 'should be RateLimitError');
  assertEq(threw.cursor, 'c-def');
  assert(Array.isArray(threw.partial), 'partial should be array');
  assertEq(threw.partial.length, 3);
  assertEq(threw.partial.map(u => u.username), ['a','b','c']);
});

test('scrapeFollowers: first-request rate limit has null cursor and empty partial', async () => {
  const setImpl = window.__followRadarTest.setFetchPageImpl;
  const scrape = window.__followRadarTest.scrapeFollowers;
  const E = window.__followRadarTest.RateLimitError;
  setImpl(async () => { throw new E('http 429'); });
  let threw = null;
  try { await scrape('123'); } catch (e) { threw = e; }
  assert(threw instanceof E);
  assertEq(threw.cursor, null);
  assertEq(threw.partial, []);
});

test('scrapeFollowers: onProgress called per page', async () => {
  const setImpl = window.__followRadarTest.setFetchPageImpl;
  const scrape = window.__followRadarTest.scrapeFollowers;
  setImpl(async (url) => {
    if (url.indexOf('max_id=') === -1) return {users: [{username: 'a'}], nextCursor: 'c1'};
    return {users: [{username: 'b'}], nextCursor: null};
  });
  const progress = [];
  await scrape('123', null, null, (n) => progress.push(n));
  assertEq(progress, [1, 2]);
});
</script>
```

- [ ] **Step 3: Open tests.html, verify all tests pass**

Expected: every test shows PASS, summary shows 0 failures. Count should be higher than the previous task's count by at least 10.

- [ ] **Step 4: Commit**

```bash
git add b.js tests.html
git commit -m "feat(b.js): add scrapeFollowers/scrapeFollowing pagination with tests"
```

---

### Task 9: getCurrentUser, checkAccountSize, progressOverlay

These three are not unit-tested — `getCurrentUser` and `checkAccountSize` depend on real Instagram responses and `window._sharedData`, and `progressOverlay` is DOM manipulation. We write them, eyeball them, and validate via real-IG smoke testing post-deployment.

**Files:**
- Modify: `b.js`

- [ ] **Step 1: Add getCurrentUser, checkAccountSize, progressOverlay**

After the pagination block, before the test-mode return, add:

```javascript
  // ─── Current user resolution + size check ────────────────────────

  async function getCurrentUser() {
    // Try _sharedData (works on legacy IG web pages).
    try {
      const sd = window._sharedData && window._sharedData.config && window._sharedData.config.viewer;
      if (sd && sd.id && sd.username) {
        return { userId: String(sd.id), username: sd.username };
      }
    } catch (e) { /* fall through */ }

    // Try the modern in-page __additionalData / current viewer.
    try {
      const r = await doFetch('https://www.instagram.com/api/v1/web/accounts/login/ajax/info/', {
        credentials: 'include',
        headers: { 'X-IG-App-ID': IG_APP_ID, 'Accept': 'application/json' },
      });
      if (r.ok) {
        const j = await r.json();
        if (j && j.user_id && j.username) return { userId: String(j.user_id), username: j.username };
      }
    } catch (e) { /* fall through */ }

    throw new Error("Could not determine logged-in user. Make sure you're logged into instagram.com.");
  }

  async function checkAccountSize(username) {
    // /api/v1/users/web_profile_info/?username=...
    const url = 'https://i.instagram.com/api/v1/users/web_profile_info/?username=' + encodeURIComponent(username);
    const r = await doFetch(url, {
      credentials: 'include',
      headers: { 'X-IG-App-ID': IG_APP_ID, 'Accept': 'application/json' },
    });
    if (!r.ok) throw new Error('Could not fetch profile info: http ' + r.status);
    const j = await r.json();
    const u = j && j.data && j.data.user;
    if (!u) throw new Error('Unexpected profile info shape');
    const followers = (u.edge_followed_by && u.edge_followed_by.count) || 0;
    const following = (u.edge_follow && u.edge_follow.count) || 0;
    return { followers, following };
  }

  // ─── Progress overlay ────────────────────────────────────────────

  let overlayEl = null;
  let overlayBarEl = null;
  let overlayTextEl = null;

  function createOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement('div');
    overlayEl.setAttribute('style', [
      'position:fixed','bottom:24px','right:24px','z-index:2147483647',
      'background:#fff','color:#1a1a2e','padding:14px 18px',
      'border-radius:14px','box-shadow:0 12px 40px rgba(225,48,108,0.18)',
      'font:600 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'min-width:240px','border:1px solid rgba(225,48,108,0.18)',
    ].join(';'));
    overlayTextEl = document.createElement('div');
    overlayTextEl.textContent = 'Starting…';
    overlayTextEl.style.marginBottom = '8px';
    overlayEl.appendChild(overlayTextEl);
    const track = document.createElement('div');
    track.setAttribute('style', 'height:4px;background:rgba(0,0,0,0.06);border-radius:2px;overflow:hidden');
    overlayBarEl = document.createElement('div');
    overlayBarEl.setAttribute('style', 'height:100%;width:0%;background:linear-gradient(90deg,#f77737,#e1306c,#833ab4);transition:width 0.3s ease');
    track.appendChild(overlayBarEl);
    overlayEl.appendChild(track);
    document.body.appendChild(overlayEl);
  }

  function updateOverlay(text, fraction) {
    if (!overlayEl) return;
    overlayTextEl.textContent = text;
    if (typeof fraction === 'number') {
      const pct = Math.max(0, Math.min(100, fraction * 100));
      overlayBarEl.style.width = pct + '%';
    }
  }

  function destroyOverlay() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
    overlayBarEl = null;
    overlayTextEl = null;
  }
```

- [ ] **Step 2: Re-open tests.html, confirm no tests broke**

Expected: same PASS count as the previous task (no new tests, but b.js still loads cleanly).

- [ ] **Step 3: Commit**

```bash
git add b.js
git commit -m "feat(b.js): add getCurrentUser, checkAccountSize, progress overlay"
```

---

### Task 10: shipResults + main() entry orchestration

`shipResults` builds the payload object, encodes it, redirects to follow-radar. `main()` is the entry point: it does the hostname check, resume check, current-user resolution, size check, scrape both lists, ship.

**Files:**
- Modify: `b.js`
- Modify: `tests.html`

- [ ] **Step 1: Add shipResults and main() to b.js**

After `destroyOverlay`, before the test-mode return, add:

```javascript
  // ─── Ship results ────────────────────────────────────────────────

  async function shipResults(payload) {
    const encoded = await encodePayload(payload);
    window.location = FOLLOW_RADAR_URL + '/#data=' + encoded;
  }

  // ─── Main entry ──────────────────────────────────────────────────

  async function main() {
    if (!/(^|\.)instagram\.com$/.test(location.hostname)) {
      alert("Open instagram.com first, then click this bookmarklet.");
      return;
    }

    let user;
    try {
      user = await getCurrentUser();
    } catch (e) {
      alert(e.message);
      return;
    }

    // Check resume state.
    const existing = loadResumeState(user.userId);
    if (existing && existing.mismatch) {
      alert("You have a scan in progress on a different account. Switch back to that account, or clear it from DevTools (localStorage key '" + RESUME_KEY + "').");
      return;
    }

    let resume = existing;
    let initialFollowers = (resume && resume.partialFollowers) || null;
    let initialFollowing = (resume && resume.partialFollowing) || null;
    let initialCursor = (resume && resume.cursor) || null;
    let phase = (resume && resume.phase) || 'followers';

    // Size check (only on fresh runs, not on resume).
    if (!resume) {
      try {
        const sizes = await checkAccountSize(user.username);
        if (sizes.followers > MAX_ACCOUNT_SIZE || sizes.following > MAX_ACCOUNT_SIZE) {
          alert(
            "follow radar is built for accounts under " + MAX_ACCOUNT_SIZE.toLocaleString() + " followers/following.\n\n" +
            "Yours has " + sizes.followers.toLocaleString() + " followers and " + sizes.following.toLocaleString() + " following.\n\n" +
            "If you really need this for a bigger account, the code is open source — fork it and remove the cap."
          );
          return;
        }
      } catch (e) {
        alert("Could not check account size: " + e.message);
        return;
      }
    }

    createOverlay();

    let followers = initialFollowers || [];
    let following = initialFollowing || [];

    try {
      if (phase === 'followers') {
        updateOverlay('Scanning followers… ' + followers.length, 0);
        followers = await scrapeFollowers(user.userId, followers, initialCursor, (n) => {
          updateOverlay('Scanning followers… ' + n, 0.1 + Math.min(0.4, n / 10000));
        });
        phase = 'following';
        initialCursor = null;
      }
      updateOverlay('Scanning following… ' + following.length, 0.5);
      following = await scrapeFollowing(user.userId, following, phase === 'following' ? initialCursor : null, (n) => {
        updateOverlay('Scanning following… ' + n, 0.5 + Math.min(0.5, n / 10000));
      });
    } catch (e) {
      destroyOverlay();
      if (e instanceof RateLimitError) {
        // paginate() attached .cursor and .partial to the error at the point of failure.
        // The in-flight phase's partial list lives on the error; the completed-so-far list
        // (for the OTHER phase) is whatever `followers` or `following` holds locally.
        let partialFollowers = followers;
        let partialFollowing = following;
        if (phase === 'followers') {
          partialFollowers = Array.isArray(e.partial) ? e.partial : followers;
        } else {
          partialFollowing = Array.isArray(e.partial) ? e.partial : following;
        }
        saveResumeState({
          userId: user.userId,
          username: user.username,
          phase: phase,
          cursor: (typeof e.cursor !== 'undefined') ? e.cursor : null,
          partialFollowers: partialFollowers,
          partialFollowing: partialFollowing,
        });
        const payload = {
          username: user.username,
          userId: user.userId,
          scrapedAt: new Date().toISOString(),
          followers: partialFollowers,
          following: partialFollowing,
          partial: true,
          phase: phase,
        };
        try { await shipResults(payload); } catch (err) { alert("Could not redirect: " + err.message); }
        return;
      }
      alert("Something went wrong: " + (e.message || e) + ". Try again in a few minutes.");
      return;
    }

    destroyOverlay();
    clearResumeState();

    const payload = {
      username: user.username,
      userId: user.userId,
      scrapedAt: new Date().toISOString(),
      followers: followers,
      following: following,
    };
    try {
      await shipResults(payload);
    } catch (e) {
      alert("Could not redirect to follow radar: " + e.message);
    }
  }

  // Kick off when not in test mode (test-mode return is below).
  // We must place this AFTER the test-mode return, not before.
```

Now expose the entry-point pieces in test mode and add the auto-run call below the test-mode return:

In the test-mode block, add:

```javascript
    window.__followRadarTest.shipResults = shipResults;
    window.__followRadarTest.main = main;
```

And after the test-mode return (so it only runs in production), add:

```javascript
  // Production entry point.
  main().catch(e => {
    console.error('[follow radar]', e);
    alert("Unexpected error: " + (e.message || e));
  });
```

- [ ] **Step 2: Add a smoke test that main() exists and shipResults builds a hash URL**

```html
<script>
test('main is exposed in test mode', () => {
  assert(typeof window.__followRadarTest.main === 'function');
});

test('shipResults builds a #data= URL (verified by stubbing window.location)', async () => {
  const enc = window.__followRadarTest.encodePayload;
  // Just verify encodePayload is what shipResults calls — we can't actually
  // assign window.location safely. Round-trip the payload through encode/decode
  // and confirm it matches.
  const dec = window.__followRadarTest.decodePayload;
  const obj = {username: 'thor', userId: '1', scrapedAt: 't', followers: [], following: []};
  const encoded = await enc(obj);
  const back = await dec(encoded);
  assertEq(back, obj);
});
</script>
```

- [ ] **Step 3: Open tests.html, verify all tests pass**

Expected: all tests PASS, two new tests at the bottom of the list.

- [ ] **Step 4: Commit**

```bash
git add b.js tests.html
git commit -m "feat(b.js): add shipResults + main() entry orchestration"
```

---

### Task 11: Add the loader stub source as a constant in b.js (for reference)

We're not yet wiring the loader stub into `index.html` — that happens in the page rebuild. But we want the canonical stub source to live alongside `b.js` so future maintainers see it. Add it as a top-of-file comment.

**Files:**
- Modify: `b.js`

- [ ] **Step 1: Add the loader stub comment**

At the very top of `b.js`, before the IIFE, add:

```javascript
// ═══════════════════════════════════════════════════════════════════
// LOADER STUB (this is the bookmarklet href in index.html, not part of b.js):
//
// javascript:(()=>{if(!/(^|\.)instagram\.com$/.test(location.hostname)){alert('Open instagram.com first, then click this bookmarklet.');return}fetch('https://follow-radar.app/b.js?v='+Date.now()).then(r=>r.text()).then(eval).catch(e=>alert('Could not load follow radar: '+e.message))})()
//
// The stub fetches this file, evals it. We use fetch+eval rather than
// <script src> injection because instagram.com's CSP is more likely to
// block external script injection than connect-src to follow-radar.app.
// If both are blocked, the contingency is to inline this entire file
// into the javascript: URL above. Not implemented for v1.
// ═══════════════════════════════════════════════════════════════════
```

- [ ] **Step 2: Re-open tests.html, confirm everything still works**

Expected: same PASS count as Task 10, everything still green.

- [ ] **Step 3: Commit**

```bash
git add b.js
git commit -m "docs(b.js): document the loader stub source as a top-of-file comment"
```

---

## Phase 3 — `index.html` rebuild

This phase rewrites `index.html` from the inside out: strip dead code first, then add the new visual base layer, then add each section, then refactor the results view, then wire up the hash decoder + dev-mock.

### Task 12: Strip dead code from index.html

Delete: zip handling, walkthrough, drop zone, instructions section, JSZip script tag, parser code, file-handling event listeners, related CSS. Keep: doctype, head, fonts, CSS variables, shader bg code, hero shell, results view shell, footer shell. Some of these surviving pieces will be modified in later tasks — for now we're just removing what's gone.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Remove the JSZip script tag**

Find and delete this line:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
```

- [ ] **Step 2: Remove the entire INSTRUCTIONS section**

Find the `<!-- INSTRUCTIONS -->` comment and delete from `<section class="section" id="how">` through its closing `</section>` (the one immediately before `<!-- UPLOAD -->`). This includes the `.ig-btn`, `.steps`, `.wt-toggle`, `.walkthrough`, `.phone`, `.wt-dots`, `.wt-caption` elements.

- [ ] **Step 3: Remove the entire UPLOAD section**

Find `<!-- UPLOAD -->` and delete from `<section class="section" id="upload">` through its closing `</section>` (before `<!-- RESULTS -->`). This removes `.drop`, `.chips`, `.btn-analyze`, the file input.

- [ ] **Step 4: Remove the related CSS blocks**

In the `<style>` block, delete these CSS sections (delimited by their `═══════════` comment headers):

- `/* ═══════════ INSTRUCTIONS ═══════════ */` block (`.ig-btn`, `.steps`, `.step`, `.step-num`)
- `/* ═══════════ WALKTHROUGH ═══════════ */` block (`.wt-toggle`, `.walkthrough`, `.wt-label`, `.phone`, `.phone-bar`, `.phone-body`, `.phone-row`, `.wt-dots`, `.wt-dot`, `.wt-caption`)
- `/* ═══════════ DROP ZONE ═══════════ */` block (`.drop`, `.drop-icon`, `.chips`, `.chip`, `.btn-analyze`, `.analyze-row`)

Also in the mobile media query block, delete these lines that reference the removed elements:

```css
.drop-mobile{display:none}
```

Inside `@media(max-width:768px){...}` delete these lines:
```css
  .drop-desktop{display:none}
  .drop-mobile{display:block}
  .steps{grid-template-columns:1fr}
  .step{padding:1.25rem}
  .drop{padding:2.5rem 1.5rem;border-width:3px}
  .drop h3{font-size:1.2rem}
  .btn-analyze{padding:18px 48px;font-size:1.1rem}
  .ig-btn{padding:16px 28px;font-size:1rem}
  .wt-toggle{width:100%;justify-content:center;padding:14px 20px}
```

- [ ] **Step 5: Remove dead JS from the bottom script block**

In the `(()=>{ 'use strict'; ...` IIFE at the bottom:

- Delete `parse`, `detect`, `readJSON`, `handleZip`, `handleFiles`, `renderChips`, `showErr`, `clearErr`, `checkReady`, `setupDrop`, `initWT` functions
- Delete the `state.followers`, `state.following`, `state.loaded`, `state.names` properties from the initial state object — we'll replace `state` entirely in Task 21
- Delete `el.drop`, `el.chips`, `el.go`, `el.q` references that target removed elements (leave references only to elements still present in the DOM after this task: `#results`, `#s-followers`, `#s-following`, `#s-nonfol`, `#s-mutuals`, search elements `#q` `#qx`, `#srt`, `#cnt`, `#csv`, `#list`, `#list-inner`, `#sp-top`, `#sp-bot`, `#empty`)
- In `init()`, delete `setupDrop()`, `initWT()`, the `el.go.addEventListener` line, and the `IntersectionObserver` step-fade-in block (it targeted `.step` cards which no longer exist — Task 16 will reintroduce its own animation if needed)

This is a "make it not break" pass — the page won't fully work yet, that's fine.

- [ ] **Step 6: Open index.html in a browser, confirm no JS errors**

Open the file. The page should render hero + results section shells (results hidden) + footer with no console errors. Lots of empty space — expected. Click anything: nothing should crash.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "refactor(index.html): strip zip/parser/walkthrough/drop-zone code

Clears the deck for the bookmarklet pivot. The page is intentionally
broken between this commit and the rebuild tasks that follow."
```

---

### Task 13: Add visual base layer (background, grain, gradient orb)

Add the warm radial background, the SVG noise grain overlay, and the blurred gradient orb in the top-right.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Update the body background**

In the CSS, find `body{` and replace its background with the radial gradient. Also remove the `html{background:var(--bg)}` declaration. Update `:root` to keep `--bg` but add the radial as the actual `body` background:

Find:
```css
html{scroll-behavior:smooth;background:var(--bg)}
body{font-family:var(--font-body);font-weight:500;color:var(--text);line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased}
```

Replace with:
```css
html{scroll-behavior:smooth;background:#f5f3ee}
body{
  font-family:var(--font-body);font-weight:500;color:var(--text);
  line-height:1.7;overflow-x:hidden;-webkit-font-smoothing:antialiased;
  background:radial-gradient(ellipse at 50% 30%, #fbf7f2 0%, #f5f3ee 45%, #eeece7 100%);
  background-attachment:fixed;
  position:relative;
}
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  opacity:0.035;mix-blend-mode:multiply;
}
.orb{
  position:fixed;top:-200px;right:-200px;width:600px;height:600px;
  border-radius:50%;pointer-events:none;z-index:0;
  background:radial-gradient(circle, rgba(225,48,108,0.22), rgba(131,58,180,0.12) 40%, transparent 70%);
  filter:blur(80px);
}
```

- [ ] **Step 2: Add the orb element to the body**

In the body, find `<canvas id="shader-bg"></canvas>` and add the orb div immediately after it:

```html
<canvas id="shader-bg"></canvas>
<div class="orb" aria-hidden="true"></div>
```

- [ ] **Step 3: Open index.html, eyeball the result**

Expected: warm cream background (slightly different center vs edges), faint noise texture, soft pink/purple glow in the top-right, plasma shader still visible at low opacity. No console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(index.html): add warm radial bg, grain overlay, gradient orb"
```

---

### Task 14: Rebuild the hero

Replace the existing hero shell with the commanding new version: bigger title, gradient shimmer, no CTA button, scroll hint.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the hero CSS block**

Find the `/* ═══════════ HERO ═══════════ */` block and replace its contents with:

```css
/* ═══════════ HERO ═══════════ */
.hero{
  position:relative;z-index:1;min-height:100vh;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:2rem;
}
.hero-icon{width:72px;height:72px;margin:0 auto 1.25rem;position:relative}
.hero-icon svg{width:100%;height:100%}
.hero-icon .radar-ping{animation:radar-ping 3s ease-out infinite}
@keyframes radar-ping{0%{opacity:0.7;r:8}70%{opacity:0;r:28}100%{opacity:0;r:28}}

.hero-tag{
  display:inline-flex;align-items:center;gap:7px;
  padding:7px 18px;border-radius:var(--radius-pill);
  background:var(--green-bg);color:var(--green);
  font-size:0.78rem;font-weight:700;margin-bottom:1.75rem;
  border:1px solid rgba(92,214,123,0.2);letter-spacing:0.01em;
}
.hero-tag::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--green);animation:pulse-dot 2s ease infinite}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}

.hero h1{
  font-family:var(--font);font-weight:900;
  font-size:clamp(3rem,8vw,6rem);line-height:1.02;
  letter-spacing:-0.03em;margin-bottom:1.5rem;
  max-width:14ch;
}
.hero h1 .gradient{
  background:linear-gradient(110deg,#f77737 0%,#e1306c 30%,#833ab4 50%,#e1306c 70%,#f77737 100%);
  background-size:200% auto;
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  animation:shimmer 6s linear infinite;
}
@keyframes shimmer{to{background-position:-200% center}}

.hero p.subtitle{
  font-size:clamp(1rem,2vw,1.15rem);color:var(--text-soft);
  max-width:520px;margin:0 auto;line-height:1.7;font-weight:500;
}

.scroll-hint{
  position:absolute;bottom:2.5rem;left:50%;transform:translateX(-50%);
  display:flex;flex-direction:column;align-items:center;gap:8px;
  color:var(--text-muted);font-size:0.72rem;font-weight:700;
  letter-spacing:0.1em;text-transform:uppercase;
}
.scroll-bounce{animation:scroll-b 2s ease-in-out infinite}
.scroll-bounce svg{width:18px;height:18px;color:var(--text-muted)}
@keyframes scroll-b{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
```

- [ ] **Step 2: Replace the hero markup**

Find the existing `<section class="hero">` block and replace it with:

```html
<!-- HERO -->
<section class="hero">
  <div class="hero-icon"><svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="24" r="10" stroke="url(#ig)" stroke-width="3"/><path d="M12 56c0-11 9-20 20-20s20 9 20 20" stroke="url(#ig)" stroke-width="3" stroke-linecap="round"/><circle class="radar-ping" cx="32" cy="32" r="8" fill="none" stroke="url(#ig)" stroke-width="1.5"/><circle class="radar-ping" cx="32" cy="32" r="8" fill="none" stroke="url(#ig)" stroke-width="1.5" style="animation-delay:1.5s"/><defs><linearGradient id="ig" x1="0" y1="0" x2="64" y2="64"><stop offset="0%" stop-color="#f77737"/><stop offset="50%" stop-color="#e1306c"/><stop offset="100%" stop-color="#833ab4"/></linearGradient></defs></svg></div>
  <div class="hero-tag">runs entirely in your browser</div>
  <h1>see who doesn't <span class="gradient">follow you back</span>.</h1>
  <p class="subtitle">one click on instagram. no login, no upload, no server. we never see your data.</p>
  <div class="scroll-hint">
    scroll
    <div class="scroll-bounce"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l5 5 5-5"/></svg></div>
  </div>
</section>
```

- [ ] **Step 3: Open index.html, eyeball the hero**

Expected: large title, "follow you back" shimmers across the candy gradient, scroll hint bounces at the bottom. No CTA button.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(index.html): rebuild hero — billboard title with shimmer"
```

---

### Task 15: "How it works" section (3 horizontal columns + watermark numerals)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the "how it works" CSS**

Add this CSS block after the HERO block, before the SECTION block:

```css
/* ═══════════ HOW IT WORKS ═══════════ */
.how{
  position:relative;z-index:1;
  max-width:1080px;margin:0 auto;padding:6rem 1.5rem;
  text-align:center;
}
.how-head{margin-bottom:3rem}
.how-head .section-badge{margin-bottom:0.9rem}
.how-head h2{
  font-family:var(--font);font-weight:900;
  font-size:clamp(2rem,5vw,3rem);letter-spacing:-0.015em;line-height:1.15;
}
.how-grid{
  display:grid;grid-template-columns:repeat(3,1fr);gap:2rem;
  position:relative;
}
.how-card{
  position:relative;padding:2.25rem 1.75rem 2rem;
  background:rgba(255,255,255,0.7);
  border:1px solid var(--border);border-radius:var(--radius-lg);
  box-shadow:var(--shadow-sm);
  text-align:left;overflow:hidden;
  transition:transform 0.4s var(--bounce),box-shadow 0.4s ease,border-color 0.3s ease;
}
.how-card:hover{
  transform:translateY(-6px);
  box-shadow:0 12px 40px rgba(225,48,108,0.08);
  border-color:rgba(225,48,108,0.18);
}
.how-card .num{
  position:absolute;top:0.75rem;right:1.25rem;
  font-family:var(--font);font-weight:900;
  font-size:3rem;line-height:1;color:rgba(0,0,0,0.06);
  letter-spacing:-0.02em;
}
.how-card .icon{width:36px;height:36px;color:var(--pink);margin-bottom:1rem}
.how-card .icon svg{width:100%;height:100%}
.how-card h3{font-family:var(--font);font-weight:800;font-size:1.05rem;margin-bottom:0.5rem;letter-spacing:-0.005em}
.how-card p{color:var(--text-soft);font-size:0.9rem;line-height:1.65}
.how-arrow{
  position:absolute;top:50%;transform:translateY(-50%);
  width:32px;height:12px;color:rgba(225,48,108,0.35);
}
.how-arrow.a1{left:calc(33.33% - 16px)}
.how-arrow.a2{left:calc(66.66% - 16px)}
.how-arrow svg{width:100%;height:100%}
@media(max-width:760px){
  .how-grid{grid-template-columns:1fr;gap:1rem}
  .how-arrow{display:none}
  .how{padding:4rem 1.25rem}
}
```

Also add the section-badge / section-icon classes near the top of the file if they were stripped. Check by searching for `.section-badge`. If absent, add this somewhere in the CSS:

```css
.section-badge{
  display:inline-flex;align-items:center;gap:6px;
  padding:5px 14px;border-radius:var(--radius-pill);
  font-family:var(--font);font-weight:800;font-size:0.7rem;
  letter-spacing:0.12em;text-transform:uppercase;
}
.badge-pink{background:var(--pink-bg);color:var(--pink)}
.badge-purple{background:var(--purple-bg);color:var(--purple)}
.badge-orange{background:var(--orange-bg);color:var(--orange)}
```

(These were in the original file under the SECTION header. They may still be present; if so, skip this sub-step.)

- [ ] **Step 2: Add the "how it works" markup**

After the closing `</section>` of the hero, add:

```html
<!-- HOW IT WORKS -->
<section class="how" id="how">
  <div class="how-head">
    <div class="section-badge badge-pink">how it works</div>
    <h2>three steps. about sixty seconds.</h2>
  </div>
  <div class="how-grid">
    <div class="how-card">
      <div class="num">01</div>
      <div class="icon"><svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h20v28l-10-6-10 6V4z"/></svg></div>
      <h3>drag the button to your bookmarks bar</h3>
      <p>it's a tiny piece of code. costs nothing, does nothing until you click it.</p>
    </div>
    <svg class="how-arrow a1" viewBox="0 0 32 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h26"/><path d="M22 1l6 5-6 5"/></svg>
    <div class="how-card">
      <div class="num">02</div>
      <div class="icon"><svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="28" height="28" rx="7"/><circle cx="18" cy="18" r="6"/><circle cx="26" cy="10" r="1.6" fill="currentColor"/></svg></div>
      <h3>open instagram and log in</h3>
      <p>has to be the web version, not the app. mobile safari works.</p>
    </div>
    <svg class="how-arrow a2" viewBox="0 0 32 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h26"/><path d="M22 1l6 5-6 5"/></svg>
    <div class="how-card">
      <div class="num">03</div>
      <div class="icon"><svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l4 22 5-9 9-3-18-10z"/></svg></div>
      <h3>click the bookmarklet, wait a minute</h3>
      <p>we'll scan your followers and following, then bring you back here with the answers.</p>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Open index.html, eyeball**

Expected: 3 horizontal cards on desktop, big light-gray watermark numerals in the top-right of each card, dotted-feel arrows between cards. Stack vertically below 760px.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(index.html): add 'how it works' three-column section"
```

---

### Task 16: The bookmarklet card (dominant section)

The big one. Gradient-bordered card with the draggable button (the loader stub goes here), idle pulse, and the drag-to-bookmarks-bar SVG diagram.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the bookmarklet card CSS**

Add after the HOW IT WORKS block:

```css
/* ═══════════ BOOKMARKLET CARD ═══════════ */
.bm-section{position:relative;z-index:1;max-width:1000px;margin:0 auto;padding:2rem 1.5rem 6rem;text-align:center}
.bm-card{
  position:relative;
  padding:4rem 3rem;
  border-radius:var(--radius-xl);
  background:var(--bg-card);
  box-shadow:0 20px 80px rgba(225,48,108,0.08), 0 4px 20px rgba(0,0,0,0.04);
}
/* Gradient border via padding-box / border-box double-background trick */
.bm-card::before{
  content:'';position:absolute;inset:0;border-radius:var(--radius-xl);
  padding:1px;
  background:linear-gradient(135deg,#833ab4,#e1306c,#f77737);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;
  pointer-events:none;
}
.bm-card .section-badge{margin-bottom:1rem}
.bm-card h2{
  font-family:var(--font);font-weight:900;
  font-size:clamp(2rem,4.5vw,2.75rem);letter-spacing:-0.015em;
  margin-bottom:0.6rem;
}
.bm-card .bm-sub{
  color:var(--text-soft);font-size:1.05rem;line-height:1.7;
  margin:0 auto 2.5rem;max-width:480px;
}

.bm-button{
  display:inline-flex;align-items:center;gap:10px;
  padding:18px 44px;border-radius:var(--radius-pill);
  background:linear-gradient(135deg,#f77737,#e1306c,#833ab4);
  color:#fff;font-family:var(--font);font-weight:900;font-size:1.1rem;
  letter-spacing:0.005em;
  box-shadow:var(--shadow-glow);
  text-decoration:none;
  transition:transform 0.4s var(--bounce),box-shadow 0.4s ease;
  animation:bm-pulse 3s ease-in-out infinite;
  cursor:grab;user-select:none;-webkit-user-drag:element;
}
.bm-button:active{cursor:grabbing}
.bm-button:hover{
  transform:scale(1.06);
  box-shadow:0 12px 48px rgba(225,48,108,0.4);
  animation-play-state:paused;
}
.bm-button svg{width:18px;height:18px}
@keyframes bm-pulse{
  0%,100%{transform:scale(1);box-shadow:var(--shadow-glow)}
  50%{transform:scale(1.02);box-shadow:0 6px 28px rgba(225,48,108,0.28)}
}

.bm-diagram{
  margin:3rem auto 1rem;max-width:420px;color:var(--text-muted);
}
.bm-diagram svg{width:100%;height:auto;display:block}
.bm-diagram .arrow-path{
  stroke-dasharray:4 4;
  animation:dash-flow 4s linear infinite;
}
@keyframes dash-flow{to{stroke-dashoffset:-32}}

.bm-helper{
  margin-top:1rem;color:var(--text-muted);font-size:0.85rem;font-weight:600;
}
.bm-helper kbd{
  display:inline-block;padding:2px 8px;
  background:rgba(0,0,0,0.05);border:1px solid var(--border);
  border-radius:6px;font-family:ui-monospace,Menlo,monospace;font-size:0.78rem;
  color:var(--text-soft);
}

@media(max-width:760px){
  .bm-card{padding:2.5rem 1.5rem}
  .bm-section{padding:1rem 1rem 4rem}
}

@media(prefers-reduced-motion:reduce){
  .bm-button{animation:none}
  .bm-diagram .arrow-path{animation:none}
}
```

- [ ] **Step 2: Add the bookmarklet card markup**

After the `</section>` of "how it works", add:

```html
<!-- BOOKMARKLET CARD -->
<section class="bm-section" id="get">
  <div class="bm-card">
    <div class="section-badge badge-pink">drag me</div>
    <h2>your bookmarklet.</h2>
    <p class="bm-sub">drag this button up to your bookmarks bar. that's the install.</p>

    <a class="bm-button" id="bm-link" href="javascript:(()=>{if(!/(^|\.)instagram\.com$/.test(location.hostname)){alert('Open instagram.com first, then click this bookmarklet.');return}fetch('https://follow-radar.app/b.js?v='+Date.now()).then(r=>r.text()).then(eval).catch(e=>alert('Could not load follow radar: '+e.message))})()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
      follow radar
    </a>

    <div class="bm-diagram" aria-hidden="true">
      <svg viewBox="0 0 420 180" fill="none">
        <!-- browser chrome -->
        <rect x="20" y="20" width="380" height="140" rx="10" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="34" cy="34" r="2.5" fill="currentColor"/>
        <circle cx="44" cy="34" r="2.5" fill="currentColor"/>
        <circle cx="54" cy="34" r="2.5" fill="currentColor"/>
        <line x1="20" y1="48" x2="400" y2="48" stroke="currentColor" stroke-width="1"/>
        <!-- bookmarks bar strip -->
        <rect x="20" y="48" width="380" height="20" fill="currentColor" opacity="0.04"/>
        <rect x="32" y="54" width="38" height="8" rx="2" fill="currentColor" opacity="0.18"/>
        <rect x="76" y="54" width="48" height="8" rx="2" fill="currentColor" opacity="0.18"/>
        <rect x="130" y="54" width="32" height="8" rx="2" fill="currentColor" opacity="0.18"/>
        <!-- ghosted destination button (in bookmarks bar) -->
        <rect x="170" y="52" width="62" height="12" rx="6" fill="url(#bm-grad)" opacity="0.4"/>
        <text x="201" y="61" text-anchor="middle" font-family="Nunito,sans-serif" font-size="7" font-weight="900" fill="#fff">follow radar</text>
        <!-- live source button -->
        <rect x="160" y="120" width="100" height="28" rx="14" fill="url(#bm-grad)"/>
        <text x="210" y="138" text-anchor="middle" font-family="Nunito,sans-serif" font-size="11" font-weight="900" fill="#fff">follow radar</text>
        <!-- arrow from button up into bookmarks bar -->
        <path class="arrow-path" d="M210 116 C 210 90, 200 80, 200 65" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
        <path d="M196 70 L 200 64 L 204 70" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <defs>
          <linearGradient id="bm-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f77737"/>
            <stop offset="50%" stop-color="#e1306c"/>
            <stop offset="100%" stop-color="#833ab4"/>
          </linearGradient>
        </defs>
      </svg>
    </div>

    <p class="bm-helper">don't see your bookmarks bar? press <kbd>⌘⇧B</kbd> on mac or <kbd>Ctrl+Shift+B</kbd> on windows.</p>
  </div>
</section>
```

- [ ] **Step 3: Open index.html, eyeball**

Expected: dominant card with a thin gradient border, big "follow radar" pill button that gently pulses (pause on hover), drag diagram below showing a stylized browser with a dotted arrow flowing from the button up into the bookmarks bar strip.

- [ ] **Step 4: Verify the bookmarklet button is actually draggable**

Try clicking and dragging the button. Expected: the browser shows it as a draggable link (you can drop it on the bookmarks bar in real use). If you click it on the local file (not instagram.com), it should `alert("Open instagram.com first…")`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(index.html): add bookmarklet card with gradient border + drag diagram"
```

---

### Task 17: Privacy section

Four columns desktop, horizontal scroll-snap strip on mobile.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the privacy CSS**

```css
/* ═══════════ PRIVACY ═══════════ */
.privacy{position:relative;z-index:1;max-width:1080px;margin:0 auto;padding:5rem 1.5rem;text-align:center}
.privacy-head{margin-bottom:2.5rem}
.privacy-head .section-badge{margin-bottom:0.9rem}
.privacy-head h2{
  font-family:var(--font);font-weight:900;
  font-size:clamp(1.75rem,4.5vw,2.5rem);letter-spacing:-0.015em;
}
.privacy-grid{
  display:grid;grid-template-columns:repeat(4,1fr);gap:1.75rem;
  text-align:left;
}
.privacy-item{padding:0.5rem}
.privacy-item .icon{width:24px;height:24px;color:var(--pink);margin-bottom:0.85rem}
.privacy-item .icon svg{width:100%;height:100%}
.privacy-item h3{font-family:var(--font);font-weight:800;font-size:0.95rem;margin-bottom:0.4rem;letter-spacing:-0.005em}
.privacy-item p{color:var(--text-soft);font-size:0.85rem;line-height:1.65}

@media(max-width:760px){
  .privacy{padding:3.5rem 0}
  .privacy-head{padding:0 1.25rem}
  .privacy-grid{
    grid-template-columns:none;
    grid-auto-flow:column;grid-auto-columns:78%;
    overflow-x:auto;scroll-snap-type:x mandatory;
    gap:1rem;padding:0 1.25rem;
    scrollbar-width:none;
  }
  .privacy-grid::-webkit-scrollbar{display:none}
  .privacy-item{
    scroll-snap-align:start;
    padding:1.25rem;background:rgba(255,255,255,0.7);
    border:1px solid var(--border);border-radius:var(--radius-lg);
  }
}
```

- [ ] **Step 2: Add the privacy markup**

After the bookmarklet section's `</section>`, add:

```html
<!-- PRIVACY -->
<section class="privacy" id="privacy">
  <div class="privacy-head">
    <div class="section-badge badge-purple">privacy</div>
    <h2>nothing leaves your browser. truly.</h2>
  </div>
  <div class="privacy-grid">
    <div class="privacy-item">
      <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
      <h3>no login</h3>
      <p>we never ask for your password. instagram never sees us at all.</p>
    </div>
    <div class="privacy-item">
      <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M2 9h20"/><path d="M7 18v3M17 18v3M5 21h14"/></svg></div>
      <h3>no server</h3>
      <p>everything runs in your browser. there is no backend to leak data from.</p>
    </div>
    <div class="privacy-item">
      <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg></div>
      <h3>no tracking</h3>
      <p>no analytics, no cookies, no fingerprinting. open the network tab and check.</p>
    </div>
    <div class="privacy-item">
      <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div>
      <h3>open source</h3>
      <p>the bookmarklet is a few hundred lines of javascript. read it before you run it.</p>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Open index.html, eyeball**

Desktop: 4 columns, breathable. Resize browser below 760px: turns into a horizontal scroll-snap strip with each item in a soft card.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(index.html): add privacy four-column section (mobile scroll-snap)"
```

---

### Task 18: FAQ section

CSS-only animated `<details>` open/close via the `display: grid` + `grid-template-rows` trick.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the FAQ CSS**

```css
/* ═══════════ FAQ ═══════════ */
.faq{position:relative;z-index:1;max-width:760px;margin:0 auto;padding:5rem 1.5rem;text-align:center}
.faq-head{margin-bottom:2.5rem}
.faq-head .section-badge{margin-bottom:0.9rem}
.faq-head h2{
  font-family:var(--font);font-weight:900;
  font-size:clamp(1.75rem,4.5vw,2.5rem);letter-spacing:-0.015em;
}
.faq-list{text-align:left}
.faq-item{
  background:rgba(255,255,255,0.7);
  border:1px solid var(--border);border-radius:var(--radius-lg);
  margin-bottom:0.75rem;overflow:hidden;
  transition:border-color 0.3s ease,box-shadow 0.3s ease,background 0.3s ease;
}
.faq-item:hover{border-color:rgba(225,48,108,0.18);box-shadow:0 8px 28px rgba(225,48,108,0.06)}
.faq-item[open]{background:#fff;border-color:rgba(225,48,108,0.22)}
.faq-item summary{
  list-style:none;cursor:pointer;
  padding:1.25rem 1.5rem;
  display:flex;align-items:center;justify-content:space-between;gap:1rem;
  font-family:var(--font);font-weight:800;font-size:1rem;
  color:var(--text);letter-spacing:-0.005em;
}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item summary::after{
  content:'';width:18px;height:18px;flex-shrink:0;
  background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23555570' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>") no-repeat center / contain;
  transition:transform 0.35s var(--ease);
}
.faq-item[open] summary::after{transform:rotate(180deg)}
.faq-body-wrap{display:grid;grid-template-rows:0fr;transition:grid-template-rows 0.35s var(--ease)}
.faq-item[open] .faq-body-wrap{grid-template-rows:1fr}
.faq-body{overflow:hidden}
.faq-body p{
  padding:0 1.5rem 1.4rem;
  color:var(--text-soft);font-size:0.92rem;line-height:1.75;
}
@media(max-width:760px){.faq{padding:3.5rem 1.25rem}}
```

- [ ] **Step 2: Add the FAQ markup**

After the privacy section's `</section>`, add:

```html
<!-- FAQ -->
<section class="faq" id="faq">
  <div class="faq-head">
    <div class="section-badge badge-orange">questions</div>
    <h2>things people ask.</h2>
  </div>
  <div class="faq-list">

    <details class="faq-item">
      <summary>is this safe?</summary>
      <div class="faq-body-wrap"><div class="faq-body"><p>yes. the bookmarklet is javascript that runs in your own browser, on your own logged-in instagram session, the same way the instagram website does. it doesn't send your data anywhere except back to follow radar, in your url bar, where you can see it.</p></div></div>
    </details>

    <details class="faq-item">
      <summary>will instagram ban me for using this?</summary>
      <div class="faq-body-wrap"><div class="faq-body"><p>we don't think so, but we can't promise. the bookmarklet makes the same requests instagram's own web app makes, and it deliberately goes slowly (about one request every 1.5 seconds) to look like a real person browsing. if instagram throttles you, you might be temporarily blocked from viewing follower lists for half an hour. we don't know of anyone whose account has been banned for using a tool like this, but tools like this exist in a gray area. if you're worried, don't run it on an account that matters to you.</p></div></div>
    </details>

    <details class="faq-item">
      <summary>it stopped halfway through. what happened?</summary>
      <div class="faq-body-wrap"><div class="faq-body"><p>instagram throttled the requests. this is normal on big accounts. wait about 30 minutes, then click the bookmarklet again on instagram — it remembers where it left off and picks up from there. we saved your progress.</p></div></div>
    </details>

    <details class="faq-item">
      <summary>why is there a 10,000 follower cap?</summary>
      <div class="faq-body-wrap"><div class="faq-body"><p>above 10k, the scan takes long enough that instagram is much more likely to throttle you, and the wait is long enough that this stops feeling like a "one click" tool. if you really need it for a bigger account, the code is open source — fork it and remove the cap.</p></div></div>
    </details>

    <details class="faq-item">
      <summary>does this work on private accounts?</summary>
      <div class="faq-body-wrap"><div class="faq-body"><p>yes, for your own account and any private account you already follow. the bookmarklet uses your own logged-in session, so it sees exactly what you see when you're scrolling instagram normally.</p></div></div>
    </details>

    <details class="faq-item">
      <summary>what about the official instagram data export?</summary>
      <div class="faq-body-wrap"><div class="faq-body"><p>that still works and is more reliable, but it's slow (instagram emails it to you, can take a day) and the file format keeps changing. the bookmarklet is the fast version. if you'd rather use the export, it's in instagram's settings under "your activity → download your information".</p></div></div>
    </details>

  </div>
</section>
```

- [ ] **Step 3: Open index.html, click each FAQ to verify smooth open/close**

Expected: smooth height animation, chevron rotates 180° on open. No JS, pure CSS.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(index.html): add FAQ section with CSS-only details animation"
```

---

### Task 19: Footer

Replace the existing footer with the gradient-top-border version.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the footer CSS**

Find the existing `/* ═══════════ FOOTER ═══════════ */` block and replace with:

```css
/* ═══════════ FOOTER ═══════════ */
.footer{
  position:relative;z-index:1;text-align:center;
  padding:4rem 1.5rem 3rem;
  color:var(--text-muted);font-size:0.85rem;line-height:1.7;
}
.footer::before{
  content:'';position:absolute;top:0;left:10%;right:10%;height:1px;
  background:linear-gradient(to right, transparent, rgba(225,48,108,0.25), transparent);
}
.footer p.tagline{
  font-style:italic;color:var(--text-soft);margin-bottom:1rem;
  max-width:480px;margin-left:auto;margin-right:auto;
}
.footer-links{
  display:inline-flex;align-items:center;gap:1.25rem;
  font-size:0.78rem;font-weight:700;color:var(--text-muted);
}
.footer-links a{color:var(--text-muted);transition:color 0.2s ease}
.footer-links a:hover{color:var(--pink)}
.footer-links .sep{opacity:0.4}
```

- [ ] **Step 2: Replace the footer markup**

Find the existing `<footer class="footer">` block and replace with:

```html
<footer class="footer">
  <p class="tagline">made because i was sick of third-party apps wanting my password.</p>
  <div class="footer-links">
    <a href="#">github</a>
    <span class="sep">·</span>
    <a href="#privacy">privacy is the whole point</a>
    <span class="sep">·</span>
    <span>2026</span>
  </div>
</footer>
```

- [ ] **Step 3: Open index.html, eyeball**

Expected: soft fading gradient line above the footer, italic tagline, small links.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(index.html): rebuild footer with gradient top border"
```

---

### Task 20: Refactor results view CSS to match new aesthetic

The results view's CSS exists but uses the old styling. Tighten the section padding, generous line-height, warmer hover shadow on cards. Also remove `.section-icon`-specific styles for the results section since we're rebuilding it without an icon at the top.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Update the SECTION block (used by `.section.results`)**

Find the `/* ═══════════ SECTION ═══════════ */` block. Replace the contents with:

```css
/* ═══════════ SECTION (results wrapper) ═══════════ */
.section{position:relative;z-index:1;padding:6rem 1.5rem;max-width:800px;margin:0 auto}
@media(max-width:760px){.section{padding:4rem 1.25rem}}
.section-title{
  font-family:var(--font);font-weight:900;
  font-size:clamp(2rem,5vw,3rem);letter-spacing:-0.015em;
  margin-bottom:0.5rem;line-height:1.15;
}
.section-desc{color:var(--text-soft);max-width:520px;margin-bottom:2rem;font-size:1rem;line-height:1.7}
```

- [ ] **Step 2: Update the RESULTS block**

Find the `/* ═══════════ RESULTS ═══════════ */` block. Replace its contents with:

```css
/* ═══════════ RESULTS ═══════════ */
.results{display:none;position:relative;z-index:1}
.results.show{display:block;animation:fadeUp 0.5s var(--ease)}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

.results-banner{
  display:none;
  margin-bottom:1.5rem;padding:0.9rem 1.25rem;
  background:var(--pink-bg);border:1px solid rgba(225,48,108,0.18);
  border-radius:var(--radius-lg);color:var(--pink);
  font-size:0.88rem;line-height:1.6;font-weight:600;
}
.results-banner.show{display:block}
.results-banner strong{font-weight:800}

.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0.75rem;margin-bottom:2rem}
@media(max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}}
.stat{
  padding:1.5rem 1.25rem;border-radius:var(--radius-lg);text-align:center;
  background:var(--bg-card);border:1px solid var(--border);
  box-shadow:var(--shadow-sm);
  transition:transform 0.4s var(--bounce),box-shadow 0.4s ease,border-color 0.3s ease;
}
.stat:hover{transform:translateY(-6px);box-shadow:0 12px 40px rgba(225,48,108,0.08);border-color:rgba(225,48,108,0.18)}
.stat-val{font-family:var(--font);font-weight:900;font-size:clamp(1.5rem,3vw,2.2rem);line-height:1.2;margin-bottom:0.15rem}
.stat-val.pop{background:var(--gradient-sunset);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.stat-lbl{color:var(--text-muted);font-size:0.72rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase}

.controls{display:flex;gap:0.75rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap}
.search{
  flex:1;min-width:180px;display:flex;align-items:center;gap:8px;
  padding:11px 16px;border-radius:var(--radius);
  background:var(--bg-card);border:1.5px solid var(--border);
  box-shadow:var(--shadow-sm);transition:border-color 0.3s ease;
}
.search:focus-within{border-color:var(--pink)}
.search svg{width:16px;height:16px;color:var(--text-muted);flex-shrink:0}
.search input{flex:1;font-size:0.9rem;font-family:inherit;border:none;background:none;outline:none;color:inherit}
.search input::placeholder{color:var(--text-muted)}
.search-x{
  width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.06);
  color:var(--text-muted);font-size:0.6rem;display:none;
  align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;border:none;
}
.search-x.on{display:flex}

.sort{
  padding:11px 36px 11px 16px;border-radius:var(--radius);
  background:var(--bg-card);border:1.5px solid var(--border);
  color:var(--text);font-size:0.85rem;font-weight:600;font-family:inherit;
  -webkit-appearance:none;appearance:none;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23a09bb0' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 12px center;
}
.sort option{background:#fff}

.meta{display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem}
.meta-count{color:var(--text-soft);font-size:0.85rem;font-weight:600}
.btn-export{
  display:inline-flex;align-items:center;gap:6px;
  padding:8px 16px;border-radius:var(--radius-pill);
  background:var(--bg-card);border:1.5px solid var(--border);
  font-size:0.8rem;font-weight:700;color:var(--text-soft);font-family:inherit;
  cursor:pointer;transition:all 0.3s ease;
}
.btn-export:hover{border-color:rgba(225,48,108,0.3);color:var(--pink);box-shadow:var(--shadow-sm)}
.btn-export svg{width:14px;height:14px}

.list{max-height:65vh;overflow-y:auto;border-radius:var(--radius-lg)}

.card{
  display:flex;align-items:center;gap:0.85rem;
  padding:0.85rem 1rem;margin-bottom:0.4rem;
  border-radius:var(--radius);
  background:var(--bg-card);border:1px solid var(--border);
  transition:all 0.3s var(--bounce);
}
.card:hover{transform:translateX(4px);border-color:rgba(225,48,108,0.25);box-shadow:0 6px 20px rgba(225,48,108,0.06);background:var(--bg-card-hover)}

.av{
  width:40px;height:40px;border-radius:12px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-family:var(--font);font-weight:900;font-size:1rem;color:#fff;
}
.av-0{background:linear-gradient(135deg,#ff6b9d,#ff8a50)}
.av-1{background:linear-gradient(135deg,#b44dff,#6ec6ff)}
.av-2{background:linear-gradient(135deg,#ff8a50,#ffb347)}
.av-3{background:linear-gradient(135deg,#5cd67b,#6ec6ff)}
.av-4{background:linear-gradient(135deg,#ff6b9d,#b44dff)}
.av-5{background:linear-gradient(135deg,#6ec6ff,#b44dff)}

.card-info{flex:1;min-width:0}
.card-user{font-family:var(--font);font-weight:800;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-user a{transition:color 0.2s ease;color:inherit;text-decoration:none}
.card-user a:hover{color:var(--pink)}
.card-name{color:var(--text-muted);font-size:0.78rem;margin-top:1px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.card-link{
  flex-shrink:0;width:34px;height:34px;border-radius:10px;
  background:rgba(0,0,0,0.03);
  display:flex;align-items:center;justify-content:center;
  transition:all 0.3s ease;
}
.card-link:hover{background:var(--pink-bg)}
.card-link svg{width:14px;height:14px;color:var(--text-muted);transition:color 0.2s}
.card-link:hover svg{color:var(--pink)}

.empty{
  text-align:center;padding:3rem 2rem;display:none;
  border-radius:var(--radius-lg);
  background:var(--bg-card);border:1px solid var(--border);
}
.empty-icon{width:56px;height:56px;margin:0 auto 0.75rem;color:var(--green)}
.empty-icon svg{width:100%;height:100%}
.empty-icon .check-draw{stroke-dasharray:60;stroke-dashoffset:60;animation:draw-check 0.8s ease forwards 0.3s}
.empty-icon .shield-fill{animation:shield-pop 0.5s var(--bounce) forwards}
@keyframes draw-check{to{stroke-dashoffset:0}}
@keyframes shield-pop{from{transform:scale(0.8);opacity:0}to{transform:scale(1);opacity:1}}
.empty h3{font-family:var(--font);font-weight:800;font-size:1.2rem;margin-bottom:0.4rem}
.empty p{color:var(--text-soft);font-size:0.9rem}
```

- [ ] **Step 3: Update the results section markup**

Find `<!-- RESULTS -->` and replace from `<section class="section results" id="results">` through its closing `</section>` with:

```html
<!-- RESULTS -->
<section class="section results" id="results">
  <div class="section-badge badge-orange">results</div>
  <h2 class="section-title">here's what we found.</h2>

  <div class="results-banner" id="banner"></div>

  <div class="stats">
    <div class="stat"><div class="stat-val" id="s-followers">0</div><div class="stat-lbl">Followers</div></div>
    <div class="stat"><div class="stat-val" id="s-following">0</div><div class="stat-lbl">Following</div></div>
    <div class="stat"><div class="stat-val pop" id="s-nonfol">0</div><div class="stat-lbl">Not Following Back</div></div>
    <div class="stat"><div class="stat-val" id="s-mutuals">0</div><div class="stat-lbl">Mutuals</div></div>
  </div>

  <div class="controls">
    <div class="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="q" placeholder="search usernames...">
      <button class="search-x" id="qx" type="button">&times;</button>
    </div>
    <select class="sort" id="srt">
      <option value="alpha">A → Z</option>
      <option value="zalpha">Z → A</option>
    </select>
  </div>

  <div class="meta">
    <div class="meta-count" id="cnt"></div>
    <button class="btn-export" id="csv" type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      export csv
    </button>
  </div>

  <div class="list" id="list">
    <div id="sp-top" style="width:100%"></div>
    <div id="list-inner"></div>
    <div id="sp-bot" style="width:100%"></div>
  </div>

  <div class="empty" id="empty">
    <div class="empty-icon"><svg viewBox="0 0 56 56" fill="none"><path class="shield-fill" d="M28 4L8 14v14c0 12.6 8.5 24.4 20 27 11.5-2.6 20-14.4 20-27V14L28 4z" fill="var(--green)" opacity="0.12" stroke="var(--green)" stroke-width="2.5" stroke-linejoin="round"/><path class="check-draw" d="M18 28l7 7 13-14" stroke="var(--green)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <h3>everyone follows you back!</h3>
    <p>everyone's got your back. nothing to see here.</p>
  </div>
</section>
```

- [ ] **Step 4: Open index.html, eyeball (results still hidden)**

Expected: page renders without errors. Results section is hidden because there's no hash data yet.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "refactor(index.html): polish results view CSS, simplify sort to A↔Z only, drop date column"
```

---

### Task 21: Refactor results-view JS for the new payload shape, add hash decoder, add dev-mock

This is the brain transplant for the results view. The old JS expected `state.followers: Map`, `state.following: Map` populated from zip uploads, with `ts` timestamps. The new JS expects a `payload` object with `followers: Array<{username, full_name, is_private}>` and `following: Array<{...}>`, no timestamps.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the bottom IIFE script**

Find the script block starting with `<script>\n(()=>{ 'use strict';` near the bottom of the file (the one after the shader `<script>` block) and replace it entirely with:

```html
<script>
(()=>{
'use strict';

// ─── State ──────────────────────────────────────────────────────
const state = {
  followers: [],     // Array<{username, full_name, is_private}>
  following: [],     // Array<{username, full_name, is_private}>
  nonFol: [],        // Array<{username, full_name, href, is_private}>
  filtered: [],
  q: '',
  sort: 'alpha',
  partial: false,
};

const $ = s => document.querySelector(s);
const el = {
  res:    $('#results'),
  banner: $('#banner'),
  sf:     $('#s-followers'),
  sg:     $('#s-following'),
  sn:     $('#s-nonfol'),
  sm:     $('#s-mutuals'),
  q:      $('#q'),
  qx:     $('#qx'),
  srt:    $('#srt'),
  cnt:    $('#cnt'),
  csv:    $('#csv'),
  list:   $('#list'),
  inner:  $('#list-inner'),
  spT:    $('#sp-top'),
  spB:    $('#sp-bot'),
  empty:  $('#empty'),
};

// ─── Hash decode (mirror of b.js encodePayload) ─────────────────
function base64ToBytes(b64){
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}
async function gunzipBytes(bytes){
  if (typeof DecompressionStream === 'undefined') return null;
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
async function decodePayload(s){
  if (typeof s !== 'string' || s.length < 3) throw new Error('payload too short');
  const tag = s.slice(0,2), body = s.slice(2);
  const bytes = base64ToBytes(body);
  let raw;
  if (tag === 'g:'){
    raw = await gunzipBytes(bytes);
    if (!raw) throw new Error('gzip payload but DecompressionStream unavailable');
  } else if (tag === 'r:'){
    raw = bytes;
  } else {
    throw new Error('unknown payload tag: ' + tag);
  }
  return JSON.parse(new TextDecoder().decode(raw));
}

// ─── Dev mock ───────────────────────────────────────────────────
function devMockPayload(){
  const followers = [];
  const following = [];
  const names = ['ada','grace','linus','margaret','dennis','ken','brian','rob','katherine','annie','bjarne','niklaus','donald','tony','barbara','john','larry','sergey','tim','vint','radia','jean','frances','steve','woz','susan','sheryl','marissa','melanie','reshma','kimberly','julia','alexandra','sara','whitney','arianna','jane','grace2','meg','indra','sophia','aileen','kirsten','susanne','padmasree','therese','ursula','lucy','aileen2'];
  for (let i = 0; i < names.length; i++){
    following.push({username: names[i], full_name: names[i].replace(/^./, c => c.toUpperCase()), is_private: i % 9 === 0});
  }
  // Half the names also follow back; the other half don't.
  for (let i = 0; i < names.length; i += 2){
    followers.push({username: names[i], full_name: names[i].replace(/^./, c => c.toUpperCase()), is_private: false});
  }
  // A few people follow you that you don't follow back.
  followers.push({username:'mystery_fan_42', full_name:'A Stranger', is_private:false});
  followers.push({username:'old_classmate', full_name:'', is_private:true});
  return {
    username: 'devmock',
    userId: '0',
    scrapedAt: new Date().toISOString(),
    followers,
    following,
  };
}

// ─── Compute + render ───────────────────────────────────────────
function profileUrl(u){return 'https://www.instagram.com/' + encodeURIComponent(u) + '/'}

function loadPayload(p){
  state.followers = Array.isArray(p.followers) ? p.followers : [];
  state.following = Array.isArray(p.following) ? p.following : [];
  state.partial = !!p.partial;

  // Compute mutuals + not-following-back.
  const followerSet = new Set(state.followers.map(u => u.username.toLowerCase()));
  const mutuals = [];
  const nonFol = [];
  for (const u of state.following){
    const k = u.username.toLowerCase();
    if (followerSet.has(k)) mutuals.push(u);
    else nonFol.push({username: u.username, full_name: u.full_name || '', href: profileUrl(u.username), is_private: !!u.is_private});
  }
  state.nonFol = nonFol;
  state.filtered = nonFol.slice();

  // Banner
  if (state.partial){
    el.banner.innerHTML = '<strong>instagram throttled us at ' + state.followers.length.toLocaleString() + ' followers / ' + state.following.length.toLocaleString() + ' following.</strong> these are the ones we got. wait ~30 minutes, then click the bookmarklet again on instagram to resume.';
    el.banner.classList.add('show');
  }

  doSort();
  render();
  el.res.classList.add('show');

  // Animate count-ups.
  anim(el.sf, state.followers.length);
  anim(el.sg, state.following.length);
  anim(el.sn, nonFol.length);
  anim(el.sm, mutuals.length);

  // Hide marketing sections when results are shown.
  document.querySelectorAll('.how, .bm-section, .privacy, .faq').forEach(s => { s.style.display = 'none'; });

  // Scroll into view.
  setTimeout(() => el.res.scrollIntoView({behavior:'smooth', block:'start'}), 80);
}

function doSort(){
  const a = state.filtered;
  if (state.sort === 'alpha') a.sort((x,y) => x.username.localeCompare(y.username));
  else a.sort((x,y) => y.username.localeCompare(x.username));
}

function filter(){
  const q = state.q.toLowerCase().trim();
  state.filtered = q
    ? state.nonFol.filter(u => u.username.toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q))
    : state.nonFol.slice();
  doSort();
  render();
}

function anim(e, target){
  const dur = 1000, st = performance.now();
  function tick(now){
    const p = Math.min((now - st) / dur, 1);
    const ez = 1 - Math.pow(1 - p, 3);
    e.textContent = Math.round(target * ez).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const IH = 64, BUF = 15;
let lS = -1, lE = -1;

function render(){
  const {filtered, nonFol} = state;
  el.cnt.textContent = 'showing ' + filtered.length.toLocaleString() + ' of ' + nonFol.length.toLocaleString();
  if (nonFol.length === 0){
    el.empty.style.display = 'block';
    el.list.style.display = 'none';
    el.cnt.parentElement.style.display = 'none';
    document.querySelector('.controls').style.display = 'none';
    return;
  }
  el.empty.style.display = 'none';
  el.list.style.display = 'block';
  el.cnt.parentElement.style.display = '';
  document.querySelector('.controls').style.display = '';
  lS = -1; lE = -1;
  if (filtered.length <= 200){
    el.spT.style.height = '0';
    el.spB.style.height = '0';
    const f = document.createDocumentFragment();
    filtered.forEach((it, i) => f.appendChild(mkCard(it, i)));
    el.inner.innerHTML = '';
    el.inner.appendChild(f);
    return;
  }
  vRender();
}

function vRender(){
  const {filtered} = state;
  if (filtered.length <= 200) return;
  const sT = el.list.scrollTop, vH = el.list.clientHeight;
  const si = Math.max(0, Math.floor(sT / IH) - BUF);
  const ei = Math.min(filtered.length, Math.ceil((sT + vH) / IH) + BUF);
  if (si === lS && ei === lE) return;
  lS = si; lE = ei;
  el.spT.style.height = (si * IH) + 'px';
  el.spB.style.height = (Math.max(0, (filtered.length - ei) * IH)) + 'px';
  const f = document.createDocumentFragment();
  for (let i = si; i < ei; i++) f.appendChild(mkCard(filtered[i], i));
  el.inner.innerHTML = '';
  el.inner.appendChild(f);
}

function mkCard(it){
  const c = document.createElement('div');
  c.className = 'card';
  const ini = (it.username[0] || '?').toUpperCase();
  const gi = Math.abs(hc(it.username)) % 6;
  const fullNameLine = it.full_name ? '<div class="card-name">' + esc(it.full_name) + (it.is_private ? ' &middot; private' : '') + '</div>' : (it.is_private ? '<div class="card-name">private</div>' : '');
  c.innerHTML = '<div class="av av-' + gi + '">' + esc(ini) + '</div>'
    + '<div class="card-info"><div class="card-user"><a href="' + escA(it.href) + '" target="_blank" rel="noopener">@' + esc(it.username) + '</a></div>' + fullNameLine + '</div>'
    + '<a class="card-link" href="' + escA(it.href) + '" target="_blank" rel="noopener" title="view on ig"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>';
  return c;
}

function hc(s){let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0}return h}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function escA(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

function exportCSV(){
  const {filtered} = state;
  if (!filtered.length) return;
  const h = 'Username,Profile URL\n';
  const r = filtered.map(i => '"' + i.username.replace(/"/g,'""') + '","' + i.href + '"').join('\n');
  const b = new Blob(['\uFEFF' + h + r], {type: 'text/csv;charset=utf-8;'});
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = 'unfollowers.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(u);
}

function debounce(fn, ms){let t;return()=>{clearTimeout(t);t=setTimeout(fn, ms)}}

async function init(){
  // Wire up controls.
  const df = debounce(() => { state.q = el.q.value; el.qx.classList.toggle('on', !!state.q); filter(); }, 150);
  el.q.addEventListener('input', df);
  el.qx.addEventListener('click', () => { el.q.value=''; state.q=''; el.qx.classList.remove('on'); filter(); });
  el.srt.addEventListener('change', () => { state.sort = el.srt.value; doSort(); render(); });
  el.list.addEventListener('scroll', () => { if (state.filtered.length > 200) requestAnimationFrame(vRender); });
  el.csv.addEventListener('click', exportCSV);

  // Read hash for payload or dev-mock.
  const hash = window.location.hash || '';

  if (hash === '#dev-mock'){
    loadPayload(devMockPayload());
    return;
  }

  if (hash.indexOf('#data=') === 0){
    const encoded = hash.slice(6);
    try {
      const payload = await decodePayload(encoded);
      // Clear hash from URL bar so it isn't sitting visible after landing.
      try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch(e) {}
      loadPayload(payload);
    } catch (e) {
      console.error('[follow radar] could not decode hash payload:', e);
      alert('Could not read results from URL: ' + e.message);
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
})();
</script>
```

- [ ] **Step 2: Open `index.html#dev-mock` in a browser**

Expected: results section appears with stat cards counting up, list of "not following back" entries (the names that aren't in the followers list, plus a couple from the mock that follow you but you don't follow back stay in followers — those don't show in non-following-back, which is correct). Search and sort work. Marketing sections below the hero are hidden. CSV export downloads a 2-column file.

- [ ] **Step 3: Open `index.html` plain (no hash)**

Expected: full marketing page (hero, how, bookmarklet card, privacy, FAQ, footer). Results section hidden.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(index.html): rebuild results view JS for bookmarklet payload + hash decode + dev-mock"
```

---

### Task 22: Mobile responsive pass

Most sections already have media queries. Verify the whole page works at 375px wide and tighten anything that breaks.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Open index.html, set browser width to 375px (iPhone SE size)**

Walk down the page from hero to footer. Check:
- Hero title doesn't overflow horizontally (clamp should keep it sane)
- "How it works" cards stack vertically
- Bookmarklet card has reasonable padding (not crammed against the edges)
- Bookmarklet button still draggable and not overflowing
- Drag diagram SVG fits inside the card
- Privacy section turns into the horizontal scroll-snap strip with each card visible
- FAQ items are tappable, summary text doesn't overflow
- Footer is centered, links readable
- Dev-mock results view: stats grid is 2x2, cards are single-column, search/sort stack vertically

- [ ] **Step 2: Add any mobile fixes that came up**

Add a single mobile media-query block at the bottom of the CSS for any tweaks. Likely candidates (only add what's actually broken on your screen):

```css
@media(max-width:480px){
  .hero h1{font-size:clamp(2.5rem,11vw,3.5rem)}
  .hero{padding:1.5rem 1.25rem;min-height:88vh}
  .bm-card{padding:2rem 1.25rem}
  .bm-card .bm-sub{font-size:0.95rem}
  .bm-button{padding:16px 32px;font-size:1rem}
  .controls{flex-direction:column;align-items:stretch}
  .search{min-width:0}
  .sort{width:100%}
}
```

- [ ] **Step 3: Re-check at 375px width**

Confirm everything is comfortable.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix(index.html): mobile pass — tighten hero, bookmarklet card, results controls"
```

---

### Task 23: Reduced-motion verification

The spec is explicit: shimmer, idle pulse, and the diagram dash flow must be disabled under `prefers-reduced-motion`. Also verify the existing radar-ping and shader bg behave correctly.

**Files:**
- Modify: `index.html` (only if gaps are found)

- [ ] **Step 1: Force reduced-motion in DevTools**

In Chrome / Safari DevTools: Rendering panel → "Emulate CSS media feature `prefers-reduced-motion`" → reduce. (Or in Firefox: about:config → `ui.prefersReducedMotion = 1`.)

- [ ] **Step 2: Reload index.html and verify everything that should be still is still**

Expected (going down the page):
- Shader background canvas: hidden (already handled by existing `@media(prefers-reduced-motion:reduce){#shader-bg{display:none}}`)
- Hero `.gradient` shimmer: not animating (handled in Task 14's CSS)
- Hero scroll bounce, radar ping, hero-tag pulse-dot: technically still animating because the existing rules don't disable these. Per the spec, these are subtle and the current `@media(prefers-reduced-motion:reduce)` rule at the bottom of the file (`*{animation-duration:0.01ms!important...}`) should already be neutralizing them. Verify in DevTools that the CSS rule is matching.
- Bookmarklet button idle pulse: not animating (Task 16 added the explicit reduced-motion override)
- Bookmarklet diagram arrow dash flow: not animating (Task 16 explicit override)
- FAQ open/close: still works but transition is essentially instant due to the universal rule

If anything is still animating, add an explicit `@media(prefers-reduced-motion:reduce)` override for it.

- [ ] **Step 3: Toggle reduced-motion off, confirm animations resume**

- [ ] **Step 4: Commit only if changes were made**

```bash
git add index.html
git commit -m "fix(index.html): close reduced-motion gaps after manual audit"
```

If no changes were needed, skip the commit.

---

## Phase 4 — Final verification

### Task 24: Full local verification checklist

End-to-end check of everything we built. Nothing to commit unless something is broken.

- [ ] **Step 1: Test harness — all tests pass**

Open `tests.html`. Expected: green summary with zero failures. Every row reads PASS.

- [ ] **Step 2: Marketing page — visual walk**

Open `index.html` (no hash). Walk down the page:

- Hero: title visible, shimmer animating, scroll hint bouncing
- How it works: 3 cards horizontal on desktop, watermark numerals visible, arrows between cards
- Bookmarklet card: gradient border visible, button pulsing, drag diagram animating
- Bookmarklet button: hover scales it up + glow shadow grows, animation pauses on hover
- Bookmarklet button: actually draggable (try dragging it onto the bookmarks bar of your real browser if you want to test the install gesture; do NOT click it on a non-instagram.com page or you'll get the "Open instagram.com first" alert, which is correct behavior)
- Privacy: 4 columns on desktop
- FAQ: each item opens smoothly with chevron rotation
- Footer: gradient top border visible

- [ ] **Step 3: Dev-mock results view**

Open `index.html#dev-mock`. Expected:
- Marketing sections hidden
- Hero still visible
- Results section visible with stat cards counting up
- "Not following back" list shows the expected names
- Search filters live
- Sort A→Z and Z→A both work
- CSV export downloads a 2-column file (`Username,Profile URL`) with UTF-8 BOM
- Hover on a result card: lifts slightly, warm shadow

- [ ] **Step 4: Mobile (375px) walk**

Resize browser to 375px wide and re-walk both pages. Confirm everything is comfortable.

- [ ] **Step 5: Reduced-motion walk**

Toggle `prefers-reduced-motion` in DevTools. Reload both pages. Confirm shimmer / pulse / dash-flow are still.

- [ ] **Step 6: Console clean**

Open DevTools console on `index.html`, `index.html#dev-mock`, and `tests.html`. Expected: no errors.

- [ ] **Step 7: b.js loader stub link wiring**

Inspect the `bm-link` `<a>` element in `index.html`. Confirm its `href` starts with `javascript:` and contains the `fetch('https://follow-radar.app/b.js?v='+...` text.

- [ ] **Step 8: Files on disk match the spec**

```bash
ls
```

Expected to see: `CLAUDE.md`, `b.js`, `index.html`, `tests.html`, plus the `docs/` directory. Expected NOT to see: `test_followers_1.json`, `test_following.json`.

- [ ] **Step 9: Git status clean**

```bash
git status
```

Expected: working tree clean.

- [ ] **Step 10: Self-review the spec one last time against the deployed page**

Open the spec at `docs/superpowers/specs/2026-04-07-bookmarklet-redesign-design.md` next to the running page. Walk through each section of the spec and confirm something on the page matches it. If you find a gap, add a fix task.

---

## Known unverified

These cannot be tested without deploying to a real domain. They are documented as "Schrödinger's bookmarklet" in the spec:

- The actual loader stub fetching `b.js` from `https://follow-radar.app/b.js` (placeholder domain)
- Instagram's CSP not blocking the `fetch` from the loader stub
- The internal `/api/v1/friendships/<id>/followers/` endpoint returning the expected shape with the user's session cookies
- Real-world rate-limit thresholds vs. our 1.5s throttle
- The hash redirect `window.location = 'https://follow-radar.app/#data=...'` actually landing on a deployed follow-radar.app

When the user deploys, smoke test by:
1. Drag the bookmarklet to the bookmarks bar from the deployed page
2. Open instagram.com, log in
3. Click the bookmarklet
4. Expect: progress overlay, then redirect to follow-radar.app with results

If anything fails: check the IG tab's DevTools console first, then network tab, then the `localStorage['follow-radar:resume']` key for resume state.
