# DOM Scraping Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite b.js to scrape follower/following data by scrolling Instagram's actual UI in a popup window instead of calling internal API endpoints directly, making the tool virtually undetectable.

**Architecture:** The bookmarklet opens a small popup window to the user's Instagram profile. It clicks "Followers" to open the modal, scrolls it to load users (Instagram's own code makes the API calls), and reads usernames/names/mutual info from the rendered DOM. Repeats for "Following" and the post grid. Ships the same payload format to flockscan.org. Uses structural selectors (links, roles, text content) instead of CSS class names for resilience. Falls back to React fiber tree if DOM selectors break.

**Tech Stack:** Vanilla JS (no build step), browser DOM APIs, same encoding/cooldown infrastructure from current b.js.

---

## File Structure

All changes are in one file:

- **Modify: `b.js`** — Replace API scraping engine with DOM-based popup scraping. Keep encoding, resume, cooldown, and shipping functions unchanged.
- **Modify: `tests.html`** — Update tests for new DOM scraping functions, remove API-specific tests.

The payload format shipped to index.html/business.html is unchanged — no modifications needed to those files.

## What stays from current b.js

- `encodePayload()` / `decodePayload()` — hash encoding
- `saveResumeState()` / `loadResumeState()` / `clearResumeState()` — resume on interruption
- `checkCooldown()` / `saveCooldown()` — 3-day scan cooldown
- `shipResults()` — redirect with payload
- `RateLimitError` class — still useful if IG shows an error screen
- `SCAN_CAP`, `COOLDOWN_MS`, `COOLDOWN_KEY`, `FOLLOW_RADAR_URL`, `RESUME_KEY` constants
- Overlay UI functions (`createOverlay`, `updateOverlay`, `destroyOverlay`) — modified to target popup window

## What gets removed

- `doFetch`, `igHeaders`, `IG_APP_ID` — no direct API calls
- `fetchPage()`, `classifyResponse()` — API response handling
- `paginate()`, `scrapeFollowers()`, `scrapeFollowing()` — API pagination
- `buildFollowersUrl()`, `buildFollowingUrl()` — API URL builders
- `warmUp()` — no longer needed (the popup IS natural browsing)
- `checkAccountSize()` — replaced by reading counts from the profile DOM
- `scrapePosts()` via API — replaced by DOM post grid scraping
- `THROTTLE_MS`, `THROTTLE_JITTER_MS`, `PAGE_SIZE` — replaced by scroll timing

## What gets added

- `sleep(ms)` — simple delay helper
- `waitForEl(doc, selectorOrFn, timeout)` — polls for element appearance
- `findByText(parent, text)` — finds elements by text content (case-insensitive)
- `extractUsernameFromHref(href)` — parses `/username/` from link hrefs
- `parseMutualText(text)` — extracts mutual count from "Followed by X and N others"
- `openScanPopup(username)` — opens small popup window to user's profile
- `waitForProfileRender(popup)` — waits for React SPA to render profile content
- `readAccountSize(popup)` — reads follower/following counts from profile DOM
- `openListModal(popup, type)` — clicks Followers/Following to open modal
- `scrapeModal(popup, cap)` — scrolls modal, collects users with mutual info
- `scrapePostGrid(popup, maxPosts)` — scrolls profile grid, reads post metrics
- `getReactFiberData(element)` — walks React fiber tree as fallback
- `getCurrentUserDOM(popup)` — reads current user info from rendered profile

---

### Task 1: DOM Utility Functions

**Files:**
- Modify: `b.js` — add utility functions after the cooldown section, before the overlay section

- [ ] **Step 1: Write test for sleep()**

In `tests.html`, add after existing tests:

```javascript
test('sleep delays for at least the specified time', async function () {
  const start = Date.now();
  await window.__followRadarTest.sleep(50);
  const elapsed = Date.now() - start;
  assert(elapsed >= 45, 'sleep should delay at least ~50ms, got ' + elapsed);
});
```

- [ ] **Step 2: Run test to verify it fails**

Open `tests.html` in browser. Expected: FAIL with "sleep is not a function" or similar.

- [ ] **Step 3: Implement sleep()**

In `b.js`, after the cooldown section (after `saveCooldown`), add:

```javascript
  // ─── DOM utilities ───────────────────────────────────────────────

  const SCROLL_PAUSE_MS = 2000; // time to wait after each scroll for IG to load more
  const SCROLL_SETTLE_MS = 500; // extra settle time to detect if new content appeared

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }
```

Add to test exports:

```javascript
window.__followRadarTest.sleep = sleep;
```

- [ ] **Step 4: Run test to verify it passes**

Open `tests.html`. Expected: PASS.

- [ ] **Step 5: Write test for waitForEl()**

```javascript
test('waitForEl resolves when element appears', async function () {
  var container = document.createElement('div');
  document.body.appendChild(container);
  // Add element after 50ms
  setTimeout(function () {
    var el = document.createElement('span');
    el.setAttribute('data-test', 'wfe');
    container.appendChild(el);
  }, 50);
  var found = await window.__followRadarTest.waitForEl(container, '[data-test="wfe"]', 2000);
  assert(found !== null, 'should find the element');
  assert(found.getAttribute('data-test') === 'wfe', 'should be the right element');
  container.remove();
});

test('waitForEl rejects on timeout', async function () {
  var container = document.createElement('div');
  try {
    await window.__followRadarTest.waitForEl(container, '[data-test="nope"]', 100);
    assert(false, 'should have thrown');
  } catch (e) {
    assert(e.message.indexOf('timed out') !== -1, 'should mention timeout');
  }
});
```

