# Follow Radar — Bookmarklet Pivot & Visual Redesign

**Date:** 2026-04-07
**Status:** Approved by user, ready for implementation plan

## Summary

Pivot Follow Radar from a zip-upload tool (that consumed Instagram's official data export) to a bookmarklet that scrapes the logged-in user's followers and following directly from Instagram's internal web API, in the user's own browser, in their own logged-in session. Simultaneously redesign `index.html` into a commanding, editorial-feeling landing page per the original visual brief.

The old hard rule against "username-based scanning" in CLAUDE.md is being lifted as part of this work.

## Goals

- Make "see who doesn't follow me back" a one-click experience after a one-time bookmarklet install, instead of a multi-day dance through Instagram's data export email flow.
- Keep the privacy story load-bearing: no server, no login, no data leaves the user's browser other than through the URL hash fragment the user can see.
- Land a visually striking marketing page that doesn't look AI-generated.
- Remove all zip/parser/JSZip code and test fixtures from the repo.

## Non-goals

- Deploying to a real domain (user handles this separately; `https://follow-radar.app` is a hardcoded placeholder).
- End-to-end verification against real Instagram (not possible without deployment).
- Multi-account support, concurrent scans, cross-session result persistence, monitoring/alerts, email notifications.
- Any form of backend. Ever.
- A bookmarklet installer wizard for browsers that hide the bookmarks bar.
- Any path that asks the user for their Instagram password.

## Architecture

### Two artifacts

1. **`index.html`** — marketing page + results view, served from the deployed origin (placeholder: `https://follow-radar.app`). Single file, vanilla JS, no build.
2. **`b.js`** — the bookmarklet payload, served from the same origin at `/b.js`. Hand-written vanilla JS, no build, no dependencies. Loaded fresh on every click via cache-busting query string.

These are the entire artifact. No third file.

### The loader stub

The draggable button on `index.html` has `href` set to this `javascript:` URL (≈300 bytes):

```js
javascript:(()=>{if(!/(^|\.)instagram\.com$/.test(location.hostname)){alert('Open instagram.com first, then click this bookmarklet.');return}fetch('https://follow-radar.app/b.js?v='+Date.now()).then(r=>r.text()).then(eval).catch(e=>alert('Could not load follow radar: '+e.message))})()
```

Notes:
- Uses `fetch` + `eval` rather than injecting a `<script src>` tag, because Instagram's Content Security Policy is likely to block external script injection but is more likely to allow `connect-src` to our origin. If both are blocked, fallback is to inline the entire `b.js` into the `javascript:` URL (Option Y — documented as a contingency in `b.js` commit messages, not implemented for v1).
- Hostname check accepts `instagram.com` and any subdomain (e.g. `www.instagram.com`).
- Off-Instagram clicks show a native `alert()` and exit.

### Data transport: URL hash fragment

When `b.js` finishes scraping, it:

1. Builds a JSON payload (shape defined below).
2. Gzips via `CompressionStream` if available; falls back to raw JSON if not (older Safari < 16.4).
3. Base64-encodes the bytes.
4. Does `window.location = 'https://follow-radar.app/#data=' + encoded`.

The hash fragment never leaves the browser — browsers do not send `#...` in HTTP requests. `index.html` reads `location.hash` on load, decodes, and renders the results view. After reading, the hash is cleared via `history.replaceState` so the encoded data isn't sitting in the address bar.

### Bookmarklet payload format

Single JSON shape:

```
{
  username: string,         // logged-in user's handle at time of scan
  userId: string,           // logged-in user's numeric IG ID
  scrapedAt: string,        // ISO timestamp
  followers: [{username, full_name, is_private}],
  following: [{username, full_name, is_private}],
  partial?: boolean,        // true if scraping was rate-limited mid-run
  phase?: 'followers'|'following'  // only present if partial
}
```

Note: no follow timestamps and no profile pic URLs. Instagram's internal `/friendships/` API doesn't return follow dates (only the data export did — that's why the old zip-upload flow had them). Profile pics are omitted deliberately: the results view uses gradient-initial avatars, not real photos, and loading pics would create a third-party request footprint we don't want.

### Scraping mechanism

`b.js` calls Instagram's internal web API with the user's session cookies (same-origin from within an instagram.com tab):

- **Current user resolution:** Read `window._sharedData?.config?.viewer` if present. Fallback: `fetch('/api/v1/users/web_profile_info/?username=' + handle)`. Final fallback: alert and bail.
- **Size check:** Before scraping, fetch the user's profile info and check `edge_followed_by.count` and `edge_follow.count`. If either exceeds `MAX_ACCOUNT_SIZE = 10000`, show a friendly alert explaining the cap and exit.
- **Followers endpoint:** `GET https://i.instagram.com/api/v1/friendships/<user_id>/followers/?count=200&max_id=<cursor>` with `X-IG-App-ID: 936619743392459` header. Paginates until `next_max_id` is absent.
- **Following endpoint:** Same shape, `/following/`.
- **Throttling:** `await new Promise(r => setTimeout(r, 1500 + Math.random()*500))` between every page request. Hard-coded constant at top of `b.js`.
- **Page size:** 200 (maximum Instagram allows).

### Error handling & resume

`fetchPage(url)` throws:
- `RateLimitError` on HTTP 429, HTTP 401, or response body containing `feedback_required`, `please wait`, or `login_required`.
- Generic `Error` on network failure or unexpected response shape.

`main()` branches:
- **`RateLimitError`:** Save resume state to `localStorage['follow-radar:resume']` on the instagram.com origin: `{userId, cursor, partialFollowers, partialFollowing, phase, timestamp}`. Ship whatever data we have via hash with `partial: true` flag. follow-radar shows a banner: *"Instagram throttled us at 4,200. Wait ~30 minutes, then click the bookmarklet again on Instagram — it'll pick up where it left off."*
- **Generic `Error`:** `alert("Something went wrong: " + e.message + ". Try again in a few minutes.")` and exit. No retry-within-run.

Resume flow:
- On bookmarklet click, `b.js` first checks `localStorage['follow-radar:resume']`.
- If present AND `userId` matches current logged-in user AND `timestamp < 24 hours` old → resume from saved cursor.
- If present but `userId` mismatches → `alert("You have a scan in progress on @otheraccount. Switch back, or clear it from DevTools.")` and exit.
- If present but stale → ignore and start fresh.
- On successful full completion, clear the resume key.

### Hard-coded constants in `b.js`

```
MAX_ACCOUNT_SIZE     = 10000
THROTTLE_MS          = 1500
THROTTLE_JITTER_MS   = 500
PAGE_SIZE            = 200
IG_APP_ID            = '936619743392459'
RESUME_MAX_AGE_MS    = 24 * 60 * 60 * 1000
FOLLOW_RADAR_URL     = 'https://follow-radar.app'
```

### Progress overlay

`b.js` injects a single `<div>` into `document.body`, fixed bottom-right, white background, 12px padding, follow-radar color palette, shows `Scanning followers… 1,240 / 4,567` with a thin progress bar. Inline styles only (no stylesheet, no shadow DOM). Removed before the redirect.

## `b.js` module structure

```
b.js
├── main()                  // entry point, runs immediately
├── getCurrentUser()        // reads window._sharedData or fetches profile
├── checkAccountSize()      // bails if > 10K, returns counts otherwise
├── loadResumeState()       // reads localStorage, validates user/age
├── saveResumeState()       // writes to localStorage on bail
├── clearResumeState()      // wipes on success
├── scrapeFollowers(cursor) // paginates /followers/ endpoint
├── scrapeFollowing(cursor) // paginates /following/ endpoint
├── fetchPage(url)          // single fetch with throttle + jitter
├── shipResults(data)       // gzip (if available), base64, redirect
├── progressOverlay         // create/update/destroy helpers
└── RateLimitError          // custom error class
```

## `index.html` — page structure

Top to bottom. All sections use the existing CSS variable palette (`--pink`, `--purple`, `--orange`, `--gradient-candy`, etc.) — no new colors.

### 1. Hero (full viewport height)

- Existing radar-ping hero icon
- Trust tag pill: green dot + "runs entirely in your browser"
- `<h1>`: **"See who doesn't follow you back."** Words "follow you back" wrapped in `<span class="gradient">` with candy gradient + shimmer animation
- Subtitle: *"One click on Instagram. No login, no upload, no server. We never see your data."*
- Scroll hint with bouncing chevron
- **No CTA button in hero** — the CTA is the bookmarklet card further down

### 2. How it works (3 horizontal columns desktop, stacked mobile)

- Section badge: "HOW IT WORKS"
- Section title: "Three steps. About sixty seconds."
- Three cards, each with a giant `48px` light-gray watermark numeral behind the content
- SVG connector arrows between cards on desktop only (hidden < 720px)
- **Step 1 — Drag.** Bookmark/star icon. *"Drag the button to your bookmarks bar. It's a tiny piece of code. Costs nothing, does nothing until you click it."*
- **Step 2 — Open Instagram.** Existing IG camera icon. *"Open instagram.com and log in. Has to be the web version, not the app. Mobile Safari works."*
- **Step 3 — Click.** Cursor icon. *"Click the bookmarklet, wait a minute. We'll scan your followers and following, then bring you back here with the answers."*

### 3. The bookmarklet card (dominant section)

- ~960px wide (wider than other sections to feel dominant)
- Padding: 4rem desktop, 2rem mobile
- 1px gradient border via `background-clip` double-background trick, using `--gradient-ig`
- Section badge: "DRAG ME"
- Title: "Your bookmarklet."
- Subtitle: "Drag this button up to your bookmarks bar. That's the install."
- **The button:** large pill, candy gradient, white text, reads "follow radar". `href` is the loader stub. Subtle idle pulse (scale 1 → 1.02 → 1, 3s loop, paused on hover, disabled by `prefers-reduced-motion`). Hover: scale 1.06 + glow shadow grows.
- **Diagram below the button:** inline SVG showing a stylized browser window with a dotted curved arrow from the button's position up into the bookmarks bar strip, plus a ghosted preview of the button at the destination. CSS animation: `stroke-dashoffset` cycles to make dashes flow upward. ~4s loop. Reduced-motion: static.
- Helper line: *"Don't see your bookmarks bar? Press ⌘⇧B (Mac) or Ctrl+Shift+B (Windows)."*

### 4. Privacy (4 columns desktop, horizontal scroll-snap strip on mobile)

- Section badge: "PRIVACY"
- Section title: "Nothing leaves your browser. Truly."
- Four items, each with a small 24px icon above two lines of text:
  - **No login.** "We never ask for your password. Instagram never sees us at all."
  - **No server.** "Everything runs in your browser. There is no backend to leak data from."
  - **No tracking.** "No analytics, no cookies, no fingerprinting. Open the network tab and check."
  - **Open source.** "The bookmarklet is ~200 lines of JavaScript. Read it before you run it."

### 5. FAQ (collapsible `<details>` items)

- Section badge: "QUESTIONS"
- Section title: "Things people ask."
- CSS-only smooth open/close via `display: grid` + `grid-template-rows: 0fr`/`1fr` trick
- Chevron rotates 180° on `[open]`
- Six items, drafted:

1. **Is this safe?** — "Yes. The bookmarklet is JavaScript that runs in your own browser, on your own logged-in Instagram session, the same way the Instagram website does. It doesn't send your data anywhere except back to follow-radar, in your URL bar, where you can see it."
2. **Will Instagram ban me for using this?** — "We don't think so, but we can't promise. The bookmarklet makes the same requests Instagram's own web app makes, and it deliberately goes slowly (about one request every 1.5 seconds) to look like a real person browsing. If Instagram throttles you, you might be temporarily blocked from viewing follower lists for half an hour. We don't know of anyone whose account has been banned for using a tool like this, but tools like this exist in a gray area. If you're worried, don't run it on an account that matters to you."
3. **It stopped halfway through. What happened?** — "Instagram throttled the requests. This is normal on big accounts. Wait about 30 minutes, then click the bookmarklet again on Instagram — it remembers where it left off and picks up from there. We saved your progress."
4. **Why is there a 10,000 follower cap?** — "Above 10K, the scan takes long enough that Instagram is much more likely to throttle you, and the wait is long enough that this stops feeling like a 'one click' tool. If you really need it for a bigger account, the code is open source — fork it and remove the cap."
5. **Does this work on private accounts?** — "Yes, for your own account and any private account you already follow. The bookmarklet uses your own logged-in session, so it sees exactly what you see when you're scrolling Instagram normally."
6. **What about the official Instagram data export?** — "That still works and is more reliable, but it's slow (Instagram emails it to you, can take a day) and the file format keeps changing. The bookmarklet is the fast version. If you'd rather use the export, it's in Instagram's settings under 'Your activity → Download your information'."

### 6. Footer

- Padding `4rem 1.5rem 3rem`
- Top border via `::before` pseudo-element: `linear-gradient(to right, transparent, rgba(225,48,108,0.25), transparent)`, `left: 10%; right: 10%; height: 1px` — soft fade in the middle
- Center text: *"made because i was sick of third-party apps wanting my password"*
- Small links: "GitHub" (placeholder `#`) · "Privacy is the whole point" (anchors to #privacy) · year
- Warmer gray than current footer

### 7. Results view (hidden by default)

Shown when `location.hash` contains valid data.

- **Mostly unchanged** from current: stat cards with count-up, debounced search, virtual scroll (64px rows, 15-row buffer, kicks in above 200), CSV export with UTF-8 BOM, per-row gradient avatar
- **Timestamp features removed** because Instagram's internal `/friendships/` API does not return follow dates (only the data export did). Specifically:
  - Sort dropdown reduced to `A → Z` and `Z → A` only (no "Most recent" / "Oldest first")
  - Per-row date line removed (just username + profile link)
  - CSV exports two columns only: `Username, Profile URL`
  - Default sort is `A → Z`
- Per-row shape becomes `{username, full_name, href, is_private}` — no `ts`
- **Visually polished** to match new aesthetic: same spacing rhythm, same hover lifts, same shadow palette
- When results are showing, sections 2–6 are hidden (only hero + results visible)
- If `partial: true` in payload, a thin pink-tinted banner above stat cards: *"Instagram throttled us at N accounts. These are the ones we got. Click the bookmarklet again on Instagram to resume."*
- On load, `history.replaceState` clears the hash from the URL bar after reading

### Sections being deleted from the current file

- The entire "get your follower list" instructions section (IG button + 3 data-export steps)
- The entire walkthrough block (`.walkthrough`, `.phone`, `.wt-*`, the auto-advancing phone mockup)
- The entire drop zone block (`.drop`, `.chips`, `.btn-analyze`, file input, drag-and-drop handlers)
- JSZip script tag
- `parseFollowersFile` / `parseFollowingFile` and any Format A / Format B parsing code
- Any references to the old data-export copy

Surviving JS: results-rendering (stat card count-up, search, sort, virtual scroll, CSV export, relative-date helper).

## Visual design specifics

### Background

```css
body {
  background: radial-gradient(ellipse at 50% 30%, #fbf7f2 0%, #f5f3ee 45%, #eeece7 100%);
  background-attachment: fixed;
}
```

Existing WebGL plasma shader stays at `opacity: 0.18` on top (unchanged).

Grain overlay: new `body::before`, fixed position, full viewport, SVG noise via data URI, `opacity: 0.035`, `pointer-events: none`, `z-index: 0`.

### Gradient orb

Single `<div class="orb">`:
```css
.orb {
  position: fixed;
  top: -200px;
  right: -200px;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(225,48,108,0.22),
    rgba(131,58,180,0.12) 40%,
    transparent 70%);
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
}
```

Static — no animation. Stays visible under reduced-motion.

### Typography

- Hero `<h1>`: `clamp(3rem, 8vw, 6rem)`, letter-spacing `-0.03em`, `font-weight: 900`
- Section titles: `clamp(2rem, 5vw, 3rem)`, letter-spacing `-0.015em`, `font-weight: 900`
- Section badges: `0.7rem`, letter-spacing `0.12em`
- Body text: `line-height: 1.7`
- FAQ answers: `line-height: 1.75`
- Hero subtitle: `1.15rem` desktop, `line-height: 1.7`

### Hero shimmer

```css
.hero h1 .gradient {
  background: linear-gradient(110deg, #f77737 0%, #e1306c 30%, #833ab4 50%, #e1306c 70%, #f77737 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmer 6s linear infinite;
}
@keyframes shimmer { to { background-position: -200% center; } }
@media (prefers-reduced-motion: reduce) {
  .hero h1 .gradient { animation: none; }
}
```

### Micro-interactions

- **Card hover lift:** `translateY(-6px)` + warm shadow shift `0 12px 40px rgba(225,48,108,0.08)`. Transition `0.4s var(--bounce)`. Applied to step cards, privacy items, FAQ items.
- **Bookmarklet button hover:** `scale(1.06)` + shadow grows from `var(--shadow-glow)` to `0 12px 48px rgba(225,48,108,0.4)`. Transition `0.4s var(--bounce)`.
- **Bookmarklet button idle pulse:** 3s scale 1 → 1.02 → 1 with matching shadow swell. Paused on hover. Disabled under `prefers-reduced-motion`.
- **FAQ open/close:** CSS-only via `<details>` + grid-row trick. Transition `0.35s var(--ease)`. Chevron rotates `180deg` on `[open]`.

### Spacing

- `.section` padding: `6rem 1.5rem` desktop, `4rem 1.25rem` mobile
- Most sections max-width `~800px`
- Bookmarklet card section max-width `~960px`
- FAQ section max-width `~720px`

### Deliberately unchanged

CSS variable palette, Nunito + Quicksand fonts, radar-ping hero icon, shader background code, virtual scroll code, stat card count-up, CSV export.

## CLAUDE.md changes

### File structure block

```
follow-radar/
├── CLAUDE.md          # This file — project context for Claude Code
├── index.html         # Marketing page + results view (single file, no build step)
└── b.js               # The bookmarklet payload, loaded by the loader stub on click
```

### Tech stack block

Remove the JSZip line. Add: *"`b.js` is the bookmarklet payload — vanilla JS, hand-written, no build, loaded fresh on each click via a tiny `javascript:` loader stub embedded in `index.html`."*

### "How it works" block — replaced wholesale

```
1. User lands on follow-radar.app, drags the bookmarklet button to their bookmarks bar
2. User opens instagram.com (logged in), clicks the bookmarklet
3. Loader stub fetches b.js from follow-radar.app (cache-busted), evals it
4. b.js reads the logged-in user from session, paginates IG's internal
   /friendships/<id>/followers/ and /following/ endpoints with polite throttling
5. On success: gzip + base64 the JSON, redirect to follow-radar.app/#data=<payload>
6. follow-radar reads location.hash, computes following − followers, renders results
7. On rate-limit: save resume state to instagram.com localStorage, ship partial data
```

### "Instagram JSON formats" block — deleted, replaced with

```
## Bookmarklet payload format
b.js produces and follow-radar consumes a single JSON shape:
{
  username: string,
  userId: string,
  scrapedAt: string,
  followers: [{username, full_name, is_private}],
  following: [{username, full_name, is_private}],
  partial?: boolean,
  phase?: 'followers'|'following'
}
```

### Hard rule #3 — replaced

> *"The bookmarklet is the legitimate path. It runs in the user's own browser, in their own logged-in Instagram session, hitting the same internal endpoints (`i.instagram.com/api/v1/friendships/...`) that Instagram's own web client uses. Throttle politely (1.5s + jitter between requests). Never hit Instagram from any origin other than instagram.com itself. Never ask the user for their password — ever. Never proxy requests through any server. If Instagram changes the endpoints, update b.js — that's the deal. The official data export is no longer mentioned in the UI as a path, but it remains a fallback users can find on their own."*

### Hard rule #5 — replaced

> *"No build step, no framework, no npm. The artifact is `index.html` plus `b.js` — that's it. Both are hand-written vanilla JS. If you find yourself wanting a third file, stop and reconsider."*

### Workflow preferences

Remove the "Test with both Format A and Format B JSON files" bullet.

## Files to delete

- `test_followers_1.json`
- `test_following.json`

## Dev-mock for local testing

Because we can't test against real Instagram without deploying first, `index.html` ships with a dev-mock: appending `#dev-mock` to the URL loads a hardcoded fake `{followers, following}` payload of ~50 accounts. This exercises the results view (stat cards, count-up, search, sort, virtual scroll preview, CSV export) end-to-end. Stays in production — harmless preview feature, useful for screenshots and demos.

## Known risks

1. **IG endpoint breaks.** Mitigation: cache-busted `b.js`, fix deploys to all users immediately.
2. **IG rate-limiting too aggressive for 1.5s throttle.** Mitigation: `THROTTLE_MS` is a constant — easy to bump. If hopeless, lower `MAX_ACCOUNT_SIZE`.
3. **`CompressionStream` unavailable on older Safari.** Mitigation: feature-detect, fall back to raw JSON base64. 5K-account lists are ~530KB base64 — fragments handle this fine.
4. **User closes IG tab mid-scrape.** Resume state in localStorage survives; next click resumes cleanly.
5. **User switches IG accounts between runs.** Resume state's `userId` mismatch → bookmarklet alerts and refuses to mix data.
6. **Instagram's CSP blocks loader stub.** *Medium-high likelihood.* Mitigation in v1: use `fetch` + `eval` instead of `<script src>` injection. If `connect-src` also blocks our origin, contingency is to inline `b.js` into the `javascript:` URL (not implemented for v1, flagged in commit message).
7. **Instagram shadowbans the account.** Cannot mitigate beyond throttling. Documented honestly in FAQ.

## What "done" means

- `index.html` redesigned per page structure and visual specifics sections
- All zip/parser/JSZip/drop-zone/walkthrough code removed
- `b.js` written per module structure
- `CLAUDE.md` updated per CLAUDE.md changes section
- `test_followers_1.json` and `test_following.json` deleted
- `#dev-mock` hash works locally and shows results view with fake data
- Page renders and is fully interactive locally (sections, hover states, FAQ animation, mobile responsive, `prefers-reduced-motion`)
- Bookmarklet is **not verified against real Instagram** — this is acknowledged, and the spec is explicit that live verification waits until deployment
