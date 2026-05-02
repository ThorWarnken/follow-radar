# Privacy Aggregation & Bookmarklet Encoding Fix

**Date:** 2026-05-02
**Status:** Approved

## Problem

Two issues in the Flock codebase:

1. **Privacy:** When a business user scans, the full raw JSON (every follower/following username, full name, and post ID) is POSTed to the Cloudflare Worker at `/report`. Third-party personal data should never leave the browser.

2. **Broken bookmarklet:** The inlined bookmarklet has URL-encoding bugs where `%` (modulo operator, CSS percentages) and `#` (hex colors, hash data) chars cause double-decode corruption in `javascript:` URLs. Instagram's CSP also blocks the `fetch() + eval()` loader stub fallback.

## Design

### Issue 1: Client-side aggregation in business.html

**Approach:** Add an `aggregateScanData(scanData)` function in business.html that runs between `decodePayload()` and the `fetch('/report')` POST. b.js is unchanged — both personal and business bookmarklets produce the same raw payload. The personal flow in index.html still uses raw arrays to render the "who doesn't follow back" list. Only the business POST gets aggregated data.

**Aggregated shape sent to worker:**

```js
{
  username: string,
  userId: string,
  scrapedAt: string,

  // Follower/following aggregates
  follower_count: number,
  following_count: number,
  not_following_back_count: number,
  mutual_count: number,

  // Post aggregates
  total_posts_scanned: number,
  avg_likes_per_post: number,
  avg_comments_per_post: number,
  engagement_rate: number,       // (avg_likes + avg_comments) / follower_count * 100
  post_type_breakdown: { photo: number, video: number, carousel: number },
  best_posting_days: { [day: string]: number },   // avg engagement per day-of-week
  best_posting_hours: { [hour: string]: number },  // avg engagement per hour
}
```

No usernames, full names, user IDs, or post IDs from any account (including the user's own posts) leave the browser.

**Worker changes:** Update `handleReport()` and `computeMetrics()` in `worker/src/index.js` to accept and use this pre-aggregated shape instead of raw arrays. The worker no longer needs to compute follower counts or post metrics — it passes the pre-computed stats directly to the Claude prompt via `buildUserPrompt()`.

### Issue 2: Bookmarklet encoding fix

**Approach:** In both `index.html` and `business.html`, change the href-setting code from:

```js
bmLink.href = 'javascript:' + bmCode.textContent.trim();
```

to:

```js
bmLink.href = 'javascript:' + encodeURIComponent(bmCode.textContent.trim());
```

The `bm-code` / `biz-bm-code` elements store raw (unencoded) minified JS. `encodeURIComponent()` handles all special characters (`%`, `#`, `+`, etc.) correctly. When the browser activates the `javascript:` URL, it URL-decodes once, producing valid JS.

Additionally, re-minify b.js with terser and update the inlined `bm-code` in index.html and `biz-bm-code` in business.html to match the current b.js source. The biz version has `FOLLOW_RADAR_URL` hardcoded to `'https://flockscan.org/business.html'`.

## Files changed

| File | Changes |
|------|---------|
| `business.html` | Add `aggregateScanData()`, call it before POST, fix biz-bm-code href encoding, update inlined bookmarklet |
| `index.html` | Fix bm-code href encoding, update inlined bookmarklet |
| `worker/src/index.js` | Update `handleReport()`, `computeMetrics()`, `buildUserPrompt()` to accept aggregated shape |

## What does NOT change

- `b.js` — no changes, both personal and business bookmarklets produce the same raw payload
- Personal flow in `index.html` — still receives and renders raw follower arrays client-side
- `tests.html` — no changes needed (tests exercise b.js, not business.html aggregation)