- [ ] **Step 6: Implement waitForEl()**

```javascript
  function waitForEl(root, selector, timeout) {
    return new Promise(function (resolve, reject) {
      var deadline = Date.now() + (timeout || 10000);
      (function poll() {
        var el = root.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() > deadline) return reject(new Error('waitForEl timed out: ' + selector));
        setTimeout(poll, 200);
      })();
    });
  }
```

Add to test exports:

```javascript
window.__followRadarTest.waitForEl = waitForEl;
```

- [ ] **Step 7: Run tests to verify they pass**

- [ ] **Step 8: Write test for findByText()**

```javascript
test('findByText finds element by case-insensitive text', function () {
  var container = document.createElement('div');
  var a = document.createElement('a');
  a.textContent = '1,234 followers';
  var b = document.createElement('a');
  b.textContent = '567 following';
  container.appendChild(a);
  container.appendChild(b);
  var found = window.__followRadarTest.findByText(container, 'followers');
  assert(found === a, 'should find the followers link');
  var found2 = window.__followRadarTest.findByText(container, 'Followers');
  assert(found2 === a, 'should be case-insensitive');
});
```

- [ ] **Step 9: Implement findByText()**

```javascript
  function findByText(parent, text) {
    var lower = text.toLowerCase();
    var all = parent.querySelectorAll('a, span, div, button, h1, h2');
    for (var i = 0; i < all.length; i++) {
      // Use direct textContent but check it contains the word
      // (not just substring — "following" should not match "followers")
      if (all[i].textContent.toLowerCase().indexOf(lower) !== -1) return all[i];
    }
    return null;
  }
```

Add to test exports.

- [ ] **Step 10: Run tests**

- [ ] **Step 11: Write test for extractUsernameFromHref()**

```javascript
test('extractUsernameFromHref parses username from profile links', function () {
  var ex = window.__followRadarTest.extractUsernameFromHref;
  assert(ex('/johndoe/') === 'johndoe', 'simple username');
  assert(ex('https://www.instagram.com/johndoe/') === 'johndoe', 'full URL');
  assert(ex('/explore/') === null, 'reserved path');
  assert(ex('/reels/') === null, 'reserved path reels');
  assert(ex('/p/ABC123/') === null, 'post link');
  assert(ex('/stories/johndoe/') === null, 'stories link');
});
```

- [ ] **Step 12: Implement extractUsernameFromHref()**

```javascript
  var RESERVED_PATHS = /^\/(explore|reels|stories|p|direct|accounts|about|legal|developer|static|press|api|tags|locations|challenge)\b/;

  function extractUsernameFromHref(href) {
    // Strip origin if present
    var path = href.replace(/^https?:\/\/[^/]+/, '');
    if (RESERVED_PATHS.test(path)) return null;
    var m = path.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
    return m ? m[1] : null;
  }
```

Add to test exports.

- [ ] **Step 13: Run tests**

- [ ] **Step 14: Write test for parseMutualText()**

```javascript
test('parseMutualText extracts mutual count from IG text', function () {
  var p = window.__followRadarTest.parseMutualText;
  assert(p('Followed by sarah_j and 3 others') === 4, '1 named + 3 others = 4');
  assert(p('Followed by sarah_j, mike and 5 others') === 7, '2 named + 5 others = 7');
  assert(p('Followed by sarah_j and mike') === 2, '2 named no others');
  assert(p('Followed by sarah_j') === 1, '1 named');
  assert(p('') === 0, 'empty string');
  assert(p('Some random text') === 0, 'no match');
});
```

- [ ] **Step 15: Implement parseMutualText()**

```javascript
  function parseMutualText(text) {
    if (!text || text.indexOf('Followed by') === -1) return 0;
    // "Followed by X and N others" or "Followed by X, Y and N others"
    var othersMatch = text.match(/(\d+)\s*others?\s*$/i);
    var othersCount = othersMatch ? parseInt(othersMatch[1], 10) : 0;
    // Count named users (separated by commas or "and")
    var afterFollowedBy = text.replace(/^.*?Followed by\s*/i, '');
    var withoutOthers = afterFollowedBy.replace(/\s*and\s*\d+\s*others?\s*$/i, '').replace(/\s*,?\s*\d+\s*others?\s*$/i, '');
    // Remove trailing "and" for the "X and Y" case (no others)
    var names = withoutOthers.split(/\s*,\s*|\s+and\s+/).filter(function (s) { return s.trim().length > 0; });
    return names.length + othersCount;
  }
```

Add to test exports.

- [ ] **Step 16: Run all tests to verify they pass**

- [ ] **Step 17: Commit**

```bash
git add b.js tests.html
git commit -m "feat: add DOM utility functions for popup-based scraping"
```

---

### Task 2: Popup Window Management

**Files:**
- Modify: `b.js` — add popup open/wait/close functions after DOM utilities

- [ ] **Step 1: Write test for openScanPopup() returning a window reference**

Note: `window.open` may be blocked in test context, so this test verifies the function signature and handles the blocked case gracefully.

```javascript
test('openScanPopup returns popup reference or null if blocked', function () {
  var fn = window.__followRadarTest.openScanPopup;
  assert(typeof fn === 'function', 'should be exported');
  // Don't actually open a popup in tests — just verify it's callable
});
```

- [ ] **Step 2: Implement openScanPopup()**

