# Freemium Paywall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a freemium paywall — free users see top 2 non-followers sorted by mutual count, paid users unlock all results via Stripe Payment Links.

**Architecture:** The bookmarklet (b.js) gains a third scraping phase that fetches mutual follower counts for each non-follower. The results view (index.html) sorts by mutual count, shows 2 free results, blurs the rest behind a paywall with 3 Stripe Payment Link pricing options. Payment state persists in localStorage.

**Tech Stack:** Vanilla JS, Stripe Payment Links (no backend), localStorage

---

### Task 1: Add mutual follower fetching to bookmarklet (b.js)

**Files:**
- Modify: `b.js:196-204` (trimUser function)
- Modify: `b.js:395-400` (shipResults / payload shape)
- Modify: `b.js:454-519` (main function — add third scraping phase)

- [ ] **Step 1: Add buildMutualUrl helper**

Add after `buildFollowingUrl` (after line 194 in b.js):

```javascript
function buildMutualUrl(userId) {
  return 'https://i.instagram.com/api/v1/friendships/' + userId + '/mutual_followers/';
}
```

- [ ] **Step 2: Add fetchMutualCount function**

Add after `buildMutualUrl`:

```javascript
async function fetchMutualCount(userId) {
  await throttle();
  let resp;
  try {
    resp = await doFetch(buildMutualUrl(userId), {
      credentials: 'include',
      headers: { 'X-IG-App-ID': IG_APP_ID, 'Accept': 'application/json' },
    });
  } catch (e) {
    return 0;
  }
  if (!resp.ok) return 0;
  let body;
  try {
    body = await resp.json();
  } catch (e) {
    return 0;
  }
  // IG returns { users: [...], total_count: N } or similar
  if (typeof body.total_count === 'number') return body.total_count;
  if (Array.isArray(body.users)) return body.users.length;
  return 0;
}
```

- [ ] **Step 3: Add fetchAllMutualCounts function**

Add after `fetchMutualCount`:

```javascript
async function fetchAllMutualCounts(followerSet, following, onProgress) {
  // Compute non-followers first (same logic index.html uses)
  const nonFollowers = [];
  for (const u of following) {
    if (!followerSet.has(u.username.toLowerCase())) {
      nonFollowers.push(u);
    }
  }
  // Fetch mutual counts only for non-followers
  let done = 0;
  const total = nonFollowers.length;
  const countMap = new Map();
  for (const u of nonFollowers) {
    const pk = u.pk || u.userId || u.username;
    const count = await fetchMutualCount(pk);
    countMap.set(u.username.toLowerCase(), count);
    done++;
    if (onProgress) onProgress(done, total);
  }
  return countMap;
}
```

- [ ] **Step 4: Update trimUser to accept optional mutual_count**

In b.js, change `trimUser` (line 198-204) from:

```javascript
function trimUser(u) {
  return {
    username: u.username,
    full_name: u.full_name || '',
    is_private: !!u.is_private,
  };
}
```

to:

```javascript
function trimUser(u, mutualCount) {
  const obj = {
    username: u.username,
    full_name: u.full_name || '',
    is_private: !!u.is_private,
  };
  if (typeof mutualCount === 'number') obj.mutual_count = mutualCount;
  return obj;
}
```

- [ ] **Step 5: Add mutual count phase to main()**

In the `main()` function, after the followers/following scrape succeeds (after line 466, before `destroyOverlay()`), add the mutual count phase. Replace the section from the end of the try block through payload construction:

Find this block in main() (the success path after scraping, around line 502-518):

```javascript
    destroyOverlay();
    clearResumeState();

    const payload = {
      username: user.username,
      userId: user.userId,
      scrapedAt: new Date().toISOString(),
      followers: followers,
      following: following,
    };
```

Replace with:

```javascript
    // Phase 3: fetch mutual follower counts for non-followers
    const followerSet = new Set(followers.map(u => u.username.toLowerCase()));
    let mutualCounts = new Map();
    try {
      updateOverlay('Checking mutual connections\u2026 0/' + following.length, 0.85);
      mutualCounts = await fetchAllMutualCounts(followerSet, following, (done, total) => {
        updateOverlay('Checking mutual connections\u2026 ' + done + '/' + total, 0.85 + 0.15 * (done / total));
      });
    } catch (e) {
      // If mutual fetching fails entirely, continue with zero counts
      console.warn('[follow radar] mutual count fetch failed:', e);
    }

    destroyOverlay();
    clearResumeState();

    // Attach mutual_count to each following user
    const followingWithMutuals = following.map(u => {
      const mc = mutualCounts.get(u.username.toLowerCase()) || 0;
      return { username: u.username, full_name: u.full_name || '', is_private: !!u.is_private, mutual_count: mc };
    });

    const payload = {
      username: user.username,
      userId: user.userId,
      scrapedAt: new Date().toISOString(),
      followers: followers,
      following: followingWithMutuals,
    };
```

- [ ] **Step 6: Also attach mutual_count in the rate-limit partial payload path**

In the rate-limit catch block (around line 488-497), after building the partial payload, add mutual counts if available. The partial path already ships what it has, so just ensure `following` items have `mutual_count: 0` as default:

No change needed here — the partial path ships raw data and mutual counts will default to 0 on the results page. This is acceptable for partial results.

- [ ] **Step 7: Expose new functions for tests**

In the test exposure block (around line 522-545), add:

```javascript
window.__followRadarTest.buildMutualUrl = buildMutualUrl;
window.__followRadarTest.fetchMutualCount = fetchMutualCount;
window.__followRadarTest.fetchAllMutualCounts = fetchAllMutualCounts;
```

- [ ] **Step 8: Update the minified bookmarklet in index.html**

The `<script type="text/plain" id="bm-code">` at line 1137 contains the minified b.js. After modifying b.js, re-minify it and replace the content of that script tag.

Run: Use a JS minifier (or manually minify) and paste the result into the `bm-code` script tag in index.html. Since there's no build step, this is a manual process — copy b.js, minify, replace line 1137's content.

- [ ] **Step 9: Commit**

```bash
git add b.js index.html
git commit -m "feat: fetch mutual follower counts in bookmarklet"
```

---

### Task 2: Sort results by mutual count and display badge (index.html)

**Files:**
- Modify: `index.html:969-978` (loadPayload — nonFol computation)
- Modify: `index.html:998-1001` (doSort — add mutual sort)
- Modify: `index.html:1068-1078` (mkCard — add mutual badge)
- Modify: `index.html:813-816` (sort dropdown — add mutual option)

- [ ] **Step 1: Update nonFol to include mutual_count**

In `loadPayload` (line 975), change:

```javascript
    else nonFol.push({username: u.username, full_name: u.full_name || '', href: profileUrl(u.username), is_private: !!u.is_private});
```

to:

```javascript
    else nonFol.push({username: u.username, full_name: u.full_name || '', href: profileUrl(u.username), is_private: !!u.is_private, mutual_count: u.mutual_count || 0});
```

- [ ] **Step 2: Sort by mutual_count descending as default**

In `loadPayload`, after computing `nonFol` (after line 977 `state.nonFol = nonFol;`), add:

```javascript
  state.sort = 'mutuals';
```

Update `doSort` (lines 998-1002) from:

```javascript
function doSort(){
  const a = state.filtered;
  if (state.sort === 'alpha') a.sort((x,y) => x.username.localeCompare(y.username));
  else a.sort((x,y) => y.username.localeCompare(x.username));
}
```

to:

```javascript
function doSort(){
  const a = state.filtered;
  if (state.sort === 'mutuals') a.sort((x,y) => (y.mutual_count || 0) - (x.mutual_count || 0) || x.username.localeCompare(y.username));
  else if (state.sort === 'alpha') a.sort((x,y) => x.username.localeCompare(y.username));
  else a.sort((x,y) => y.username.localeCompare(x.username));
}
```

- [ ] **Step 3: Add "Most Mutuals" option to sort dropdown**

In the HTML (line 813-816), change:

```html
    <select class="sort" id="srt">
      <option value="alpha">A &#x2192; Z</option>
      <option value="zalpha">Z &#x2192; A</option>
    </select>
```

