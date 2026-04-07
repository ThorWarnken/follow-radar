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
    return; // skip main() in test mode
  }

  // main() and the rest of the module are added in subsequent tasks.
})();