```javascript
  // ─── Popup management ───────────────────────────────────────────

  var scanPopup = null;

  function openScanPopup(username) {
    var w = 420, h = 720;
    var left = window.screen.availWidth - w - 40;
    var top = 60;
    var features = 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top +
                   ',resizable=yes,scrollbars=yes';
    scanPopup = window.open(
      'https://www.instagram.com/' + encodeURIComponent(username) + '/',
      'flock-scan',
      features
    );
    return scanPopup;
  }

  function closeScanPopup() {
    if (scanPopup && !scanPopup.closed) scanPopup.close();
    scanPopup = null;
  }
```

Add to test exports:

```javascript
window.__followRadarTest.openScanPopup = openScanPopup;
window.__followRadarTest.closeScanPopup = closeScanPopup;
```

- [ ] **Step 3: Implement waitForProfileRender()**

This waits for Instagram's React app to render profile content in the popup. It looks for a link containing "/followers" (the followers count link), which confirms the profile has loaded.

```javascript
  async function waitForProfileRender(popup, timeout) {
    var deadline = Date.now() + (timeout || 20000);
    while (Date.now() < deadline) {
      if (popup.closed) throw new Error('Popup was closed before profile loaded.');
      try {
        var doc = popup.document;
        // Look for any link that leads to /followers/ — confirms profile rendered
        var links = doc.querySelectorAll('a[href*="/followers"]');
        if (links.length > 0) return;
      } catch (e) {
        // Cross-origin or not-ready — keep polling
      }
      await sleep(500);
    }
    throw new Error('Profile did not load in time. Check your connection and try again.');
  }
```

Add to test exports.

- [ ] **Step 4: Implement readAccountSize()**

Reads follower/following counts from the rendered profile page.

```javascript
  function readAccountSize(popup) {
    var doc = popup.document;
    var followers = 0, following = 0;

    // Find links to /followers/ and /following/
    var allLinks = doc.querySelectorAll('a[href]');
    for (var i = 0; i < allLinks.length; i++) {
      var href = allLinks[i].getAttribute('href') || '';
      var text = allLinks[i].textContent.replace(/,/g, '').trim();
      // Extract the number from text like "1,234 followers" or just "1234"
      var numMatch = text.match(/([\d.]+[KkMm]?)/);
      if (!numMatch) continue;
      var num = parseCountText(numMatch[1]);
      if (href.indexOf('/followers') !== -1 && href.indexOf('/following') === -1) {
        followers = num;
      } else if (href.indexOf('/following') !== -1) {
        following = num;
      }
    }
    return { followers: followers, following: following };
  }

  // Parse "1,234" or "12.5K" or "1.2M" to a number
  function parseCountText(s) {
    s = s.replace(/,/g, '').trim();
    if (/[Kk]$/.test(s)) return Math.round(parseFloat(s) * 1000);
    if (/[Mm]$/.test(s)) return Math.round(parseFloat(s) * 1000000);
    return parseInt(s, 10) || 0;
  }
```

Add `readAccountSize` and `parseCountText` to test exports.

- [ ] **Step 5: Write test for parseCountText()**

```javascript
test('parseCountText parses various count formats', function () {
  var p = window.__followRadarTest.parseCountText;
  assert(p('1,234') === 1234, 'comma-separated');
  assert(p('567') === 567, 'plain number');
  assert(p('12.5K') === 12500, 'K suffix');
  assert(p('1.2M') === 1200000, 'M suffix');
  assert(p('0') === 0, 'zero');
});
```

- [ ] **Step 6: Run tests**

- [ ] **Step 7: Commit**

```bash
git add b.js tests.html
git commit -m "feat: add popup window management and profile reading"
```

---

### Task 3: Modal Scraping Engine (Followers/Following)

**Files:**
- Modify: `b.js` — add modal open + scroll + read functions

This is the core of the rewrite. The function opens the followers or following modal in the popup, scrolls it, and reads each user row from the DOM.

- [ ] **Step 1: Implement openListModal()**

Opens the Followers or Following modal by clicking the appropriate link on the profile page.

```javascript
  // ─── Modal scraping ─────────────────────────────────────────────

  async function openListModal(popup, type) {
    // type is 'followers' or 'following'
    var doc = popup.document;
    var links = doc.querySelectorAll('a[href]');
    var target = null;
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (type === 'followers' && href.indexOf('/followers') !== -1 && href.indexOf('/following') === -1) {
        target = links[i];
        break;
      }
      if (type === 'following' && href.indexOf('/following') !== -1) {
        target = links[i];
        break;
      }
    }
    if (!target) throw new Error('Could not find ' + type + ' link on profile page.');
    target.click();

    // Wait for modal (role="dialog") to appear
    await waitForEl(doc, '[role="dialog"]', 8000);
    // Small settle for content to render inside the modal
    await sleep(1000);
  }
```

- [ ] **Step 2: Implement scrapeModal()**

Scrolls the modal and reads user data from the DOM. This is the main scraping loop.

