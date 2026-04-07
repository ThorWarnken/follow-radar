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

// follow radar bookmarklet payload (b.js)
// Loaded fresh on every click via the loader stub above.
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

  // ─── Current user resolution + size check ────────────────────────

  async function getCurrentUser() {
    // Try _sharedData (works on legacy IG web pages).
    try {
      const sd = window._sharedData && window._sharedData.config && window._sharedData.config.viewer;
      if (sd && sd.id && sd.username) {
        return { userId: String(sd.id), username: sd.username };
      }
    } catch (e) { /* fall through */ }

    // Try the modern in-page accounts info endpoint.
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
