# Privacy Aggregation & Bookmarklet Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggregate scan data client-side before POSTing to the worker (no raw follower/post data leaves the browser), and fix the bookmarklet URL-encoding so it works under Instagram's CSP.

**Architecture:** Add `aggregateScanData()` in business.html between `decodePayload()` and the `/report` POST. Simplify the worker's `computeMetrics()` to accept pre-computed stats and pass them through to `buildUserPrompt()`. Fix bookmarklet href encoding with `encodeURIComponent()` in both index.html and business.html.

**Tech Stack:** Vanilla JS (no build step), Cloudflare Worker, terser (for minification)

---

### Task 1: Add `aggregateScanData()` in business.html

**Files:**
- Modify: `business.html:2166-2187` (the `checkScanData` function)

- [ ] **Step 1: Add the aggregation function**

Insert this function before the `checkScanData` IIFE (around line 2165) in business.html:

```javascript
function aggregateScanData(scan) {
  var followers = scan.followers || [];
  var following = scan.following || [];
  var posts = scan.posts || [];

  // Follower/following aggregates
  var followerSet = new Set(followers.map(function(u) { return u.username.toLowerCase(); }));
  var notFollowingBack = following.filter(function(u) { return !followerSet.has(u.username.toLowerCase()); });
  var mutualCount = following.filter(function(u) { return followerSet.has(u.username.toLowerCase()); }).length;

  // Post aggregates
  var totalLikes = 0, totalComments = 0;
  var typeBreakdown = { photo: 0, video: 0, carousel: 0 };
  var typeNames = { 1: 'photo', 2: 'video', 8: 'carousel' };
  var dayEngagement = {};  // { "Monday": { total: 0, count: 0 }, ... }
  var hourEngagement = {}; // { "9": { total: 0, count: 0 }, ... }
  var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (var i = 0; i < posts.length; i++) {
    var p = posts[i];
    var likes = p.like_count || 0;
    var comments = p.comment_count || 0;
    totalLikes += likes;
    totalComments += comments;

    var typeName = typeNames[p.media_type] || 'photo';
    typeBreakdown[typeName] = (typeBreakdown[typeName] || 0) + 1;

    if (p.taken_at) {
      var date = new Date(p.taken_at * 1000);
      var eng = likes + comments;
      var day = dayNames[date.getUTCDay()];
      if (!dayEngagement[day]) dayEngagement[day] = { total: 0, count: 0 };
      dayEngagement[day].total += eng;
      dayEngagement[day].count++;

      var hour = String(date.getUTCHours());
      if (!hourEngagement[hour]) hourEngagement[hour] = { total: 0, count: 0 };
      hourEngagement[hour].total += eng;
      hourEngagement[hour].count++;
    }
  }

  var avgLikes = posts.length > 0 ? Math.round(totalLikes / posts.length) : 0;
  var avgComments = posts.length > 0 ? Math.round((totalComments / posts.length) * 10) / 10 : 0;
  var engagementRate = followers.length > 0 && posts.length > 0
    ? Math.round(((totalLikes + totalComments) / posts.length / followers.length) * 10000) / 100
    : 0;

  // Compute best posting days/hours as avg engagement
  var bestDays = {};
  for (var d in dayEngagement) {
    bestDays[d] = dayEngagement[d].count > 0
      ? Math.round(dayEngagement[d].total / dayEngagement[d].count)
      : 0;
  }
  var bestHours = {};
  for (var h in hourEngagement) {
    bestHours[h] = hourEngagement[h].count > 0
      ? Math.round(hourEngagement[h].total / hourEngagement[h].count)
      : 0;
  }

  return {
    username: scan.username,
    userId: scan.userId,
    scrapedAt: scan.scrapedAt,
    follower_count: followers.length,
    following_count: following.length,
    not_following_back_count: notFollowingBack.length,
    mutual_count: mutualCount,
    total_posts_scanned: posts.length,
    avg_likes_per_post: avgLikes,
    avg_comments_per_post: avgComments,
    engagement_rate: engagementRate,
    post_type_breakdown: typeBreakdown,
    best_posting_days: bestDays,
    best_posting_hours: bestHours
  };
}
```

- [ ] **Step 2: Wire it into the POST call**

In `checkScanData()`, change lines 2182-2186 from:

```javascript
      /* Call report endpoint */
      var res = await fetch('https://flock-payments.warnkenc.workers.dev/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, profile: profile, scan: scanData })
      });
```

to:

```javascript
      /* Aggregate scan data — no raw usernames or post records leave the browser */
      var aggregated = aggregateScanData(scanData);

      /* Call report endpoint */
      var res = await fetch('https://flock-payments.warnkenc.workers.dev/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, profile: profile, scan: aggregated })
      });
```

Note: `renderReport` still receives the full `scanData` locally (line 2203) for displaying username/date in the report header. Only the POST gets the aggregated version.

- [ ] **Step 3: Commit**

```bash
git add business.html
git commit -m "feat: aggregate scan data client-side before POST to /report

No raw follower/following usernames or post records leave the browser.
Only aggregate counts and computed averages are sent to the worker."
```

---

### Task 2: Update worker to accept aggregated scan data

**Files:**
- Modify: `worker/src/index.js:301-456` (`computeMetrics` function)
- Modify: `worker/src/index.js:458-533` (`buildUserPrompt` function)

- [ ] **Step 1: Replace `computeMetrics` with a pass-through**

Replace the entire `computeMetrics` function (lines 301-456) with:

```javascript
function computeMetrics(scan) {
  // Scan data arrives pre-aggregated from the client.
  // Map the client shape to the metrics shape used by buildUserPrompt and the response.
  var typeNames = { 'photo': 'Photo', 'video': 'Reel', 'carousel': 'Carousel' };
  var postTypeBreakdown = {};
  var breakdown = scan.post_type_breakdown || {};
  for (var key in breakdown) {
    var displayName = typeNames[key] || key;
    postTypeBreakdown[displayName] = { count: breakdown[key], avgEngagement: 0 };
  }

  var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var bestDays = scan.best_posting_days || {};
  var engagementByDayOfWeek = dayNames.map(function(day) {
    return { day: day, avgEngagement: bestDays[day] || 0, postCount: 0 };
  });

  var bestHours = scan.best_posting_hours || {};
  var engagementByHour = Object.keys(bestHours)
    .map(function(h) { return { hour: parseInt(h), avgEngagement: bestHours[h] || 0, postCount: 0 }; })
    .sort(function(a, b) { return a.hour - b.hour; });

  var bestHourEntry = engagementByHour.length > 0
    ? engagementByHour.reduce(function(best, cur) { return cur.avgEngagement > best.avgEngagement ? cur : best; })
    : null;
  var bestDayEntry = engagementByDayOfWeek.reduce(function(best, cur) {
    return cur.avgEngagement > best.avgEngagement ? cur : best;
  });

  return {
    followerCount: scan.follower_count || 0,
    followingCount: scan.following_count || 0,
    postsAnalyzed: scan.total_posts_scanned || 0,
    avgLikes: scan.avg_likes_per_post || 0,
    avgComments: scan.avg_comments_per_post || 0,
    engagementRate: scan.engagement_rate || 0,
    likeToFollowerRatio: scan.follower_count > 0
      ? Math.round((scan.avg_likes_per_post / scan.follower_count) * 10000) / 100
      : 0,
    postTypeBreakdown: postTypeBreakdown,
    engagementByDayOfWeek: engagementByDayOfWeek,
    engagementByHour: engagementByHour,
    bestPostingTime: bestHourEntry ? bestHourEntry.hour : null,
    bestPostingDay: bestDayEntry.avgEngagement > 0 ? bestDayEntry.day : null,
    postFrequency: 0,
    engagementTrend: 0,
    captionAnalysis: { short: { count: 0, avgEngagement: 0 }, long: { count: 0, avgEngagement: 0 } },
    topPosts: [],
  };
}
```

Note: `postFrequency`, `engagementTrend`, `captionAnalysis`, and `topPosts` are set to zero/empty because we no longer have raw post data. The prompt still references them but they'll show as N/A — this is acceptable since these were secondary signals and the report quality comes from the AI interpreting the primary metrics.

- [ ] **Step 2: Verify `buildUserPrompt` needs no changes**

`buildUserPrompt` (lines 458-533) reads from the `metrics` object returned by `computeMetrics`. Since we preserved the same property names and structure (`followerCount`, `followingCount`, `avgLikes`, `postTypeBreakdown`, etc.), the prompt template works unchanged. No edits needed.

- [ ] **Step 3: Commit**