```javascript
  async function scrapeModal(popup, cap, onProgress) {
    var doc = popup.document;
    var modal = doc.querySelector('[role="dialog"]');
    if (!modal) throw new Error('No modal found.');

    var users = [];
    var seen = new Set();
    var scrollable = findScrollableChild(modal);
    var noNewContentCount = 0;

    while (users.length < cap) {
      // Find all profile links in the modal
      var links = modal.querySelectorAll('a[href]');
      var prevSize = seen.size;

      for (var i = 0; i < links.length; i++) {
        var username = extractUsernameFromHref(links[i].getAttribute('href') || '');
        if (!username || seen.has(username)) continue;
        seen.add(username);

        // Read user info from surrounding DOM
        var userInfo = readUserRow(links[i], username);
        users.push(userInfo);

        if (users.length >= cap) break;
      }

      if (onProgress) onProgress(users.length);

      // Check if we got new users this scroll
      if (seen.size === prevSize) {
        noNewContentCount++;
        if (noNewContentCount >= 3) break; // no more users to load
      } else {
        noNewContentCount = 0;
      }

      // Scroll down to load more
      if (scrollable) {
        scrollable.scrollTop = scrollable.scrollHeight;
      }
      await sleep(SCROLL_PAUSE_MS);
    }

    // Close modal by pressing Escape
    doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(500);

    return users;
  }

  // Find the scrollable container inside the modal
  function findScrollableChild(modal) {
    // Look for an element with overflow: auto/scroll
    var candidates = modal.querySelectorAll('div');
    for (var i = 0; i < candidates.length; i++) {
      var style = window.getComputedStyle(candidates[i]);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          candidates[i].scrollHeight > candidates[i].clientHeight) {
        return candidates[i];
      }
    }
    // Fallback: the modal itself
    return modal;
  }
```

- [ ] **Step 3: Implement readUserRow()**

Reads username, full name, privacy, verification, and mutual info from a single user row in the modal DOM.

```javascript
  function readUserRow(linkEl, username) {
    // Walk up to find the row container (usually 2-3 levels up from the username link)
    var row = linkEl.closest('div[role="button"]') ||
              linkEl.parentElement?.parentElement?.parentElement ||
              linkEl.parentElement;

    var fullName = '';
    var isPrivate = false;
    var isVerified = false;
    var mutualCount = 0;

    if (row) {
      var textContent = row.textContent || '';

      // Full name: typically a secondary text element in the row.
      // The username link text is the username. Other text spans are full name or mutual info.
      var spans = row.querySelectorAll('span');
      for (var i = 0; i < spans.length; i++) {
        var spanText = spans[i].textContent.trim();
        // Skip the username itself and "Followed by..." text and button text
        if (spanText === username) continue;
        if (spanText.indexOf('Followed by') !== -1) continue;
        if (spanText === 'Follow' || spanText === 'Following' || spanText === 'Remove') continue;
        if (spanText === 'Requested') continue;
        if (spanText.length > 0 && spanText.length < 60 && !fullName) {
          fullName = spanText;
        }
      }

      // Mutual count from "Followed by X and N others" text
      mutualCount = parseMutualText(textContent);

      // Verified badge: look for a verified SVG (title="Verified") or aria-label
      var svg = row.querySelector('svg[aria-label="Verified"]') ||
                row.querySelector('[title="Verified"]');
      if (svg) isVerified = true;
    }

    return {
      username: username,
      full_name: fullName,
      is_private: isPrivate, // Can't reliably detect from modal DOM
      is_verified: isVerified,
      mutual_count: mutualCount,
    };
  }
```

- [ ] **Step 4: Add test exports**

```javascript
window.__followRadarTest.openListModal = openListModal;
window.__followRadarTest.scrapeModal = scrapeModal;
window.__followRadarTest.findScrollableChild = findScrollableChild;
window.__followRadarTest.readUserRow = readUserRow;
```

- [ ] **Step 5: Write unit test for readUserRow() with mock DOM**

```javascript
test('readUserRow extracts user info from mock DOM row', function () {
  var container = document.createElement('div');
  container.setAttribute('role', 'button');
  container.innerHTML =
    '<div><a href="/janedoe/">janedoe</a></div>' +
    '<span>Jane Doe</span>' +
    '<span>Followed by mike and 3 others</span>' +
    '<span>Follow</span>';
  var link = container.querySelector('a');
  var result = window.__followRadarTest.readUserRow(link, 'janedoe');
  assert(result.username === 'janedoe', 'username');
  assert(result.full_name === 'Jane Doe', 'full name');
  assert(result.mutual_count === 4, 'mutual count: 1 named + 3 others');
});

test('readUserRow handles verified badge', function () {
  var container = document.createElement('div');
  container.setAttribute('role', 'button');
  container.innerHTML =
    '<div><a href="/celeb/">celeb</a></div>' +
    '<span>Celebrity Name</span>' +
    '<svg aria-label="Verified"></svg>';
  var link = container.querySelector('a');
  var result = window.__followRadarTest.readUserRow(link, 'celeb');
  assert(result.is_verified === true, 'should detect verified');
});
```

- [ ] **Step 6: Run tests**

- [ ] **Step 7: Commit**

```bash
git add b.js tests.html
git commit -m "feat: add modal scraping engine for followers/following"
```

---

### Task 4: Post Grid Scraping via DOM

**Files:**
- Modify: `b.js` — add post grid scraping function

- [ ] **Step 1: Implement scrapePostGrid()**

Scrolls the user's profile grid and reads post metrics from the DOM. Instagram shows like/comment counts on hover (or in aria-labels on the post elements).

