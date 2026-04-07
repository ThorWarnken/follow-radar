# CLAUDE.md — Follow Radar

## Project overview
Follow Radar is a client-side web app that tells Instagram users who doesn't follow them back. No backend, no login, no data leaves the browser. Privacy is load-bearing — never add a server component.

As of the bookmarklet pivot, the flow is: user drags a bookmarklet to their bookmarks bar, opens instagram.com, clicks it, and the bookmarklet scrapes their followers/following lists from Instagram's internal web API (in their own logged-in session) and redirects them back to follow-radar with the results in the URL hash.

## File structure
```
follow-radar/
├── CLAUDE.md          # This file — project context for Claude Code
├── index.html         # Marketing page + results view (single file, no build step)
├── b.js               # The bookmarklet payload, loaded by the loader stub on click
└── tests.html         # Browser-based test harness for b.js
```

## Tech stack
- **Two hand-written files** — `index.html` (marketing + results view) and `b.js` (bookmarklet payload). Vanilla JS, no build, no bundler, no npm.
- **`b.js` is loaded fresh on each click** via a small `javascript:` loader stub embedded in `index.html`. Cache-busted with `?v=Date.now()` so bug fixes reach all users immediately.
- **WebGL shader background** — purple/indigo plasma lines at opacity 0.18 (vanilla JS port)
- **Google Fonts**: Nunito (display headings) + Quicksand (body text)
- **Virtual scrolling** — 64px row height, 15-row buffer, kicks in above 200 results

## How it works
1. User lands on follow-radar.app, drags the bookmarklet button to their bookmarks bar
2. User opens instagram.com (logged in), clicks the bookmarklet
3. Loader stub fetches b.js from follow-radar.app (cache-busted), evals it
4. b.js reads the logged-in user from session, paginates IG's internal
   /friendships/<id>/followers/ and /following/ endpoints with polite throttling
5. On success: gzip + base64 the JSON, redirect to follow-radar.app/#data=<payload>
6. follow-radar reads location.hash, computes following − followers, renders results
7. On rate-limit: save resume state to instagram.com localStorage, ship partial data

## Bookmarklet payload format
`b.js` produces and follow-radar consumes a single JSON shape:
```
{
  username: string,         // logged-in user's handle
  userId: string,           // logged-in user's numeric IG ID
  scrapedAt: string,        // ISO timestamp
  followers: [{username, full_name, is_private}],
  following: [{username, full_name, is_private}],
  partial?: boolean,        // true if scraping was rate-limited mid-run
  phase?: 'followers'|'following'  // only present if partial
}
```

No follow timestamps and no profile pic URLs. Instagram's internal `/friendships/` API doesn't return follow dates (only the data export did). Profile pics are omitted on purpose — the results view uses gradient-initial avatars and we don't want a third-party request footprint.

## Design system — DO NOT DEVIATE
- **Instagram brand palette**: `#f77737` orange, `#e1306c` pink, `#833ab4` purple
- Warm cream radial background, white cards, subtle shadows, soft pink/purple gradient orb in top-right
- Gender-neutral aesthetic — NOT feminine/pastel, NOT generic AI aesthetic
- **Banned**: Inter font, purple-only gradients outside IG palette, glassmorphism, emojis
- Mobile-first: large touch targets, horizontal scroll-snap strips on small screens where appropriate
- `prefers-reduced-motion` respected (shader hidden, shimmer/pulse/dash-flow animations disabled)

## Copy tone
Sophisticated, non-suspicious, honest about tradeoffs:
- "see who doesn't follow you back"
- "one click on instagram"
- "nothing leaves your browser"
- "we don't think so, but we can't promise" (when talking about bans)
- **No emojis anywhere** — all icons are custom inline SVGs

## Results view features
- 4 stat cards with animated count-up (followers / following / not following back / mutuals)
- Debounced search (150ms) across username and full name
- Sort: A → Z or Z → A only (no "recent/oldest" — follow timestamps don't exist in the bookmarklet payload)
- CSV export: `Username, Profile URL` only (UTF-8 BOM)
- Virtual scrolling above 200 items
- Per-row: gradient avatar initial, username → IG profile link, full name or "private" note, external link icon
- Rate-limit banner at top if payload has `partial: true`

## Hard rules — NEVER violate these
1. **No emojis** — every icon is a custom SVG
2. **No backend** — everything runs client-side; privacy story is the selling point
3. **The bookmarklet is the legitimate path** — it runs in the user's own browser, in their own logged-in Instagram session, hitting the same internal endpoints (`i.instagram.com/api/v1/friendships/...`) that Instagram's own web client uses. Throttle politely (1.5s + jitter between requests). Never hit Instagram from any origin other than instagram.com itself. Never ask the user for their password — ever. Never proxy requests through any server. If Instagram changes the endpoints, update b.js — that's the deal. The official data export is no longer mentioned in the UI as a path, but it remains a fallback users can find on their own.
4. **No generic AI aesthetics** — no Inter, no glassmorphism, no purple-only gradients
5. **No build step, no framework, no npm.** The artifact is `index.html` plus `b.js` — that's it. Both are hand-written vanilla JS. If you find yourself wanting a third file (other than `tests.html` for the test harness), stop and reconsider.
6. **Stop and check** — before making changes, show the plan. Confirm before executing.

## Workflow preferences (for Claude Code sessions)
- Use PowerShell as terminal environment
- Explicit stop-and-check points before modifying code
- One command per block
- When editing: show the specific lines being changed and what they become
- Preserve existing working code — don't refactor unless asked