```bash
git add worker/src/index.js
git commit -m "feat: accept pre-aggregated scan data in /report endpoint

computeMetrics now maps client-side aggregated stats to the metrics
shape used by buildUserPrompt. No raw follower or post arrays expected."
```

---

### Task 3: Fix bookmarklet encoding in index.html

**Files:**
- Modify: `index.html:2972` (the href-setting line)

- [ ] **Step 1: Fix the encoding**

Change line 2972 from:

```javascript
    bmLink.href = 'javascript:' + bmCode.textContent.trim();
```

to:

```javascript
    bmLink.href = 'javascript:' + encodeURIComponent(bmCode.textContent.trim());
```

- [ ] **Step 2: Verify the bm-code element contains raw JS (no pre-encoded %25 or %23)**

```bash
grep -c '%25\|%23' index.html
```

If the bm-code contains `%25` or `%23`, the inlined code needs to be regenerated from b.js with terser. If it contains raw `%` and `#`, it's already correct.

- [ ] **Step 3: Re-minify b.js and update the inlined bm-code if needed**

```bash
npx terser b.js --compress --mangle --output /tmp/b.min.js
node --check /tmp/b.min.js
```

Then replace the content of the `<script type="text/plain" id="bm-code">` element with the contents of `/tmp/b.min.js`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix: use encodeURIComponent for personal bookmarklet href

Prevents % and # chars from being misinterpreted as URL encoding
in javascript: URLs. Re-minified inlined bookmarklet from b.js."
```

---

### Task 4: Fix bookmarklet encoding in business.html

**Files:**
- Modify: `business.html:2336` (the href-setting script)

- [ ] **Step 1: Fix the encoding**

Change line 2336 from:

```javascript
<script>var bizBmLink=document.getElementById("biz-bm-link");var bizBmCode=document.getElementById("biz-bm-code");if(bizBmLink&&bizBmCode){bizBmLink.href="javascript:"+bizBmCode.textContent.trim();}</script>
```

to:

```javascript
<script>var bizBmLink=document.getElementById("biz-bm-link");var bizBmCode=document.getElementById("biz-bm-code");if(bizBmLink&&bizBmCode){bizBmLink.href="javascript:"+encodeURIComponent(bizBmCode.textContent.trim());}</script>
```

- [ ] **Step 2: Re-minify b.js for business and update inlined biz-bm-code**

Create a business variant by patching the FOLLOW_RADAR_URL before minifying:

```bash
sed "s|const FOLLOW_RADAR_URL = 'https://flockscan.org';|const FOLLOW_RADAR_URL = 'https://flockscan.org/business.html';|" b.js > /tmp/b-biz.js
npx terser /tmp/b-biz.js --compress --mangle --output /tmp/b-biz.min.js
node --check /tmp/b-biz.min.js
```

Then replace the content of the `<script type="text/plain" id="biz-bm-code">` element with the contents of `/tmp/b-biz.min.js`.

- [ ] **Step 3: Commit**

```bash
git add business.html
git commit -m "fix: use encodeURIComponent for business bookmarklet href

Same encoding fix as personal bookmarklet. Re-minified from b.js
with FOLLOW_RADAR_URL set to business.html."
```

---

### Task 5: Manual verification

- [ ] **Step 1: Verify no raw data in POST body**

Open business.html locally. Construct a test scan payload:

```javascript
// In browser console on business.html
var testScan = {
  username: 'test', userId: '123', scrapedAt: new Date().toISOString(),
  followers: [{username:'a', full_name:'Alice'}],
  following: [{username:'b', full_name:'Bob'}],
  posts: [{like_count:10, comment_count:2, media_type:1, taken_at: 1700000000}]
};
var result = aggregateScanData(testScan);
console.log(JSON.stringify(result, null, 2));
// Should contain ONLY: follower_count, following_count, not_following_back_count, etc.
// Should NOT contain any username strings like "Alice", "Bob", "a", "b"
```

- [ ] **Step 2: Verify bookmarklet encoding**

Open index.html and business.html locally. Inspect the bookmarklet `<a>` element's href attribute in DevTools. It should start with `javascript:%21function` (the `!` from `!function()` URL-encoded) and not contain any raw `%` or `#` characters that aren't part of proper URL encoding.

- [ ] **Step 3: Push**

```bash
git push origin main
```
