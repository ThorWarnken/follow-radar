# Freemium Paywall with Stripe Payment Links

## Overview

Add a freemium model to Follow Radar: free users see the top 2 "not following back" users ranked by mutual followers in common. Paying users unlock the full list. Payment handled via Stripe Payment Links (no backend). Unlock state stored in localStorage.

## Pricing Tiers

| Tier | Price | Duration |
|------|-------|----------|
| Per scan | $4 | One result set only |
| Monthly | $6/mo | 30 days from purchase |
| Yearly | $25/yr | 365 days from purchase |

## Changes Required

### 1. Bookmarklet Payload — Mutual Follower Counts (b.js)

After computing the "not following back" list, fetch mutual follower counts for each user.

**Endpoint:** `GET https://i.instagram.com/api/v1/friendships/{user_id}/mutual_followers/`
- Uses the same logged-in session cookies as existing scraping
- Throttle with same polite delay (800ms + 300ms jitter) as existing calls
- Extract `mutual_count` from the response (number of shared followers)

**Payload change:** Add `mutual_count` to each user in the `following` array:
```json
{
  "username": "someuser",
  "full_name": "Some User",
  "is_private": false,
  "mutual_count": 12
}
```

If the mutual endpoint fails or is rate-limited for a given user, default `mutual_count` to `0`. Do not block the rest of the scrape.

**Rate-limit consideration:** This adds N API calls where N = number of non-followers-back. For a user with 200 non-followers, at ~1.1s per call, this adds ~3.5 minutes to the scrape. The existing progress UI should reflect this additional phase.

### 2. Results Sorting (index.html)

After computing `nonFol`, sort by `mutual_count` descending:
```javascript
nonFol.sort((a, b) => (b.mutual_count || 0) - (a.mutual_count || 0));
```

Each result row displays a "X mutuals" badge next to the username.

### 3. Paywall UI (index.html)

**Free view (default):**
- All 4 stat cards display real counts (no gating on stats)
- First 2 results render normally with mutual count badges
- Results 3+ are covered by a blurred overlay (`filter: blur(8px)` on the rows, with a gradient fade)
- Overlay contains:
  - Lock SVG icon
  - "Unlock all {N} results"
  - 3 pricing buttons (inline, below the blurred area)

**Unlocked view:**
- All results visible, no overlay
- Small "Pro" badge or similar indicator (optional)

**Pricing section (inline, below free results):**
- 3 cards side by side (stacked on mobile):
  - "This Scan — $4" with subtitle "one-time"
  - "Monthly — $6/mo" with subtitle "unlimited scans"
  - "Yearly — $25/yr" with subtitle "best value" badge
- Each card is an `<a>` linking to the corresponding Stripe Payment Link
- Styled with IG gradient borders, consistent with existing design system

### 4. Payment Flow

**Before redirect to Stripe:**
1. Save current decoded results to `localStorage` key `follow-radar:results` (JSON stringified)
2. Each Stripe Payment Link configured with `success_url`:
   - Per scan: `https://follow-radar.app/#paid=scan`
   - Monthly: `https://follow-radar.app/#paid=monthly`
   - Yearly: `https://follow-radar.app/#paid=yearly`

**On return from Stripe:**
1. `init()` checks for `#paid=` in the hash
2. Sets `localStorage` key `follow-radar:unlocked`:
   ```json
   {
     "type": "scan|monthly|yearly",
     "timestamp": 1714250000000
   }
   ```
3. Clears hash from URL bar via `history.replaceState()`
4. Loads saved results from `follow-radar:results`
5. Renders full results (no paywall)

**Unlock validation logic:**
```javascript
function isUnlocked() {
  const u = JSON.parse(localStorage.getItem('follow-radar:unlocked'));
  if (!u) return false;
  const now = Date.now();
  if (u.type === 'scan') return true; // valid until new scan clears it
  if (u.type === 'monthly') return now - u.timestamp < 30 * 24 * 60 * 60 * 1000;
  if (u.type === 'yearly') return now - u.timestamp < 365 * 24 * 60 * 60 * 1000;
  return false;
}
```

**Per-scan cleanup:** When a new scan loads (hash contains `#data=`), if the unlock type is `scan`, clear the unlock key so they must pay again for the next scan.

### 5. Edge Cases

- **User clears localStorage:** They lose unlock status. No way to recover without a backend. Acceptable tradeoff.
- **User bypasses paywall via devtools:** Acceptable. Target audience is not technical.
- **Bookmarklet rate-limited during mutual fetch:** Default `mutual_count` to 0 for those users. They appear at the bottom of the sorted list. Partial data banner already handles this messaging.
- **Existing users with no mutual_count in payload:** Treat missing `mutual_count` as 0. Sort still works, paywall still applies. Graceful degradation.
- **Mobile users:** Pricing cards stack vertically. Touch targets remain large per existing design system.

### 6. Files Modified

| File | Changes |
|------|---------|
| `b.js` | Add mutual follower count fetching phase after non-followers computed |
| `index.html` | Sort by mutual_count, paywall overlay UI, pricing section, payment flow handling, localStorage persistence |

### 7. What This Does NOT Include

- No backend / server component
- No Stripe webhook handling
- No account system or email-based unlock
- No refund handling (Stripe handles this on their end)
- No analytics or tracking of payment events