to:

```html
    <select class="sort" id="srt">
      <option value="mutuals">Most Mutuals</option>
      <option value="alpha">A &#x2192; Z</option>
      <option value="zalpha">Z &#x2192; A</option>
    </select>
```

- [ ] **Step 4: Add mutual badge to mkCard**

In `mkCard` (lines 1068-1078), add a mutual count badge. Change:

```javascript
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
```

to:

```javascript
function mkCard(it){
  const c = document.createElement('div');
  c.className = 'card';
  const ini = (it.username[0] || '?').toUpperCase();
  const gi = Math.abs(hc(it.username)) % 6;
  const mc = it.mutual_count || 0;
  const mutualBadge = mc > 0 ? '<span class="mutual-badge">' + mc + ' mutual' + (mc !== 1 ? 's' : '') + '</span>' : '';
  const fullNameLine = it.full_name ? '<div class="card-name">' + esc(it.full_name) + (it.is_private ? ' &middot; private' : '') + '</div>' : (it.is_private ? '<div class="card-name">private</div>' : '');
  c.innerHTML = '<div class="av av-' + gi + '">' + esc(ini) + '</div>'
    + '<div class="card-info"><div class="card-user"><a href="' + escA(it.href) + '" target="_blank" rel="noopener">@' + esc(it.username) + '</a>' + mutualBadge + '</div>' + fullNameLine + '</div>'
    + '<a class="card-link" href="' + escA(it.href) + '" target="_blank" rel="noopener" title="view on ig"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>';
  return c;
}
```

- [ ] **Step 5: Add CSS for mutual badge**

Add to the CSS section (after the existing `.card-name` styles):

