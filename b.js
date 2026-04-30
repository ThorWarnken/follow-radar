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
  const BIRD_LOGO_URI = 'data:image/svg+xml;base64,' + 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMTIgMjc2Ij48cGF0aCBmaWxsPSIjODU4MGQ0IiBkPSJtMjI3LjkgMTQ2LS4yLTQuOC0uOC0zLjJxMC0xLS4yLTIuOWwtLjctMi4xYTYzIDYzIDAgMCAwLTM1LjQtNDMuOGMtNy4yLTMuNS0xNS4yLTUuNC0yMy04bC00LjYtMS4zYzYuNi0yMi40IDM3LjMtNDIgNjIuNS00MC0xIDEtMi4xIDEuNC00LjYgMi40IDIuNyAxLjcgNC4yIDMgNiAzLjcgMi43IDEgNS44IDEuMyA4LjUgMi4yIDQgMS41IDYuNC42IDYuOS00IDMuNiAyLjYgNy45IDQuNyAxMC44IDggNCA0LjMgOCA4IDE0IDkuMiAyIC40IDMuOSAxLjcgNi4zIDNsMi42IDEuNSA0IDQuNy02IDEuMnEtNC42IDEuMi04IDIuM2wtNy4yIDMuNmMtNy4zIDYuOS05IDE0LTUuOCAyMi4zYTIzMSAyMzEgMCAwIDAgNiAxN2wyIDkgMS4yIDUgLjQgNC44LjUgMi4yLS4yIDE5LTEgNi44LS4yIDIuMy0xLjkgNi43LS4zIDIuMi0uOCAxLjgtLjQgMi4yLTEuNiAzLjktNCAxMGExMDQgMTA0IDAgMCAxLTQ0LjEgNDUuMyA4NyA4NyAwIDAgMS03MS4zIDUuOXEtLjQtMS0uMy0xLjEgMTAtMS42IDIwLjUtMi44YzMuNSA2LjUgNy40IDggMTUuMyA2bC0yLjgtMTEuNGguNXExLjEtLjYgMS41LTFoLjVxMS0uNSAxLjQtMSAwIC4xLjMuMSAxLjItLjUgMS43LTFoLjNxMS4yLS41IDEuNy0xYTExMyAxMTMgMCAwIDAgMjkuNy0yNC45IDkyIDkyIDAgMCAwIDE4LjQtMzYuOWwuMy0yLjIuOC0yLjhjLjItMS45LjItMyAuMi00LjJsLjgtNS44cTAtNC42LS4yLThtMi40LTc5LjhjMi45IDIgNiAyLjIgNy44LS44IDEtMS41LjgtNS4yLS4yLTZhOCA4IDAgMCAwLTctLjljLTMgMS40LTMgNC40LS42IDcuNyIvPjxwYXRoIGZpbGw9IiM4NTgwZDQiIGQ9Ik0yNDIgNDRjLS4yIDQuOC0yLjUgNS43LTYuNiA0LjItMi43LTEtNS44LTEuMi04LjUtMi4yLTEuOC0uNi0zLjMtMi02LTMuNyAyLjUtMSAzLjYtMS40IDUtMi4ycTggMS41IDE2LjEgNE0xNjkuNiAyMzQuOGExMjMgMTIzIDAgMCAxIDMuMiAxMS4zYy03LjkgMi4xLTExLjguNi0xNC45LTZxNS42LTIuOSAxMS43LTUuM204LTRxLS4yLjYtMS40IDEuMS4yLS42IDEuNC0xbS0yIDFxLS4yLjYtMS40IDEuMS4yLS41IDEuNC0xbS0yIDFxMCAuNS0xIDEgMC0uNCAxLTFtLTIgMXEwIC40LTEgMSAwLS42IDEtMU0xMzYuOCAyNDIuOXEuMy4zLjIgMS0uOC0uMS0xLjYtLjUuNS0uMyAxLjQtLjUiLz48cGF0aCBmaWxsPSIjYjhiNWYwIiBkPSJNMjA5IDEzNC42Yy02LjQgMC0xMi44LS41LTE5LjItLjYtMSAwLTEuOSAyLTIuOCAzLjVxLTcuNi0xLjYtMTUuNy00LjJjMS01LjggNS41LTQuMiA5LjEtNCAzIC4yIDUuOCAxLjMgOC42IDEgMi4xLS4yIDQtMiA2LTIuOGw4LjktMy42cTIuOSA1IDUuMSAxMC43TTE4OSAxNzRsLjUtMS4zYzMuNSAyLjcgNS45LTEgOS4yLTEuNyAzLjkgNy44IDIuNyAxNS0yIDIyLjVxLTQuNy02LjItOC42LTEyek0xMTAuNSAxOTIuMmMtMSA4LjQgMy4yIDEyLjkgMTEuNiAxMS42IDEtLjEgMS44LTEuOCAzLTIuMiAxLjMtLjUgMi44LS40IDQuMi0uNi0uNSAxLjItLjkgMy4yLTEuNyAzLjQtMy45IDEtNS4zIDMuMy02LjMgNy4yLS42IDIuNC0zLjggNC01LjUgNi4ycS0xLjYgMi41LTIuOCA2YTIzMyAyMzMgMCAwIDEtMjMtMTEuNXExLjUtOS43IDMtMTYuOWw2LTMuM3ptNy4zLjNxLTEuOC41LTQuNi4zIDEuOC0uNSA0LjYtLjMiLz48cGF0aCBmaWxsPSIjYjhiNWYwIiBkPSJNMTE4LjIgMTkyLjZxMTIuNy0yLjUgMjUuNC00LjdjMTEuNi0xLjkgMjMtMiAzMy44IDMuOXE2LjkgMy44IDguMiAxMS4xYy4zIDEuNC0uOCAzLjYtMiA0LjUtMjAuNSAxNy4zLTQzLjYgMjQuMS03MC4zIDE2LjZxLjgtMy44IDIuNS02LjJjMS43LTIuMiA1LTMuOCA1LjUtNi4yIDEtMy45IDIuNC02LjIgNi4zLTcuMi44LS4yIDEuMi0yLjIgMS43LTMuNC0xLjQuMi0zIDAtNC4yLjYtMS4yLjQtMiAyLTMgMi4yLTguNCAxLjMtMTIuNy0zLjItMTEuMS0xMS41cS42LS4xIDIgLjRjMiAuMyAzLjYgMCA1LjItLjFNOTQgMTM4YzEwLjcgMiAyMS40IDQuNiAzMi4yIDYgMTEuNiAxLjUgMjMuMyAxLjkgMzUgMi44cTYuMS42IDEyLjUgMmMtMS41IDMuNC0uMSA1LjMgMi4zIDYgMi42LjYgNS40LjQgNi4xLTMuMiAzLjcgMi44IDcuMyA1LjUgMTAuOSA5LTIuMSAzLjMtNC41IDYuMi0xLjMgOS4zIDMuMSAzIDMuOS0xLjUgNS44LTIuMnEuOCAxLjQgMS4xIDNjLTMuMiAxLTUuNiA0LjctOS4xIDJxLS4yLjYtLjggMS40bC01LjcgNGMtMTUtNy41LTMwLjQtNC42LTQ2LTIuNy0xNi43IDItMzMuMyAxLjItNDkuNy00LjVxLjctMy4zIDEuNi01LjYgMi4zLTcuMiA0LjEtMTQuNC44LTMuMy45LTYuN3pNMTE5IDg2LjhxMTkuMiA0LjggMzguMiA5LjljOS4yIDIuNSAxOC42IDQuOSAyNy41IDguNSA4LjUgMy40IDE0LjggMTAgMTkuMSAxOC40cS00LjcgMi4xLTguNyAzLjljLTIgLjktNCAyLjYtNiAyLjgtMi45LjMtNS44LS44LTguNy0xLTMuNi0uMi04LTEuOC05LjQgMy44cS0yLjYtLjItNS43LTEuMS0zLTQuMi00LjMgMC0xLjYgMC0zLjctLjljLS41LTQuMi0yLjgtNC44LTYuMy00LjdsMS4xIDVxLTEyLjctLjgtMjUuNi0yLjQgNi00LjQgMTEuNy03LjhjLTQuNi05LjEtMTUuMi02LjQtMjEuOC0xMi42IDUuNy0xLjIgOC00IDUtOC40LTIuOS00LjMtMi40LTguOC0yLjQtMTMuNG0zMy40IDE1LjQtMS42LTUtMS4zLS41Yy0uOCAyLjEtMi4zIDQuNC0yIDYuNC4yIDEuMiAzLjEgMiA1IDIuOC41LjIgMS41LS44IDIuMy0xLjJxLS43LTEtMi40LTIuNW03LjktLjEgMS41LS4yLS40LTEuM3EtLjYuMy0xLjEgMS41TTIwOSAxMzVhNDEgNDEgMCAwIDEgMSAyNyA1NiA1NiAwIDAgMC0yMi44LTI0LjJjLjctMS44IDEuNy0zLjggMi42LTMuOHE5LjYuMyAxOS4yIDEiLz48cGF0aCBmaWxsPSIjYjhiNWYwIiBkPSJNMTE4LjggODYuNmMuMiA0LjgtLjMgOS4zIDIuNiAxMy42IDMgNC4zLjcgNy4yLTUgOC40IDYuNiA2LjIgMTcuMiAzLjUgMjEuOCAxMi42bC0xMiA3LjVhNjY2IDY2NiAwIDAgMS00MC0xMC44cS0uMS0yLjIuNC0zLjQgMy01IDUuNy0xMGMyLjYtNS4xIDQuMy0xMC43IDcuNi0xNS4zIDEuOS0yLjYgNC45LTQuMyA0LjEtOC4yem0zMy43IDQ0LjlxLS45LTIuMy0xLjUtNWMzLjUtLjIgNS44LjQgNiA0LjVhMTQgMTQgMCAwIDEtNC41LjVtOC45LjdxLjgtNC40IDMuNi0uNGE5IDkgMCAwIDEtMy42LjRtLTguNy0yOS45cTEuNCAxLjQgMiAyLjRjLS43LjQtMS43IDEuNC0yLjIgMS4yLTEuOS0uNy00LjgtMS42LTUtMi44LS4zLTIgMS4yLTQuMyAyLTYuNGwxLjMuNXEuNyAyLjUgMiA1LjFtNy41LS41cS42LS44IDEuMi0xLjJsLjQgMS4zcS0uNy4xLTEuNi0uMU05My42IDEzOHEuNSAzIC4zIDYuMnQtLjkgNi43cS0xLjggNy4yLTQgMTQuNGwtMiA1LjRhNTMgNTMgMCAwIDEtMjUuOS0xMy42cS42LTMuOCAyLTYuNSA1LTkuNSAxMC0xOC45eiIvPjxwYXRoIGZpbGw9IiNiOGI1ZjAiIGQ9Ik0xMDMuNiA4MWMxLjIgNC0xLjggNS42LTMuNyA4LjItMy4zIDQuNi01IDEwLjItNy42IDE1LjJxLTIuNyA1LjEtNS43IDEwLS40IDEuNC0uNiAzLjMtMTIuMi02LTI0LjgtMTMuNiAxLjktNS42IDQuNC0xMC4zbDguNS0xNS41cTIuNy00LjggNS05LjZMOTguNyA3OXEyIC45IDUgMS44TTE5Ny40IDE2Ny40Yy0xLjggMS0yLjYgNS42LTUuNyAyLjUtMy4yLTMuMS0uOC02IDEuNC05cTIuMiAyLjcgNC4zIDYuNW0tOC43IDYuN3EwIDMuMy0uOCA3LTIuNi0xLjItNC43LTIuOCAyLjQtMi4yIDUuNS00LjJNMTgxLjkgMTUxLjNjLS41IDMuOS0zLjMgNC4xLTUuOSAzLjQtMi40LS42LTMuOC0yLjUtMi01LjZxMy45LjcgNy45IDIuMk05OC42IDE5MnEtMS44IDEuNC01LjcgMy40LTEuNCA3LjItMyAxNi43Yy0xMC02LjEtMTcuMS0xNS0yMy0yNS45eiIvPjxwYXRoIGZpbGw9IiNiOGI1ZjAiIGQ9Ik03OSA2OC40YTExMSAxMTEgMCAwIDEtNC45IDkuOWwtOC41IDE1LjVxLTIuNCA0LjgtNC42IDEwLTguNS03LjQtMTctMTYuNmMtMS42LTUgLjktOC4zIDMtMTEuNmwxMy4xLTE5Ljl6TTczIDEzMS40cS01IDkuOC0xMCAxOS4yYy0xIDEuOC0xLjQgMy45LTIgNi4ycS02LjUtNi0xMy0xMy43YzEtNi4yIDItMTEuNiAzLjQtMTcuMXEyLTEuNSAzLjYtMy4xIDkgNCAxOCA4LjVNNTMuNSA1MC41QzQ1IDUzLjUgNDEgNjAuNSAzOCA2OC4zcS0uNyAxLjgtMiAzLjdhMjcgMjcgMCAwIDEtMy03LjdjMS4xLTQuOCAzLjItOS4xIDIuNi0xMy4xLS44LTUuOCAxLjUtOS44IDQuMi0xNC4xcTYuNyA2LjQgMTMuNiAxMy40Ii8+PHBhdGggZmlsbD0iI2I4YjVmMCIgZD0ibTUxIDEyNi0zIDE2LjhhNjEgNjEgMCAwIDEtMTMtMzAuOWwxLS45cTUuOSAzLjYgMTEuOCA4ek02MCA1NS40cS02LjQgMTAuMy0xMyAyMC4yYy0yLjEgMy4zLTQuNiA2LjYtMyAxMS4zcS00LjItNi42LTgtMTQuNSAxLjQtMi40IDIuMS00LjFjMy03LjggNi45LTE0LjcgMTUuNS0xNy40ek0zOS44IDM2LjhjLTIuNiA0LjYtNSA4LjYtNC4xIDE0LjQuNiA0LTEuNSA4LjMtMi43IDEyLjdBNzEgNzEgMCAwIDEgMzEuNiAyOHoiLz48cGF0aCBmaWxsPSIjYjhiNWYwIiBkPSJNNTEuNCAxMjZxLTItMy0zLjQtNi43IDMuMyAxLjIgNi44IDMuMy0xLjMgMS44LTMuNCAzLjRNMjI3LjUgMTQ2cS43IDMuNi42IDcuNy0uNy0zLjYtLjYtNy42bS0uNSAxNHEuNCAxLjUgMCAzLjctLjMtMS42IDAtMy43bS0uMy0yMS44cS43IDEgLjkgMi42YTUgNSAwIDAgMS0xLTIuNk0yMjYgMTY3cS4yLjcgMCAxLjgtLjUtLjcgMC0xLjhtLS4zLTMzLjlxLjYuNi43IDEuNy0uNi0uNi0uNy0xLjdNMjMwIDY2Yy0yLTMtMi4xLTYgMS03LjQgMS45LS44IDUuMS0uMyA2LjkgMSAxIC43IDEuMSA0LjQuMiA2LTEuOSAzLTUgMi43LTggLjRNMjUzLjQgMTAwcS01LjQtMTIuMiA1LjMtMjJjLS4zIDItMS4xIDMuOS0xLjUgNS45LS43IDQtMSA4LTEuOCAxMmExMSAxMSAwIDAgMS0yIDRtNS45IDE2LjlhMTA2IDEwNiAwIDAgMS00LjQtMTEuNXEuNy0uNSAxLjUtLjNjLjUuMyAxLjMuNyAxLjMgMS4ycTEuMSA1LjIgMS42IDEwLjZtLTYuMiA3NnExLjMtNC42IDMuNi05LjcgMy42IDIuNS4yIDUuNGMtMS40IDEuMS0yLjMgMi45LTMuOCA0LjRtMTMuMi0xMTguNXEzLjEtMS41IDcuMy0yLjVjLS43IDQuOC00LjIgMi44LTcuMyAyLjVtLTMuOCA1Ni40cS0xLTEuOS0xLjMtNC41IDEuOC4xIDMuNi45em0tMy45IDQ4LjJxLS40LS43LjItMS44bDEuOC42cS0uOC42LTIgMS4ybTEuMS00cS0uMy0uNy4yLTEuOC4zLjctLjIgMS44bTIuMi05cS0uMy0uNyAwLTEuOC4zLjYgMCAxLjhtMS4yLTlxLS4zLS43LS4yLTEuOC40LjYuMiAxLjdtLjItMTkuMXEtLjYtLjYtLjUtMS43LjUuNi41IDEuN00yNzYgNjUuNnEtMS0uMS0yLjMtMS4xIDEgMCAyLjMgMSIvPjwvc3ZnPg==';

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
    // Inject animations
    const style = document.createElement('style');
    style.textContent = [
      '@keyframes fr-in{from{opacity:0;transform:translateY(12px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}',
      '@keyframes fr-spin{to{transform:rotate(360deg)}}',
      '@keyframes fr-dots{0%,80%,100%{opacity:.25}40%{opacity:1}}',
      '@keyframes fr-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}',
    ].join('');
    document.head.appendChild(style);

    // Outer container
    overlayEl = document.createElement('div');
    overlayEl.setAttribute('style', [
      'position:fixed','bottom:20px','right:20px','z-index:2147483647',
      'width:260px','border-radius:14px',
      'background:rgba(12,14,36,0.92)',
      'backdrop-filter:blur(16px)','-webkit-backdrop-filter:blur(16px)',
      'border:1px solid rgba(99,102,241,0.2)',
      'box-shadow:0 4px 24px rgba(0,0,0,0.5),0 0 0 1px rgba(99,102,241,0.08)',
      'font:500 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'color:#fff','overflow:hidden',
      'animation:fr-in 0.35s cubic-bezier(0.16,1,0.3,1)',
    ].join(';'));

    // Content area
    const content = document.createElement('div');
    content.setAttribute('style', 'padding:14px 16px 12px');

    // Top row: spinner + title + live badge
    const topRow = document.createElement('div');
    topRow.setAttribute('style', 'display:flex;align-items:center;gap:10px;margin-bottom:10px');

    // Spinning ring
    const spinner = document.createElement('div');
    spinner.setAttribute('style', [
      'width:28px','height:28px','border-radius:50%','flex-shrink:0',
      'border:2.5px solid rgba(99,102,241,0.15)',
      'border-top-color:#6366F1','border-right-color:#A855F7',
      'animation:fr-spin 1s linear infinite',
    ].join(';'));

    // Title column
    const titleCol = document.createElement('div');
    titleCol.setAttribute('style', 'flex:1;min-width:0');
    const title = document.createElement('div');
    title.setAttribute('style', 'font-weight:700;font-size:13px;letter-spacing:0.02em;color:#fff');
    title.textContent = 'Flock';
    const subtitle = document.createElement('div');
    subtitle.setAttribute('style', 'font-size:10px;color:rgba(255,255,255,0.4);margin-top:1px;text-transform:uppercase;letter-spacing:0.06em');
    subtitle.textContent = 'Scanning';
    titleCol.appendChild(title);
    titleCol.appendChild(subtitle);

    // Live badge with animated dots
    const badge = document.createElement('div');
    badge.setAttribute('style', [
      'display:flex','align-items:center','gap:3px',
      'padding:3px 8px','border-radius:20px',
      'background:rgba(99,102,241,0.12)',
      'flex-shrink:0',
    ].join(';'));
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('div');
      d.setAttribute('style', [
        'width:4px','height:4px','border-radius:50%',
        'background:#6366F1',
        'animation:fr-dots 1.2s ease-in-out ' + (i * 0.15) + 's infinite',
      ].join(';'));
      badge.appendChild(d);
    }

    topRow.appendChild(spinner);
    topRow.appendChild(titleCol);
    topRow.appendChild(badge);
    content.appendChild(topRow);

    // Status text
    overlayTextEl = document.createElement('div');
    overlayTextEl.textContent = 'Starting\u2026';
    overlayTextEl.setAttribute('style', 'font-size:12px;color:rgba(255,255,255,0.65);font-variant-numeric:tabular-nums;margin-bottom:12px');
    content.appendChild(overlayTextEl);

    // Progress bar track
    const track = document.createElement('div');
    track.setAttribute('style', 'height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden');
    overlayBarEl = document.createElement('div');
    overlayBarEl.setAttribute('style', [
      'height:100%','width:0%','border-radius:2px',
      'background:linear-gradient(90deg,#6366F1,#A855F7,#D946EF)',
      'background-size:200% 100%',
      'animation:fr-shimmer 2s linear infinite',
      'transition:width 0.4s cubic-bezier(0.16,1,0.3,1)',
    ].join(';'));
    track.appendChild(overlayBarEl);
    content.appendChild(track);

    overlayEl.appendChild(content);

    // Bottom accent line
    const accent = document.createElement('div');
    accent.setAttribute('style', [
      'height:2px',
      'background:linear-gradient(90deg,#6366F1,#A855F7,#D946EF,#6366F1)',
      'background-size:200% 100%',
      'animation:fr-shimmer 3s linear infinite',
    ].join(';'));
    overlayEl.appendChild(accent);

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