```javascript
  // ─── Post grid scraping ─────────────────────────────────────────

  async function scrapePostGrid(popup, maxPosts) {
    var doc = popup.document;
    var posts = [];
    var seen = new Set();
    var limit = maxPosts || 50;
    var noNewCount = 0;

    // Scroll the main page (not a modal) to load post grid
    while (posts.length < limit) {
      // Posts are typically in <a> tags linking to /p/SHORTCODE/ or /reel/SHORTCODE/
      var postLinks = doc.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');

      var prevSize = seen.size;
      for (var i = 0; i < postLinks.length; i++) {
        var href = postLinks[i].getAttribute('href') || '';
        if (seen.has(href)) continue;
        seen.add(href);

        var post = readPostTile(postLinks[i], href);
        if (post) posts.push(post);
        if (posts.length >= limit) break;
      }

      if (seen.size === prevSize) {
        noNewCount++;
        if (noNewCount >= 3) break;
      } else {
        noNewCount = 0;
      }

      popup.scrollTo(0, popup.document.documentElement.scrollHeight);
      await sleep(SCROLL_PAUSE_MS);
    }

    return posts;
  }

  function readPostTile(linkEl, href) {
    // Try to read metrics from the post element
    // Instagram sometimes puts like/comment counts in aria-labels or list items
    var container = linkEl.closest('article') || linkEl.parentElement;
    var text = (container && container.textContent) || '';

    var likeMatch = text.match(/([\d,]+)\s*likes?/i);
    var commentMatch = text.match(/([\d,]+)\s*comments?/i);

    // Determine media type from href
    var mediaType = 1; // default: photo
    if (href.indexOf('/reel/') !== -1) mediaType = 2; // video/reel

    return {
      id: href.replace(/.*\/(p|reel)\/([^/]+).*/, '$2'),
      taken_at: 0, // not available from grid DOM
      like_count: likeMatch ? parseInt(likeMatch[1].replace(/,/g, ''), 10) : 0,
      comment_count: commentMatch ? parseInt(commentMatch[1].replace(/,/g, ''), 10) : 0,
      media_type: mediaType,
      caption_length: 0,
      carousel_count: 0,
      video_duration: 0,
    };
  }
```

Add to test exports.

- [ ] **Step 2: Write test for readPostTile()**

```javascript
test('readPostTile extracts post info from mock DOM', function () {
  var container = document.createElement('article');
  var link = document.createElement('a');
  link.setAttribute('href', '/p/ABC123/');
  link.innerHTML = '<div><span>42 likes</span><span>5 comments</span></div>';
  container.appendChild(link);
  document.body.appendChild(container);

  var result = window.__followRadarTest.readPostTile(link, '/p/ABC123/');
  assert(result.id === 'ABC123', 'post id');
  assert(result.like_count === 42, 'like count');
  assert(result.comment_count === 5, 'comment count');
  assert(result.media_type === 1, 'photo type');
  container.remove();
});

test('readPostTile detects reels', function () {
  var link = document.createElement('a');
  link.setAttribute('href', '/reel/XYZ789/');
  var result = window.__followRadarTest.readPostTile(link, '/reel/XYZ789/');
  assert(result.media_type === 2, 'reel should be video type');
});
```

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add b.js tests.html
git commit -m "feat: add post grid scraping via DOM"
```

---

### Task 5: React Fiber Fallback

**Files:**
- Modify: `b.js` — add React fiber tree walker as fallback when DOM selectors fail

- [ ] **Step 1: Implement getReactFiberData()**

Instagram is a React app. Each DOM element has a `__reactFiber$` or `__reactInternalInstance$` property that links to its React fiber node. Walking this tree gives access to the raw props/state data that Instagram's components received, including the follower data.

```javascript
  // ─── React fiber fallback ───────────────────────────────────────
  // If DOM selectors break (IG redesign), walk the React fiber tree
  // to find follower/following data that's already in memory.

  function getFiberKey(element) {
    var keys = Object.keys(element);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf('__reactFiber$') === 0 || keys[i].indexOf('__reactInternalInstance$') === 0) {
        return keys[i];
      }
    }
    return null;
  }

  function walkFiber(fiber, predicate, maxDepth) {
    if (!fiber || maxDepth <= 0) return null;
    if (predicate(fiber)) return fiber;
    var result = walkFiber(fiber.child, predicate, maxDepth - 1);
    if (result) return result;
    return walkFiber(fiber.sibling, predicate, maxDepth - 1);
  }

  function getReactFiberData(element, dataKey) {
    var fiberKey = getFiberKey(element);
    if (!fiberKey) return null;
    var fiber = element[fiberKey];

    // Walk up to find a fiber with memoizedProps containing user data
    var node = fiber;
    for (var i = 0; i < 20 && node; i++) {
      var props = node.memoizedProps || {};
      if (props[dataKey] && Array.isArray(props[dataKey])) {
        return props[dataKey];
      }
      // Also check pendingProps
      props = node.pendingProps || {};
      if (props[dataKey] && Array.isArray(props[dataKey])) {
        return props[dataKey];
      }
      node = node.return;
    }

    // Walk down as well
    var found = walkFiber(fiber, function (f) {
      var p = f.memoizedProps || f.pendingProps || {};
      return p[dataKey] && Array.isArray(p[dataKey]);
    }, 15);

    if (found) {
      var p = found.memoizedProps || found.pendingProps || {};
      return p[dataKey];
    }
    return null;
  }
```

Add to test exports.

- [ ] **Step 2: Write test for getFiberKey()**

```javascript
test('getFiberKey finds React fiber property', function () {
  var el = document.createElement('div');
  // Simulate React fiber key
  el['__reactFiber$abc123'] = { memoizedProps: {} };
  var key = window.__followRadarTest.getFiberKey(el);
  assert(key === '__reactFiber$abc123', 'should find fiber key');
});