```css
.mutual-badge{
  display:inline-block;margin-left:8px;padding:2px 8px;
  border-radius:var(--radius-pill);font-size:0.7rem;font-weight:700;
  background:linear-gradient(135deg,#833ab4,#e1306c);color:#fff;
  vertical-align:middle;
}
```

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: sort results by mutual count, add mutual badge"
```

---

### Task 3: Add paywall overlay and pricing UI (index.html)

**Files:**
- Modify: `index.html` CSS section (add paywall styles)
- Modify: `index.html` HTML results section (~line 827-831, add paywall overlay)
- Modify: `index.html:1027-1066` (render function — limit to 2 free results)

- [ ] **Step 1: Add paywall CSS**

Add to the CSS section:

```css
/* Paywall */
.paywall-overlay{
  position:relative;margin-top:-32px;padding-top:48px;
  background:linear-gradient(to bottom,transparent,var(--bg) 32px);
}
.paywall-blur{
  filter:blur(8px);pointer-events:none;user-select:none;
  max-height:200px;overflow:hidden;opacity:0.5;
}
.paywall-cta{
  text-align:center;padding:2rem 1rem 1rem;
}
.paywall-cta h3{
  font-family:var(--ff-display);font-size:1.3rem;font-weight:800;
  margin-bottom:0.5rem;
}
.paywall-cta p{
  color:var(--muted);font-size:0.9rem;margin-bottom:1.5rem;
}
.pricing-cards{
  display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;
  max-width:640px;margin:0 auto;
}
.pricing-card{
  flex:1;min-width:160px;max-width:200px;padding:1.5rem 1rem;
  border-radius:var(--radius);background:var(--card);
  border:2px solid rgba(131,58,180,0.15);
  text-align:center;text-decoration:none;color:inherit;
  transition:border-color 0.2s,transform 0.2s;
}
.pricing-card:hover{
  border-color:#e1306c;transform:translateY(-2px);
}
.pricing-card.featured{
  border-color:#833ab4;
  background:linear-gradient(135deg,rgba(131,58,180,0.06),rgba(225,48,108,0.06));
}
.pricing-card .price{
  font-family:var(--ff-display);font-size:1.5rem;font-weight:900;
  background:linear-gradient(135deg,#833ab4,#e1306c);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  background-clip:text;
}
.pricing-card .plan-name{
  font-weight:700;font-size:0.95rem;margin-bottom:0.25rem;
}
.pricing-card .plan-sub{
  font-size:0.78rem;color:var(--muted);
}
.pricing-card .best-value{
  display:inline-block;padding:2px 10px;border-radius:var(--radius-pill);
  font-size:0.68rem;font-weight:800;text-transform:uppercase;
  background:linear-gradient(135deg,#833ab4,#e1306c);color:#fff;
  margin-bottom:0.5rem;
}
.lock-icon{
  width:32px;height:32px;margin:0 auto 0.75rem;opacity:0.6;
}
```

- [ ] **Step 2: Add paywall HTML**

After the `<div id="sp-bot">` (line 830) and before the closing `</div>` of the list (line 831), add the paywall overlay div. Actually, add it after the list div (line 831) but before the empty div (line 833):

```html
  <div class="paywall-overlay" id="paywall" style="display:none">
    <div class="paywall-blur" id="paywall-blur"></div>
    <div class="paywall-cta">
      <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <h3 id="paywall-title">unlock all results</h3>
      <p>you've seen your top 2 — upgrade to see everyone who doesn't follow you back.</p>
      <div class="pricing-cards">
        <a class="pricing-card" id="pay-scan" href="#" target="_blank" rel="noopener">
          <div class="plan-name">this scan</div>
          <div class="price">$4</div>
          <div class="plan-sub">one-time</div>
        </a>
        <a class="pricing-card featured" id="pay-monthly" href="#" target="_blank" rel="noopener">
          <div class="plan-name">monthly</div>
          <div class="price">$6</div>
          <div class="plan-sub">per month</div>
        </a>
        <a class="pricing-card" id="pay-yearly" href="#" target="_blank" rel="noopener">
          <div class="best-value">best value</div>
          <div class="plan-name">yearly</div>
          <div class="price">$25</div>
          <div class="plan-sub">per year</div>
        </a>
      </div>
    </div>
  </div>
```

- [ ] **Step 3: Add isUnlocked function (needed by render)**

Add before the `loadPayload` function in the JS section:

```javascript
const UNLOCK_KEY = 'follow-radar:unlocked';
const RESULTS_KEY = 'follow-radar:results';

function isUnlocked() {
  let u;
  try { u = JSON.parse(localStorage.getItem(UNLOCK_KEY)); } catch(e) { return false; }
  if (!u) return false;
  const now = Date.now();
  if (u.type === 'scan') return true;
  if (u.type === 'monthly') return now - u.timestamp < 30 * 24 * 60 * 60 * 1000;
  if (u.type === 'yearly') return now - u.timestamp < 365 * 24 * 60 * 60 * 1000;
  return false;
}

function setUnlocked(type) {
  localStorage.setItem(UNLOCK_KEY, JSON.stringify({ type: type, timestamp: Date.now() }));
}
```

- [ ] **Step 4: Update render() to enforce paywall**

Modify the `render` function (lines 1027-1051) to limit free users to 2 visible results and show blurred preview of next few.

Change:

```javascript
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
    el.inner.replaceChildren(f);
    return;
  }
  vRender();
}
```

to:

```javascript
function render(){
  const {filtered, nonFol} = state;
  const unlocked = isUnlocked();
  const FREE_LIMIT = 2;
  el.cnt.textContent = 'showing ' + filtered.length.toLocaleString() + ' of ' + nonFol.length.toLocaleString();
  if (nonFol.length === 0){
    el.empty.style.display = 'block';
    el.list.style.display = 'none';
    el.cnt.parentElement.style.display = 'none';
    document.querySelector('.controls').style.display = 'none';
    el.paywall.style.display = 'none';
    return;
  }
  el.empty.style.display = 'none';
  el.list.style.display = 'block';
  el.cnt.parentElement.style.display = '';
  document.querySelector('.controls').style.display = '';

  if (unlocked || filtered.length <= FREE_LIMIT) {
    // Full access
    el.paywall.style.display = 'none';
    lS = -1; lE = -1;
    if (filtered.length <= 200){
      el.spT.style.height = '0';
      el.spB.style.height = '0';
      const f = document.createDocumentFragment();
      filtered.forEach((it, i) => f.appendChild(mkCard(it, i)));
      el.inner.replaceChildren(f);
      return;
    }
    vRender();
  } else {
    // Free: show first 2 + blurred preview + paywall
    el.spT.style.height = '0';
    el.spB.style.height = '0';
    const f = document.createDocumentFragment();
    for (let i = 0; i < FREE_LIMIT; i++) f.appendChild(mkCard(filtered[i], i));
    el.inner.replaceChildren(f);
    // Blurred preview of next few
    const blurF = document.createDocumentFragment();
    const previewCount = Math.min(4, filtered.length - FREE_LIMIT);
    for (let i = FREE_LIMIT; i < FREE_LIMIT + previewCount; i++) blurF.appendChild(mkCard(filtered[i], i));
    el.blurPreview.replaceChildren(blurF);
    el.paywallTitle.textContent = 'unlock all ' + nonFol.length + ' results';
    el.paywall.style.display = 'block';
  }
}
```

- [ ] **Step 5: Add paywall element references**

In the `el` object (lines 893-910), add:

```javascript
  paywall: $('#paywall'),
  blurPreview: $('#paywall-blur'),
  paywallTitle: $('#paywall-title'),
