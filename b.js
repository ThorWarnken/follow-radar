// ═══════════════════════════════════════════════════════════════════
// LOADER STUB (this is the bookmarklet href in index.html, not part of b.js):
//
// javascript:(()=>{if(!/(^|\.)instagram\.com$/.test(location.hostname)){alert('Open instagram.com first, then click this bookmarklet.');return}fetch('https://thorwarnken.github.io/follow-radar/b.js?v='+Date.now()).then(r=>r.text()).then(eval).catch(e=>alert('Could not load follow radar: '+e.message))})()
//
// The stub fetches this file, evals it. We use fetch+eval rather than
// <script src> injection because instagram.com's CSP is more likely to
// block external script injection than connect-src to follow-radar.app.
// If both are blocked, the contingency is to inline this entire file
// into the javascript: URL above. Not implemented for v1.
// ═══════════════════════════════════════════════════════════════════

// follow radar bookmarklet payload (b.js)
// Loaded fresh on every click via the loader stub above.
// Runs on instagram.com in the user's own logged-in session.
// See docs/superpowers/specs/2026-04-07-bookmarklet-redesign-design.md
(function () {
  'use strict';

  const MAX_ACCOUNT_SIZE = 10000;
  const THROTTLE_MS = 800;
  const THROTTLE_JITTER_MS = 300;
  const PAGE_SIZE = 200;
  const IG_APP_ID = '936619743392459';
  const RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const FOLLOW_RADAR_URL = 'https://thorwarnken.github.io/follow-radar';
  const RESUME_KEY = 'follow-radar:resume';

  class RateLimitError extends Error {
    constructor(reason) {
      super('rate limited: ' + reason);
      this.name = 'RateLimitError';
      this.reason = reason;
    }
  }

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

  // ─── Fetch + classification ──────────────────────────────────────

  // doFetch is replaceable in tests via window.__followRadarTest.setFetch().
  let doFetch = (typeof fetch !== 'undefined') ? fetch.bind(typeof window !== 'undefined' ? window : undefined) : null;

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

  function buildMutualUrl(userId) {
    return 'https://i.instagram.com/api/v1/friendships/' + userId + '/mutual_followers/';
  }

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

  // Score how likely a username belongs to a real person (higher = more likely).
  // Brands/bots tend to have: no full_name, lots of digits/underscores,
  // keywords like "official", "shop", "store", "news", "daily", "memes".
  function realPersonScore(u) {
    let score = 0;
    const name = u.username.toLowerCase();
    const fullName = (u.full_name || '').toLowerCase();
    // Private accounts are the strongest real-person signal
    if (u.is_private) score += 4;
    // Full name with first + last (space) is a good sign
    if (u.full_name && u.full_name.includes(' ')) score += 2;
    // Has any full name
    if (u.full_name && u.full_name.trim().length > 0) score += 1;
    // Verified accounts are almost always pages/brands/celebs
    if (u.is_verified) score -= 6;
    // Brand/bot/page patterns in username — strong penalty
    if (/official|shop|store|brand|news|daily|memes|clips|repost|fanpage|promo|music|radio|podcast|media|studio|records|magazine|blog|tv|hq|worldwide|global|network|entertainment|production/.test(name)) score -= 5;
    // Brand/page patterns in full name — strong penalty
    if (/music|records|studio|magazine|podcast|media|clothing|apparel|official|brand|inc\b|llc\b|co\b|entertainment|production|worldwide|gallery|collective|agency|management/.test(fullName)) score -= 5;
    // Username starts with digits — page/bot pattern
    if (/^\d/.test(name)) score -= 3;
    // Excessive digits
    const digitRatio = (name.match(/\d/g) || []).length / name.length;
    if (digitRatio > 0.3) score -= 3;
    // Excessive underscores
    if ((name.match(/_/g) || []).length >= 3) score -= 2;
    // Very short usernames are often brands
    if (name.length <= 3) score -= 1;
    return score;
  }

  // Sample non-followers, prioritizing real-looking people, and fetch mutual counts.
  async function fetchSampledMutualCounts(followerSet, following, sampleSize, onProgress) {
    const nonFollowers = [];
    for (const u of following) {
      if (!followerSet.has(u.username.toLowerCase())) {
        nonFollowers.push(u);
      }
    }
    // Sort by real-person score descending, then shuffle within score tiers
    // so we prioritize real people but still get variety
    nonFollowers.sort((a, b) => realPersonScore(b) - realPersonScore(a));
    // Take top candidates (2x sample size), then shuffle those for variety
    const candidates = nonFollowers.slice(0, Math.min(sampleSize * 2, nonFollowers.length));
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = candidates[i]; candidates[i] = candidates[j]; candidates[j] = tmp;
    }
    const sample = candidates.slice(0, Math.min(sampleSize, candidates.length));
    let done = 0;
    const total = sample.length;
    const countMap = new Map();
    for (const u of sample) {
      const pk = u.pk || u.userId || u.username;
      const count = await fetchMutualCount(pk);
      countMap.set(u.username.toLowerCase(), count);
      done++;
      if (onProgress) onProgress(done, total);
    }
    return countMap;
  }

  // Reduce IG's account shape to ours.
  function trimUser(u, mutualCount) {
    const obj = {
      username: u.username,
      full_name: u.full_name || '',
      is_private: !!u.is_private,
    };
    if (u.is_verified) obj.is_verified = true;
    if (typeof mutualCount === 'number') obj.mutual_count = mutualCount;
    return obj;
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

  // ─── Current user resolution + size check ────────────────────────

  async function getCurrentUser() {
    // Try _sharedData (works on legacy IG web pages).
    try {
      const sd = window._sharedData && window._sharedData.config && window._sharedData.config.viewer;
      if (sd && sd.id && sd.username) {
        return { userId: String(sd.id), username: sd.username };
      }
    } catch (e) { /* fall through */ }

    // Try ds_user_id cookie (set by Instagram on login, most reliable).
    let cookieUserId = null;
    try {
      const m = document.cookie.match(/(?:^|;\s*)ds_user_id=(\d+)/);
      if (m) cookieUserId = m[1];
    } catch (e) { /* fall through */ }

    // Try /api/v1/accounts/current_user/ endpoint.
    if (cookieUserId) {
      try {
        const r = await doFetch('https://i.instagram.com/api/v1/accounts/current_user/?edit=true', {
          credentials: 'include',
          headers: { 'X-IG-App-ID': IG_APP_ID, 'Accept': 'application/json' },
        });
        if (r.ok) {
          const j = await r.json();
          if (j && j.user && j.user.pk && j.user.username) {
            return { userId: String(j.user.pk), username: j.user.username };
          }
        }
      } catch (e) { /* fall through */ }
    }

    // Try the web accounts info endpoint.
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

    // Last resort: use cookie userId + fetch username from web_profile_info by
    // reading the current page's profile if we're on one.
    if (cookieUserId) {
      try {
        const r = await doFetch('https://i.instagram.com/api/v1/users/' + cookieUserId + '/info/', {
          credentials: 'include',
          headers: { 'X-IG-App-ID': IG_APP_ID, 'Accept': 'application/json' },
        });
        if (r.ok) {
          const j = await r.json();
          if (j && j.user && j.user.username) {
            return { userId: cookieUserId, username: j.user.username };
          }
        }
      } catch (e) { /* fall through */ }
    }

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
    // Outer wrapper with gradient border effect
    overlayEl = document.createElement('div');
    overlayEl.setAttribute('style', [
      'position:fixed','bottom:24px','right:24px','z-index:2147483647',
      'padding:2px','border-radius:18px',
      'background:linear-gradient(135deg,#f77737,#e1306c,#833ab4)',
      'box-shadow:0 12px 48px rgba(225,48,108,0.25),0 4px 12px rgba(131,58,180,0.15)',
      'font:600 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'min-width:260px','animation:fr-fadein 0.3s ease',
    ].join(';'));
    // Inner card
    const inner = document.createElement('div');
    inner.setAttribute('style', [
      'background:#fff','border-radius:16px','padding:16px 20px','color:#1a1a2e',
    ].join(';'));
    // Header row with radar icon + title
    const header = document.createElement('div');
    header.setAttribute('style', 'display:flex;align-items:center;gap:10px;margin-bottom:10px');
    const icon = document.createElement('div');
    icon.innerHTML = '<svg width="28" height="28" viewBox="0 0 32 32"><defs><linearGradient id="fr-bird-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#f77737"/><stop offset="50%" stop-color="#e1306c"/><stop offset="100%" stop-color="#833ab4"/></linearGradient></defs><path d="M26 7C26 7 29 4 27 3C25 2 22 5 19 8C16 5 13 2 11 3C9 4 12 7 12 7L8 11C6 13 5 16 6 19L3 22L5 24L8 21C11 23 15 23 18 21L22 17C24 15 25 12 24 9L26 7ZM15 18C13.5 18 12 16.5 12 15C12 13.5 13.5 12 15 12C16.5 12 18 13.5 18 15C18 16.5 16.5 18 15 18Z" fill="url(#fr-bird-g)"/></svg>';
    const title = document.createElement('div');
    title.setAttribute('style', 'font-weight:900;font-size:14px;letter-spacing:-0.01em');
    title.textContent = 'Flock';
    header.appendChild(icon);
    header.appendChild(title);
    inner.appendChild(header);
    // Status text
    overlayTextEl = document.createElement('div');
    overlayTextEl.textContent = 'Starting\u2026';
    overlayTextEl.setAttribute('style', 'margin-bottom:10px;font-size:12.5px;color:#555570');
    inner.appendChild(overlayTextEl);
    // Progress bar
    const track = document.createElement('div');
    track.setAttribute('style', 'height:6px;background:rgba(0,0,0,0.06);border-radius:3px;overflow:hidden');
    overlayBarEl = document.createElement('div');
    overlayBarEl.setAttribute('style', 'height:100%;width:0%;background:linear-gradient(90deg,#f77737,#e1306c,#833ab4);border-radius:3px;transition:width 0.4s cubic-bezier(0.16,1,0.3,1)');
    track.appendChild(overlayBarEl);
    inner.appendChild(track);
    overlayEl.appendChild(inner);
    // Inject keyframe animation
    const style = document.createElement('style');
    style.textContent = '@keyframes fr-fadein{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(style);
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

    const resume = existing;
    const initialFollowers = (resume && resume.partialFollowers) || null;
    const initialFollowing = (resume && resume.partialFollowing) || null;
    let initialCursor = (resume && resume.cursor) || null;
    let phase = (resume && resume.phase) || 'followers';

    // Size check (only on fresh runs, not on resume).
    if (!resume) {
      try {
        const sizes = await checkAccountSize(user.username);
        if (sizes.followers > MAX_ACCOUNT_SIZE || sizes.following > MAX_ACCOUNT_SIZE) {
          alert(
            "Flock is built for accounts under " + MAX_ACCOUNT_SIZE.toLocaleString() + " followers/following.\n\n" +
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

    // Phase 3: sample mutual follower counts for non-followers
    // Check 25 random non-followers to find the most connected ones quickly
    const followerSet = new Set(followers.map(u => u.username.toLowerCase()));
    let mutualCounts = new Map();
    try {
      updateOverlay('Checking mutual connections\u2026', 0.85);
      mutualCounts = await fetchSampledMutualCounts(followerSet, following, 25, (done, total) => {
        updateOverlay('Checking mutual connections\u2026 ' + done + '/' + total, 0.85 + 0.15 * (done / total));
      });
    } catch (e) {
      console.warn('[follow radar] mutual count fetch failed:', e);
    }

    destroyOverlay();
    clearResumeState();

    // Attach mutual_count to each following user
    const followingWithMutuals = following.map(u => {
      const mc = mutualCounts.get(u.username.toLowerCase()) || 0;
      return trimUser(u, mc);
    });

    const payload = {
      username: user.username,
      userId: user.userId,
      scrapedAt: new Date().toISOString(),
      followers: followers,
      following: followingWithMutuals,
    };
    try {
      await shipResults(payload);
    } catch (e) {
      alert("Could not redirect to Flock: " + e.message);
    }
  }

  // Expose for tests. In real bookmarklet runs, window.__followRadarTest is undefined.
  if (typeof window !== 'undefined' && window.__followRadarTest) {
    window.__followRadarTest.RateLimitError = RateLimitError;
    window.__followRadarTest.constants = {
      MAX_ACCOUNT_SIZE, THROTTLE_MS, THROTTLE_JITTER_MS, PAGE_SIZE,
      IG_APP_ID, RESUME_MAX_AGE_MS, FOLLOW_RADAR_URL, RESUME_KEY
    };
    window.__followRadarTest.encodePayload = encodePayload;
    window.__followRadarTest.decodePayload = decodePayload;
    window.__followRadarTest.saveResumeState = saveResumeState;
    window.__followRadarTest.loadResumeState = loadResumeState;
    window.__followRadarTest.clearResumeState = clearResumeState;
    window.__followRadarTest.classifyResponse = classifyResponse;
    window.__followRadarTest.fetchPage = fetchPage;
    window.__followRadarTest.setFetch = function (fn) { doFetch = fn; };
    window.__followRadarTest.buildFollowersUrl = buildFollowersUrl;
    window.__followRadarTest.buildFollowingUrl = buildFollowingUrl;
    window.__followRadarTest.buildMutualUrl = buildMutualUrl;
    window.__followRadarTest.fetchMutualCount = fetchMutualCount;
    window.__followRadarTest.fetchSampledMutualCounts = fetchSampledMutualCounts;
    window.__followRadarTest.trimUser = trimUser;
    window.__followRadarTest.scrapeFollowers = scrapeFollowers;
    window.__followRadarTest.scrapeFollowing = scrapeFollowing;
    window.__followRadarTest.setFetchPageImpl = function (fn) { fetchPageImpl = fn; };
    window.__followRadarTest.shipResults = shipResults;
    window.__followRadarTest.main = main;
    return; // skip main() in test mode
  }

  // Production entry point.
  main().catch(e => {
    console.error('[follow radar]', e);
    alert("Unexpected error: " + (e.message || e));
  });
})();