test('getFiberKey returns null for non-React elements', function () {
  var el = document.createElement('div');
  var key = window.__followRadarTest.getFiberKey(el);
  assert(key === null, 'should return null');
});
```

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add b.js tests.html
git commit -m "feat: add React fiber tree fallback for CSS resilience"
```

---

### Task 6: Rewrite Overlay for Popup Context

**Files:**
- Modify: `b.js` — update `createOverlay`, `updateOverlay`, `destroyOverlay` to accept a target document parameter

- [ ] **Step 1: Modify createOverlay() to accept a target document**

The overlay needs to render in the popup window, not the parent window. Change the function signature to accept an optional `targetDoc` parameter.

```javascript
  function createOverlay(targetDoc) {
    var doc = targetDoc || document;
    if (overlayEl) return;
    // ... (same overlay code, but replace all `document.head` with `doc.head`
    //      and `document.body` with `doc.body` and `document.createElement`
    //      with `doc.createElement`)
```

Every `document.createElement(...)` in createOverlay becomes `doc.createElement(...)`.
Every `document.head.appendChild(...)` becomes `doc.head.appendChild(...)`.
Every `document.body.appendChild(...)` becomes `doc.body.appendChild(...)`.

Also store `doc` reference for `destroyOverlay`:

```javascript
  var overlayDoc = null;

  function createOverlay(targetDoc) {
    overlayDoc = targetDoc || document;
    if (overlayEl) return;
    // ... use overlayDoc everywhere instead of document
  }

  function destroyOverlay() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
    overlayBarEl = null;
    overlayTextEl = null;
    overlayDoc = null;
  }
```

- [ ] **Step 2: Verify overlay still works by reviewing the changes**

No automated test needed — overlay is a visual component.

- [ ] **Step 3: Commit**

```bash
git add b.js
git commit -m "refactor: make overlay target-document aware for popup rendering"
```

---

### Task 7: Rewrite main() to Use DOM Scraping via Popup

**Files:**
- Modify: `b.js` — replace the API-based main() with the popup/DOM-based flow

- [ ] **Step 1: Remove old API scraping infrastructure**

Delete the following functions and constants from b.js (they were already partially removed in earlier stealth-mode changes, but clean up any remaining references):

- `doFetch`, `igHeaders`, `IG_APP_ID` constant
- `throttle()` function
- `THROTTLE_MS`, `THROTTLE_JITTER_MS`, `PAGE_SIZE` constants
- `classifyResponse()`, `fetchPage()`, `fetchPageImpl`
- `buildFollowersUrl()`, `buildFollowingUrl()`
- `paginate()`, `scrapeFollowers()`, `scrapeFollowing()`
- `getCurrentUser()` — replaced by reading from popup DOM
- `checkAccountSize()` — replaced by `readAccountSize()`
- `warmUp()` — no longer needed
- `scrapePosts()` via API — replaced by `scrapePostGrid()`

Keep: `trimUser()` (used to normalize user objects).

- [ ] **Step 2: Implement getCurrentUserDOM()**

Gets the logged-in user's info from the Instagram page before opening the popup.

```javascript
  function getCurrentUserDOM() {
    // Try _sharedData (works on legacy IG web pages)
    try {
      var sd = window._sharedData && window._sharedData.config && window._sharedData.config.viewer;
      if (sd && sd.id && sd.username) {
        return { userId: String(sd.id), username: sd.username };
      }
    } catch (e) { /* fall through */ }

    // Try ds_user_id cookie + profile link in nav
    var cookieUserId = null;
    try {
      var m = document.cookie.match(/(?:^|;\s*)ds_user_id=(\d+)/);
      if (m) cookieUserId = m[1];
    } catch (e) { /* fall through */ }

    // Find username from nav profile link
    if (cookieUserId) {
      var navLinks = document.querySelectorAll('a[href]');
      for (var i = 0; i < navLinks.length; i++) {
        var href = navLinks[i].getAttribute('href') || '';
        var username = extractUsernameFromHref(href);
        if (username && navLinks[i].querySelector('img[alt]')) {
          // This is likely the profile link in the nav (has avatar image)
          return { userId: cookieUserId, username: username };
        }
      }
    }

    // Fallback: look for profile link with avatar in the sidebar/nav
    if (cookieUserId) {
      return { userId: cookieUserId, username: null };
    }

    throw new Error("Could not determine logged-in user. Make sure you're logged into instagram.com.");
  }
```

- [ ] **Step 3: Rewrite main()**