```

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add paywall overlay with pricing cards"
```

---

### Task 4: Implement payment flow and unlock logic (index.html)

**Files:**
- Modify: `index.html` JS section (add isUnlocked, payment hash handling, localStorage persistence)

Note: `isUnlocked`, `setUnlocked`, `UNLOCK_KEY`, and `RESULTS_KEY` were defined in Task 3 Step 3.

- [ ] **Step 1: Save results to localStorage before Stripe redirect**

Add click handlers for the pricing buttons. In the `init()` function, after the existing event listeners (around line 1105), add:

```javascript
  // Pricing link click handlers — save results before redirect
  document.querySelectorAll('.pricing-card').forEach(card => {
    card.addEventListener('click', () => {
      try {
        localStorage.setItem(RESULTS_KEY, JSON.stringify({
          followers: state.followers,
          following: state.following,
          partial: state.partial,
        }));
      } catch(e) {
        console.warn('[follow radar] could not save results:', e);
      }
    });
  });
```

- [ ] **Step 2: Handle #paid= hash on return from Stripe**

In the `init()` function, add handling for the `#paid=` hash. After the `#dev-mock` check (line 1111) and before the `#data=` check (line 1114), add:

```javascript
  if (hash.indexOf('#paid=') === 0) {
    const type = hash.slice(6); // 'scan', 'monthly', or 'yearly'
    if (['scan', 'monthly', 'yearly'].includes(type)) {
      setUnlocked(type);
      try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch(e) {}
      // Restore saved results
      let saved;
      try { saved = JSON.parse(localStorage.getItem(RESULTS_KEY)); } catch(e) {}
      if (saved && saved.followers && saved.following) {
        loadPayload(saved);
      }
    }
    return;
  }
```

- [ ] **Step 3: Clear per-scan unlock on new scan**

In `loadPayload`, at the top of the function (line 964), add:

```javascript
  // Clear per-scan unlock when new data arrives
  try {
    const u = JSON.parse(localStorage.getItem(UNLOCK_KEY));
    if (u && u.type === 'scan') localStorage.removeItem(UNLOCK_KEY);
  } catch(e) {}
```

- [ ] **Step 4: Set Stripe Payment Link URLs**

The pricing card `href` values need to point to the user's actual Stripe Payment Links. In `init()`, set the URLs. These are placeholder URLs that the user will replace with their actual Stripe Payment Link URLs:

```javascript
  // Stripe Payment Link URLs — replace with actual links
  const payScan = document.getElementById('pay-scan');
  const payMonthly = document.getElementById('pay-monthly');
  const payYearly = document.getElementById('pay-yearly');
  const successBase = window.location.origin + window.location.pathname;
  if (payScan) payScan.href = 'STRIPE_SCAN_PAYMENT_LINK_URL' + '?success_url=' + encodeURIComponent(successBase + '#paid=scan');
  if (payMonthly) payMonthly.href = 'STRIPE_MONTHLY_PAYMENT_LINK_URL' + '?success_url=' + encodeURIComponent(successBase + '#paid=monthly');
  if (payYearly) payYearly.href = 'STRIPE_YEARLY_PAYMENT_LINK_URL' + '?success_url=' + encodeURIComponent(successBase + '#paid=yearly');
```