```javascript
  async function main() {
    if (!/(^|\.)instagram\.com$/.test(location.hostname)) {
      alert("Open instagram.com first, then click this bookmarklet.");
      return;
    }

    // Get current user info
    var user;
    try {
      user = getCurrentUserDOM();
    } catch (e) {
      alert(e.message);
      return;
    }

    // If we couldn't get username from DOM, we need it for the popup URL.
    // Try fetching from the page URL if we're on a profile page.
    if (!user.username) {
      var pathMatch = location.pathname.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
      if (pathMatch) {
        user.username = pathMatch[1];
      } else {
        alert("Could not determine your username. Navigate to your profile and try again.");
        return;
      }
    }

    // Check resume state
    var existing = loadResumeState(user.userId);
    if (existing && existing.mismatch) {
      alert("You have a scan in progress on a different account. Switch back to that account, or clear it from DevTools (localStorage key '" + RESUME_KEY + "').");
      return;
    }

    var resume = existing;
    var phase = (resume && resume.phase) || 'followers';

    // Cooldown check
    var cooldownLeft = checkCooldown(user.userId);
    if (cooldownLeft) {
      alert(
        "You scanned recently. To keep your account safe, Flock limits scans to once every 3 days.\n\n" +
        "You can scan again in " + cooldownLeft + "."
      );
      return;
    }

    // Open popup to user's profile
    var popup = openScanPopup(user.username);
    if (!popup || popup.closed) {
      alert(
        "Flock needs to open a small window to scan your followers.\n\n" +
        "Please allow popups for instagram.com and try again."
      );
      return;
    }

    try {
      // Wait for profile to render
      await waitForProfileRender(popup, 20000);
    } catch (e) {
      closeScanPopup();
      alert(e.message);
      return;
    }

    // Read account size from profile DOM
    var sizes = readAccountSize(popup);
    if (sizes.followers > MAX_ACCOUNT_SIZE || sizes.following > MAX_ACCOUNT_SIZE) {
      closeScanPopup();
      alert(
        "Flock is built for accounts under " + MAX_ACCOUNT_SIZE.toLocaleString() + " followers/following.\n\n" +
        "Yours has " + sizes.followers.toLocaleString() + " followers and " + sizes.following.toLocaleString() + " following."
      );
      return;
    }

    // Estimate time
    var totalUsers = Math.min(sizes.followers, SCAN_CAP) + Math.min(sizes.following, SCAN_CAP);
    // ~20 users per scroll, ~2s per scroll
    var estMinutes = Math.ceil(totalUsers / 20 * SCROLL_PAUSE_MS / 60000) + 1;

    // Confirmation dialog
    if (!resume) {
      var ok = confirm(
        'This scan takes about ' + estMinutes + ' minutes. ' +
        'Flock opens a small window and scrolls through your follower list — nothing is shared with us or any server.\n\n' +
        'Keep the scan window open while it runs. You can use other windows and apps in the meantime.\n\n' +
        'Ready to scan?'
      );
      if (!ok) {
        closeScanPopup();
        return;
      }
    }

    // Create overlay in popup window
    try {
      createOverlay(popup.document);
    } catch (e) {
      // If we can't inject overlay (rare), continue without it
    }

    var followers = (resume && resume.partialFollowers) || [];
    var following = (resume && resume.partialFollowing) || [];

    try {
      // Phase 1: Scrape followers
      if (phase === 'followers') {
        updateOverlay('Scanning followers\u2026 (~' + estMinutes + ' min)', 0);
        await openListModal(popup, 'followers');
        followers = await scrapeModal(popup, SCAN_CAP, function (n) {
          updateOverlay('Scanning followers\u2026 ' + n, 0.05 + Math.min(0.4, n / SCAN_CAP));
        });
        phase = 'following';
      }

      // Phase 2: Scrape following
      updateOverlay('Scanning following\u2026', 0.5);
      await openListModal(popup, 'following');
      following = await scrapeModal(popup, SCAN_CAP, function (n) {
        updateOverlay('Scanning following\u2026 ' + n, 0.5 + Math.min(0.35, n / SCAN_CAP));
      });

      // Phase 3: Scrape posts
      updateOverlay('Analyzing your posts\u2026', 0.9);
      var posts = [];
      try {
        posts = await scrapePostGrid(popup, 50);
        updateOverlay('Analyzing your posts\u2026 ' + posts.length + ' found', 0.98);
      } catch (e) {
        console.warn('[flock] post scrape failed:', e);
      }

    } catch (e) {
      destroyOverlay();
      closeScanPopup();

      // Save resume state if we have partial data
      if (followers.length > 0 || following.length > 0) {
        saveResumeState({
          userId: user.userId,
          username: user.username,
          phase: phase,
          cursor: null,
          partialFollowers: followers,
          partialFollowing: following,
        });
        var payload = {
          username: user.username,
          userId: user.userId,
          scrapedAt: new Date().toISOString(),
          followers: followers,
          following: following,
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
    closeScanPopup();
    clearResumeState();
    saveCooldown(user.userId);

    var payload = {
      username: user.username,
      userId: user.userId,
      scrapedAt: new Date().toISOString(),
      followers: followers,
      following: following,
      posts: posts,
    };
    try {
      await shipResults(payload);
    } catch (e) {
      alert("Could not redirect to Flock: " + e.message);
    }
  }
```

- [ ] **Step 4: Update test exports**

Remove old API function exports, add new DOM function exports. The full test exports block becomes:

```javascript
  if (typeof window !== 'undefined' && window.__followRadarTest) {
    window.__followRadarTest.RateLimitError = RateLimitError;
    window.__followRadarTest.constants = {
      MAX_ACCOUNT_SIZE, SCAN_CAP, SCROLL_PAUSE_MS, SCROLL_SETTLE_MS,
      COOLDOWN_MS, COOLDOWN_KEY, FOLLOW_RADAR_URL, RESUME_KEY
    };
    window.__followRadarTest.encodePayload = encodePayload;
    window.__followRadarTest.decodePayload = decodePayload;
    window.__followRadarTest.saveResumeState = saveResumeState;
    window.__followRadarTest.loadResumeState = loadResumeState;
    window.__followRadarTest.clearResumeState = clearResumeState;
    window.__followRadarTest.checkCooldown = checkCooldown;
    window.__followRadarTest.saveCooldown = saveCooldown;
    window.__followRadarTest.sleep = sleep;
    window.__followRadarTest.waitForEl = waitForEl;
    window.__followRadarTest.findByText = findByText;
    window.__followRadarTest.extractUsernameFromHref = extractUsernameFromHref;
    window.__followRadarTest.parseMutualText = parseMutualText;
    window.__followRadarTest.parseCountText = parseCountText;
    window.__followRadarTest.openScanPopup = openScanPopup;
    window.__followRadarTest.closeScanPopup = closeScanPopup;
    window.__followRadarTest.readAccountSize = readAccountSize;
    window.__followRadarTest.readUserRow = readUserRow;
    window.__followRadarTest.readPostTile = readPostTile;
    window.__followRadarTest.getFiberKey = getFiberKey;
    window.__followRadarTest.getReactFiberData = getReactFiberData;
    window.__followRadarTest.trimUser = trimUser;
    window.__followRadarTest.shipResults = shipResults;
    window.__followRadarTest.main = main;
    return;
  }
```

- [ ] **Step 5: Commit**

```bash
git add b.js
git commit -m "feat: rewrite main() to use DOM scraping via popup window"
```

---

### Task 8: Update Existing Tests + Remove Stale Tests

**Files:**
- Modify: `tests.html` — remove API-specific tests, update encoding tests, add integration sanity tests

- [ ] **Step 1: Remove API-specific tests**

Delete tests that reference `fetchPage`, `classifyResponse`, `buildFollowersUrl`, `buildFollowingUrl`, `scrapeFollowers`, `scrapeFollowing`, `fetchPageImpl`, `setFetchPageImpl`, `setFetch`. These functions no longer exist.

- [ ] **Step 2: Update encoding round-trip test**

The existing encoding test creates mock users with `{username, full_name, is_private}`. Update to also include `mutual_count` in the mock data since that's now part of the payload:

```javascript
test('encodePayload + decodePayload round-trips with mutual_count', async function () {
  var users = [];
  for (var i = 0; i < 100; i++) {
    users.push({ username: 'user' + i, full_name: 'User ' + i, is_private: false, mutual_count: i % 5 });
  }
  var obj = { username: 'me', followers: users, following: users, scrapedAt: new Date().toISOString() };
  var encoded = await window.__followRadarTest.encodePayload(obj);
  var decoded = await window.__followRadarTest.decodePayload(encoded);
  assert(decoded.followers.length === 100, 'should round-trip 100 followers');
  assert(decoded.followers[3].mutual_count === 3, 'mutual_count should survive round-trip');
});
```

- [ ] **Step 3: Verify all tests pass**

Open `tests.html` in browser. All tests should pass.

- [ ] **Step 4: Commit**

```bash
git add tests.html
git commit -m "test: update test suite for DOM scraping rewrite"
```

---

### Task 9: Update Bookmarklet Loader Stub in index.html

**Files:**
- Modify: `index.html` — verify the bookmarklet loader stub still works

- [ ] **Step 1: Check the loader stub**

The loader stub in `index.html` is:

```javascript
javascript:(()=>{if(!/(^|\.)instagram\.com$/.test(location.hostname)){alert('Open instagram.com first, then click this bookmarklet.');return}fetch('https://flockscan.org/b.js?v='+Date.now()).then(r=>r.text()).then(eval).catch(e=>alert('Could not load follow radar: '+e.message))})()
```

This does NOT need to change. It fetches b.js and evals it — the new b.js will run the DOM-based flow automatically.

- [ ] **Step 2: Verify confirmation dialog text references the popup**

The confirm dialog in `main()` already says "Flock opens a small window" — this is correct for the popup approach.

- [ ] **Step 3: No changes needed — mark as done**

---

### Task 10: Manual Integration Test

- [ ] **Step 1: Deploy and test the full flow**

1. Push changes to GitHub (which deploys to flockscan.org via GitHub Pages)
2. Open instagram.com in Chrome, logged into a test account
3. Click the Flock bookmarklet
4. Verify: confirm dialog appears with time estimate
5. Verify: small popup opens to user's profile in the corner
6. Verify: popup scrolls through followers modal
7. Verify: popup closes, following modal opens and scrolls
8. Verify: profile grid scrolls for posts
9. Verify: popup closes, main window redirects to flockscan.org with results
10. Verify: results page shows followers, following, non-followers with mutual counts
11. Verify: growth analytics shows post data
12. Verify: clicking bookmarklet again within 3 days shows cooldown message

- [ ] **Step 2: Test popup blocker handling**

1. Enable popup blocker in browser settings
2. Click bookmarklet
3. Verify: user gets a clear message to allow popups

- [ ] **Step 3: Test with a small account (< 100 followers)**

Scan should complete in under 1 minute.

- [ ] **Step 4: Test tab switching**

1. Start a scan
2. Switch to a different browser window (not tab)
3. Verify: popup continues scrolling since it's a separate window

---

## Notes

**What if Instagram changes their DOM structure?** The scraping uses structural selectors (links, roles, text content) that are unlikely to change. If they do change:
1. `readUserRow()` is the most fragile function — it walks up from a link to find the row container. If the DOM nesting changes, this breaks first.
2. The React fiber fallback (`getReactFiberData()`) can extract raw data from React's internal state regardless of DOM structure.
3. Worst case: the old API approach can be restored as a fallback — the encoding/shipping infrastructure is unchanged.

**Performance:** For a 3,000-follower account at ~20 users per scroll and 2s per scroll, the follower scan takes ~5 minutes. Following scan takes similar time. Total scan: ~12-15 minutes. This is slower than the old API approach but looks identical to human behavior.

**Popup window:** Opens at 420x720 in the top-right corner of the screen. User can resize or move it. If the popup is closed mid-scan, the error handler saves resume state and ships partial results.