**Note:** The user must replace `STRIPE_SCAN_PAYMENT_LINK_URL`, `STRIPE_MONTHLY_PAYMENT_LINK_URL`, and `STRIPE_YEARLY_PAYMENT_LINK_URL` with their actual Stripe Payment Link URLs from their Stripe dashboard.

- [ ] **Step 5: Hide CSV export for free users**

In `render()`, when the paywall is showing, disable the CSV export and search (they shouldn't work on partial data):

In the paywall branch of `render()` (the `else` block), add at the end before the closing brace:

```javascript
    el.csv.style.display = 'none';
```

And in the unlocked branch, ensure it's visible:

```javascript
    el.csv.style.display = '';
```

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: implement Stripe payment flow with localStorage unlock"
```

---

### Task 5: Update dev mock and test paywall locally (index.html)

**Files:**
- Modify: `index.html:941-960` (devMockPayload — add mutual_count)

- [ ] **Step 1: Add mutual_count to dev mock data**

Update `devMockPayload` (lines 941-960) to include `mutual_count` on following users:

Change:

```javascript
  for (let i = 0; i < names.length; i++){
    following.push({username: names[i], full_name: names[i].replace(/^./, c => c.toUpperCase()), is_private: i % 9 === 0});
  }
```

to:

```javascript
  for (let i = 0; i < names.length; i++){
    following.push({username: names[i], full_name: names[i].replace(/^./, c => c.toUpperCase()), is_private: i % 9 === 0, mutual_count: Math.max(0, names.length - i - 10)});
  }
```

This gives descending mutual counts so the sort is visible in dev mode.

- [ ] **Step 2: Test locally**

Run: Open `index.html#dev-mock` in a browser.

Expected:
- Results sorted by mutual count (highest first)
- Mutual badges visible on cards with count > 0
- Only first 2 results visible
- Blurred preview of next 4 results
- Paywall overlay with 3 pricing cards
- Stat cards show real counts

- [ ] **Step 3: Test unlock flow locally**

Run: Open `index.html#dev-mock`, then manually run in devtools:
```javascript
localStorage.setItem('follow-radar:unlocked', JSON.stringify({type:'monthly',timestamp:Date.now()}));
location.reload();
location.hash = '#dev-mock';
```

Expected: All results visible, no paywall.

Run: Clear unlock:
```javascript
localStorage.removeItem('follow-radar:unlocked');
location.reload();
location.hash = '#dev-mock';
```

Expected: Paywall appears again.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add mutual counts to dev mock for testing"
```

---

### Task 6: Wire up actual Stripe Payment Links

**Files:**
- Modify: `index.html` (replace placeholder Stripe URLs)

- [ ] **Step 1: Get Stripe Payment Link URLs**

The user needs to provide their 3 Stripe Payment Link URLs from the Stripe dashboard:
1. Per-scan ($4 one-time)
2. Monthly ($6/mo subscription)
3. Yearly ($25/yr subscription)

Each Payment Link must be configured in Stripe with the `success_url` parameter support (this is a standard Stripe Payment Links feature under "After payment" settings — set to "Don't show confirmation page" and use a custom URL).

- [ ] **Step 2: Replace placeholder URLs**

Replace `STRIPE_SCAN_PAYMENT_LINK_URL`, `STRIPE_MONTHLY_PAYMENT_LINK_URL`, and `STRIPE_YEARLY_PAYMENT_LINK_URL` in the init() function with the actual Stripe Payment Link URLs provided by the user.

Note: Stripe Payment Links support `?success_url=` as a query parameter when redirect mode is enabled. The URL format is typically: `https://buy.stripe.com/live_XXXXX`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: wire up Stripe Payment Links"
```
