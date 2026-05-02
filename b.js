// ═══════════════════════════════════════════════════════════════════
// LOADER STUB (this is the bookmarklet href in index.html, not part of b.js):
//
// javascript:(()=>{if(!/(^|\.)instagram\.com$/.test(location.hostname)){alert('Open instagram.com first, then click this bookmarklet.');return}fetch('https://flockscan.org/b.js?v='+Date.now()).then(r=>r.text()).then(eval).catch(e=>alert('Could not load follow radar: '+e.message))})()
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
  const SCAN_CAP = 5000;
  const THROTTLE_MS = 3000;
  const THROTTLE_JITTER_MS = 2000;
  const PAGE_SIZE = 20;
  const IG_APP_ID = '936619743392459';
  const RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days between scans
  const COOLDOWN_KEY = 'flock:last-scan';
  const FOLLOW_RADAR_URL = 'https://flockscan.org';
  const RESUME_KEY = 'follow-radar:resume';
  const BIRD_LOGO_URI = 'data:image/svg+xml;base64,' + 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMTIgMjc2Ij48cGF0aCBmaWxsPSIjODU4MGQ0IiBkPSJtMjI3LjkgMTQ2LS4yLTQuOC0uOC0zLjJxMC0xLS4yLTIuOWwtLjctMi4xYTYzIDYzIDAgMCAwLTM1LjQtNDMuOGMtNy4yLTMuNS0xNS4yLTUuNC0yMy04bC00LjYtMS4zYzYuNi0yMi40IDM3LjMtNDIgNjIuNS00MC0xIDEtMi4xIDEuNC00LjYgMi40IDIuNyAxLjcgNC4yIDMgNiAzLjcgMi43IDEgNS44IDEuMyA4LjUgMi4yIDQgMS41IDYuNC42IDYuOS00IDMuNiAyLjYgNy45IDQuNyAxMC44IDggNCA0LjMgOCA4IDE0IDkuMiAyIC40IDMuOSAxLjcgNi4zIDNsMi42IDEuNSA0IDQuNy02IDEuMnEtNC42IDEuMi04IDIuM2wtNy4yIDMuNmMtNy4zIDYuOS05IDE0LTUuOCAyMi4zYTIzMSAyMzEgMCAwIDAgNiAxN2wyIDkgMS4yIDUgLjQgNC44LjUgMi4yLS4yIDE5LTEgNi44LS4yIDIuMy0xLjkgNi43LS4zIDIuMi0uOCAxLjgtLjQgMi4yLTEuNiAzLjktNCAxMGExMDQgMTA0IDAgMCAxLTQ0LjEgNDUuMyA4NyA4NyAwIDAgMS03MS4zIDUuOXEtLjQtMS0uMy0xLjEgMTAtMS42IDIwLjUtMi44YzMuNSA2LjUgNy40IDggMTUuMyA2bC0yLjgtMTEuNGguNXExLjEtLjYgMS41LTFoLjVxMS0uNSAxLjQtMSAwIC4xLjMuMSAxLjItLjUgMS43LTFoLjNxMS4yLS41IDEuNy0xYTExMyAxMTMgMCAwIDAgMjkuNy0yNC45IDkyIDkyIDAgMCAwIDE4LjQtMzYuOWwuMy0yLjIuOC0yLjhjLjItMS45LjItMyAuMi00LjJsLjgtNS44cTAtNC42LS4yLThtMi40LTc5LjhjMi45IDIgNiAyLjIgNy44LS44IDEtMS41LjgtNS4yLS4yLTZhOCA4IDAgMCAwLTctLjljLTMgMS40LTMgNC40LS42IDcuNyIvPjxwYXRoIGZpbGw9IiM4NTgwZDQiIGQ9Ik0yNDIgNDRjLS4yIDQuOC0yLjUgNS43LTYuNiA0LjItMi43LTEtNS44LTEuMi04LjUtMi4yLTEuOC0uNi0zLjMtMi02LTMuNyAyLjUtMSAzLjYtMS40IDUtMi4ycTggMS41IDE2LjEgNE0xNjkuNiAyMzQuOGExMjMgMTIzIDAgMCAxIDMuMiAxMS4zYy03LjkgMi4xLTExLjguNi0xNC45LTZxNS42LTIuOSAxMS43LTUuM204LTRxLS4yLjYtMS40IDEuMS4yLS42IDEuNC0xbS0yIDFxLS4yLjYtMS40IDEuMS4yLS41IDEuNC0xbS0yIDFxMCAuNS0xIDEgMC0uNCAxLTFtLTIgMXEwIC40LTEgMSAwLS42IDEtMU0xMzYuOCAyNDIuOXEuMy4zLjIgMS0uOC0uMS0xLjYtLjUuNS0uMyAxLjQtLjUiLz48cGF0aCBmaWxsPSIjYjhiNWYwIiBkPSJNMjA5IDEzNC42Yy02LjQgMC0xMi44LS41LTE5LjItLjYtMSAwLTEuOSAyLTIuOCAzLjVxLTcuNi0xLjYtMTUuNy00LjJjMS01LjggNS41LTQuMiA5LjEtNCAzIC4yIDUuOCAxLjMgOC42IDEgMi4xLS4yIDQtMiA2LTIuOGw4LjktMy42cTIuOSA1IDUuMSAxMC43TTE4OSAxNzRsLjUtMS4zYzMuNSAyLjcgNS45LTEgOS4yLTEuNyAzLjkgNy44IDIuNyAxNS0yIDIyLjVxLTQuNy02LjItOC42LTEyek0xMTAuNSAxOTIuMmMtMSA4LjQgMy4yIDEyLjkgMTEuNiAxMS42IDEtLjEgMS44LTEuOCAzLTIuMiAxLjMtLjUgMi44LS40IDQuMi0uNi0uNSAxLjItLjkgMy4yLTEuNyAzLjQtMy45IDEtNS4zIDMuMy02LjMgNy4yLS42IDIuNC0zLjggNC01LjUgNi4ycS0xLjYgMi41LTIuOCA2YTIzMyAyMzMgMCAwIDEtMjMtMTEuNXExLjUtOS43IDMtMTYuOWw2LTMuM3ptNy4zLjNxLTEuOC41LTQuNi4zIDEuOC0uNSA0LjYtLjMiLz48cGF0aCBmaWxsPSIjYjhiNWYwIiBkPSJNMTE4LjIgMTkyLjZxMTIuNy0yLjUgMjUuNC00LjdjMTEuNi0xLjkgMjMtMiAzMy44IDMuOXE2LjkgMy44IDguMiAxMS4xYy4zIDEuNC0uOCAzLjYtMiA0LjUtMjAuNSAxNy4zLTQzLjYgMjQuMS03MC4zIDE2LjZxLjgtMy44IDIuNS02LjJjMS43LTIuMiA1LTMuOCA1LjUtNi4yIDEtMy45IDIuNC02LjIgNi4zLTcuMi44LS4yIDEuMi0yLjIgMS43LTMuNC0xLjQuMi0zIDAtNC4yLjYtMS4yLjQtMiAyLTMgMi4yLTguNCAxLjMtMTIuNy0zLjItMTEuMS0xMS41cS42LS4xIDIgLjRjMiAuMyAzLjYgMCA1LjItLjFNOTQgMTM4YzEwLjcgMiAyMS40IDQuNiAzMi4yIDYgMTEuNiAxLjUgMjMuMyAxLjkgMzUgMi44cTYuMS42IDEyLjUgMmMtMS41IDMuNC0uMSA1LjMgMi4zIDYgMi42LjYgNS40LjQgNi4xLTMuMiAzLjcgMi44IDcuMyA1LjUgMTAuOSA5LTIuMSAzLjMtNC41IDYuMi0xLjMgOS4zIDMuMSAzIDMuOS0xLjUgNS44LTIuMnEuOCAxLjQgMS4xIDNjLTMuMiAxLTUuNiA0LjctOS4xIDJxLS4yLjYtLjggMS40bC01LjcgNGMtMTUtNy41LTMwLjQtNC42LTQ2LTIuNy0xNi43IDItMzMuMyAxLjItNDkuNy00LjVxLjctMy4zIDEuNi01LjYgMi4zLTcuMiA0LjEtMTQuNC44LTMuMy45LTYuN3pNMTE5IDg2LjhxMTkuMiA0LjggMzguMiA5LjljOS4yIDIuNSAxOC42IDQuOSAyNy41IDguNSA4LjUgMy40IDE0LjggMTAgMTkuMSAxOC40cS00LjcgMi4xLTguNyAzLjljLTIgLjktNCAyLjYtNiAyLjgtMi45LjMtNS44LS44LTguNy0xLTMuNi0uMi04LTEuOC05LjQgMy44cS0yLjYtLjItNS43LTEuMS0zLTQuMi00LjMgMC0xLjYgMC0zLjctLjljLS41LTQuMi0yLjgtNC44LTYuMy00LjdsMS4xIDVxLTEyLjctLjgtMjUuNi0yLjQgNi00LjQgMTEuNy03LjhjLTQuNi05LjEtMTUuMi02LjQtMjEuOC0xMi42IDUuNy0xLjIgOC00IDUtOC40LTIuOS00LjMtMi40LTguOC0yLjQtMTMuNG0zMy40IDE1LjQtMS42LTUtMS4zLS41Yy0uOCAyLjEtMi4zIDQuNC0yIDYuNC4yIDEuMiAzLjEgMiA1IDIuOC41LjIgMS41LS44IDIuMy0xLjJxLS43LTEtMi40LTIuNW03LjktLjEgMS41LS4yLS40LTEuM3EtLjYuMy0xLjEgMS41TTIwOSAxMzVhNDEgNDEgMCAwIDEgMSAyNyA1NiA1NiAwIDAgMC0yMi44LTI0LjJjLjctMS44IDEuNy0zLjggMi42LTMuOHE5LjYuMyAxOS4yIDEiLz48cGF0aCBmaWxsPSIjYjhiNWYwIiBkPSJNMTE4LjggODYuNmMuMiA0LjgtLjMgOS4zIDIuNiAxMy42IDMgNC4zLjcgNy4yLTUgOC40IDYuNiA2LjIgMTcuMiAzLjUgMjEuOCAxMi42bC0xMiA3LjVhNjY2IDY2NiAwIDAgMS00MC0xMC44cS0uMS0yLjIuNC0zLjQgMy01IDUuNy0xMGMyLjYtNS4xIDQuMy0xMC43IDcuNi0xNS4zIDEuOS0yLjYgNC45LTQuMyA0LjEtOC4yem0zMy43IDQ0LjlxLS45LTIuMy0xLjUtNWMzLjUtLjIgNS44LjQgNiA0LjVhMTQgMTQgMCAwIDEtNC41LjVtOC45LjdxLjgtNC40IDMuNi0uNGE5IDkgMCAwIDEtMy42LjRtLTguNy0yOS45cTEuNCAxLjQgMiAyLjRjLS43LjQtMS43IDEuNC0yLjIgMS4yLTEuOS0uNy00LjgtMS42LTUtMi44LS4zLTIgMS4yLTQuMyAyLTYuNGwxLjMuNXEuNyAyLjUgMiA1LjFtNy41LS41cS42LS44IDEuMi0xLjJsLjQgMS4zcS0uNy4xLTEuNi0uMU05My42IDEzOHEuNSAzIC4zIDYuMnQtLjkgNi43cS0xLjggNy4yLTQgMTQuNGwtMiA1LjRhNTMgNTMgMCAwIDEtMjUuOS0xMy42cS42LTMuOCAyLTYuNSA1LTkuNSAxMC0xOC45eiIvPjxwYXRoIGZpbGw9IiNiOGI1ZjAiIGQ9Ik0xMDMuNiA4MWMxLjIgNC0xLjggNS42LTMuNyA4LjItMy4zIDQuNi01IDEwLjItNy42IDE1LjJxLTIuNyA1LjEtNS43IDEwLS40IDEuNC0uNiAzLjMtMTIuMi02LTI0LjgtMTMuNiAxLjktNS42IDQuNC0xMC4zbDguNS0xNS41cTIuNy00LjggNS05LjZMOTguNyA3OXEyIC45IDUgMS44TTE5Ny40IDE2Ny40Yy0xLjggMS0yLjYgNS42LTUuNyAyLjUtMy4yLTMuMS0uOC02IDEuNC05cTIuMiAyLjcgNC4zIDYuNW0tOC43IDYuN3EwIDMuMy0uOCA3LTIuNi0xLjItNC43LTIuOCAyLjQtMi4yIDUuNS00LjJNMTgxLjkgMTUxLjNjLS41IDMuOS0zLjMgNC4xLTUuOSAzLjQtMi40LS42LTMuOC0yLjUtMi01LjZxMy45LjcgNy45IDIuMk05OC42IDE5MnEtMS44IDEuNC01LjcgMy40LTEuNCA3LjItMyAxNi43Yy0xMC02LjEtMTcuMS0xNS0yMy0yNS45eiIvPjxwYXRoIGZpbGw9IiNiOGI1ZjAiIGQ9Ik03OSA2OC40YTExMSAxMTEgMCAwIDEtNC45IDkuOWwtOC41IDE1LjVxLTIuNCA0LjgtNC42IDEwLTguNS03LjQtMTctMTYuNmMtMS42LTUgLjktOC4zIDMtMTEuNmwxMy4xLTE5Ljl6TTczIDEzMS40cS01IDkuOC0xMCAxOS4yYy0xIDEuOC0xLjQgMy45LTIgNi4ycS02LjUtNi0xMy0xMy43YzEtNi4yIDItMTEuNiAzLjQtMTcuMXEyLTEuNSAzLjYtMy4xIDkgNCAxOCA4LjVNNTMuNSA1MC41QzQ1IDUzLjUgNDEgNjAuNSAzOCA2OC4zcS0uNyAxLjgtMiAzLjdhMjcgMjcgMCAwIDEtMy03LjdjMS4xLTQuOCAzLjItOS4xIDIuNi0xMy4xLS44LTUuOCAxLjUtOS44IDQuMi0xNC4xcTYuNyA2LjQgMTMuNiAxMy40Ii8+PHBhdGggZmlsbD0iI2I4YjVmMCIgZD0ibTUxIDEyNi0zIDE2LjhhNjEgNjEgMCAwIDEtMTMtMzAuOWwxLS45cTUuOSAzLjYgMTEuOCA4ek02MCA1NS40cS02LjQgMTAuMy0xMyAyMC4yYy0yLjEgMy4zLTQuNiA2LjYtMyAxMS4zcS00LjItNi42LTgtMTQuNSAxLjQtMi40IDIuMS00LjFjMy03LjggNi45LTE0LjcgMTUuNS0xNy40ek0zOS44IDM2LjhjLTIuNiA0LjYtNSA4LjYtNC4xIDE0LjQuNiA0LTEuNSA4LjMtMi43IDEyLjdBNzEgNzEgMCAwIDEgMzEuNiAyOHoiLz48cGF0aCBmaWxsPSIjYjhiNWYwIiBkPSJNNTEuNCAxMjZxLTItMy0zLjQtNi43IDMuMyAxLjIgNi44IDMuMy0xLjMgMS44LTMuNCAzLjRNMjI3LjUgMTQ2cS43IDMuNi42IDcuNy0uNy0zLjYtLjYtNy42bS0uNSAxNHEuNCAxLjUgMCAzLjctLjMtMS42IDAtMy43bS0uMy0yMS44cS43IDEgLjkgMi42YTUgNSAwIDAgMS0xLTIuNk0yMjYgMTY3cS4yLjcgMCAxLjgtLjUtLjcgMC0xLjhtLS4zLTMzLjlxLjYuNi43IDEuNy0uNi0uNi0uNy0xLjdNMjMwIDY2Yy0yLTMtMi4xLTYgMS03LjQgMS45LS44IDUuMS0uMyA2LjkgMSAxIC43IDEuMSA0LjQuMiA2LTEuOSAzLTUgMi43LTggLjRNMjUzLjQgMTAwcS01LjQtMTIuMiA1LjMtMjJjLS4zIDItMS4xIDMuOS0xLjUgNS45LS43IDQtMSA4LTEuOCAxMmExMSAxMSAwIDAgMS0yIDRtNS45IDE2LjlhMTA2IDEwNiAwIDAgMS00LjQtMTEuNXEuNy0uNSAxLjUtLjNjLjUuMyAxLjMuNyAxLjMgMS4ycTEuMSA1LjIgMS42IDEwLjZtLTYuMiA3NnExLjMtNC42IDMuNi05LjcgMy42IDIuNS4yIDUuNGMtMS40IDEuMS0yLjMgMi45LTMuOCA0LjRtMTMuMi0xMTguNXEzLjEtMS41IDcuMy0yLjVjLS43IDQuOC00LjIgMi44LTcuMyAyLjVtLTMuOCA1Ni40cS0xLTEuOS0xLjMtNC41IDEuOC4xIDMuNi45em0tMy45IDQ4LjJxLS40LS43LjItMS44bDEuOC42cS0uOC42LTIgMS4ybTEuMS00cS0uMy0uNy4yLTEuOC4zLjctLjIgMS44bTIuMi05cS0uMy0uNyAwLTEuOC4zLjYgMCAxLjhtMS4yLTlxLS4zLS43LS4yLTEuOC40LjYuMiAxLjdtLjItMTkuMXEtLjYtLjYtLjUtMS43LjUuNi41IDEuN00yNzYgNjUuNnEtMS0uMS0yLjMtMS4xIDEgMCAyLjMgMSIvPjwvc3ZnPg==';

  const GOLD_LOGO_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDI0IDEwMjQiIHJvbGU9ImltZyIgYXJpYS1sYWJlbGxlZGJ5PSJ0aXRsZSBkZXNjIj4KICA8dGl0bGUgaWQ9InRpdGxlIj5GbG9jayBnb2xkIGJpcmQgZW1ibGVtPC90aXRsZT4KICA8ZGVzYyBpZD0iZGVzYyI+QSB3YXJtIGdvbGQgRmxvY2sgYmlyZCBsb2dvIGluc2lkZSBhIGdsb3dpbmcgYW1iZXIgcmluZyBvbiBhIGNsZWFuIGRhcmsgYnJvd24gYmFja2dyb3VuZC48L2Rlc2M+CiAgPGRlZnM+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9ImJnIiBjeD0iNTAlIiBjeT0iNTAlIiByPSI3MCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMmIxNTA3Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTglIiBzdG9wLWNvbG9yPSIjMTIwOTA2Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzA2MDMwMyIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KCiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InJpbmdHcmFkIiB4MT0iMTY4IiB5MT0iMTA4IiB4Mj0iODU2IiB5Mj0iOTE2IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNmZmYwN2EiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIyOCUiIHN0b3AtY29sb3I9IiNmZmQxMmIiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSI1OCUiIHN0b3AtY29sb3I9IiNmNmEyMGEiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZjZjRhIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgoKICAgIDxsaW5lYXJHcmFkaWVudCBpZD0id2luZ0dvbGQiIHgxPSIyMTAiIHkxPSIyNTAiIHgyPSI2NjAiIHkyPSI3NjAiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iI2ZmZjQ2NiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjM1JSIgc3RvcC1jb2xvcj0iI2ZmYzQwMCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjczJSIgc3RvcC1jb2xvcj0iI2U4ODkwMCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNiOTY3MDAiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJib2R5R29sZCIgeDE9IjU2NSIgeTE9IjI3NSIgeDI9Ijc5MCIgeTI9IjgwMCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmNmJmIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iNDglIiBzdG9wLWNvbG9yPSIjZmZkOTc0Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2YyYjQzMSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KCiAgICA8ZmlsdGVyIGlkPSJyaW5nR2xvdyIgeD0iLTMwJSIgeT0iLTMwJSIgd2lkdGg9IjE2MCUiIGhlaWdodD0iMTYwJSI+CiAgICAgIDxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjgiIHJlc3VsdD0iYmx1ciIvPgogICAgICA8ZmVDb2xvck1hdHJpeCBpbj0iYmx1ciIgdHlwZT0ibWF0cml4IiB2YWx1ZXM9IjEgMCAwIDAgMSAgMCAwLjY0IDAgMCAwLjQzICAwIDAgMC4wNSAwIDAgIDAgMCAwIDAuNzUgMCIgcmVzdWx0PSJnb2xkR2xvdyIvPgogICAgICA8ZmVNZXJnZT4KICAgICAgICA8ZmVNZXJnZU5vZGUgaW49ImdvbGRHbG93Ii8+CiAgICAgICAgPGZlTWVyZ2VOb2RlIGluPSJTb3VyY2VHcmFwaGljIi8+CiAgICAgIDwvZmVNZXJnZT4KICAgIDwvZmlsdGVyPgoKICAgIDxmaWx0ZXIgaWQ9InNvZnRMb2dvR2xvdyIgeD0iLTIwJSIgeT0iLTIwJSIgd2lkdGg9IjE0MCUiIGhlaWdodD0iMTQwJSI+CiAgICAgIDxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjMuNSIgcmVzdWx0PSJibHVyIi8+CiAgICAgIDxmZUNvbG9yTWF0cml4IGluPSJibHVyIiB0eXBlPSJtYXRyaXgiIHZhbHVlcz0iMSAwIDAgMCAxICAwIDAuNzIgMCAwIDAuNDYgIDAgMCAwLjEyIDAgMCAgMCAwIDAgMC40NSAwIiByZXN1bHQ9Indhcm0iLz4KICAgICAgPGZlTWVyZ2U+CiAgICAgICAgPGZlTWVyZ2VOb2RlIGluPSJ3YXJtIi8+CiAgICAgICAgPGZlTWVyZ2VOb2RlIGluPSJTb3VyY2VHcmFwaGljIi8+CiAgICAgIDwvZmVNZXJnZT4KICAgIDwvZmlsdGVyPgoKICAgIDxmaWx0ZXIgaWQ9ImlubmVyU2hhZG93IiB4PSItMjAlIiB5PSItMjAlIiB3aWR0aD0iMTQwJSIgaGVpZ2h0PSIxNDAlIj4KICAgICAgPGZlRHJvcFNoYWRvdyBkeD0iMCIgZHk9IjIiIHN0ZERldmlhdGlvbj0iMiIgZmxvb2QtY29sb3I9IiM1YjI2MDAiIGZsb29kLW9wYWNpdHk9IjAuNDUiLz4KICAgIDwvZmlsdGVyPgogIDwvZGVmcz4KCiAgPHJlY3Qgd2lkdGg9IjEwMjQiIGhlaWdodD0iMTAyNCIgZmlsbD0idXJsKCNiZykiLz4KCiAgPGNpcmNsZSBjeD0iNTEyIiBjeT0iNTEyIiByPSI0NTQiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNyaW5nR3JhZCkiIHN0cm9rZS13aWR0aD0iMTEiIGZpbHRlcj0idXJsKCNyaW5nR2xvdykiLz4KICA8Y2lyY2xlIGN4PSI1MTIiIGN5PSI1MTIiIHI9IjQ0NSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZkMzVhIiBzdHJva2Utd2lkdGg9IjIiIG9wYWNpdHk9IjAuNiIvPgoKICA8ZyBmaWx0ZXI9InVybCgjc29mdExvZ29HbG93KSI+CiAgICA8IS0tIE1haW4gYmlyZCBib2R5IGFuZCBoZWFkIC0tPgogICAgPHBhdGggZD0iTTUzMCAzODIKICAgICAgICAgICAgIEM1NTIgMzI0IDYxMiAyODcgNjgzIDI4OQogICAgICAgICAgICAgQzczMyAyOTAgNzc1IDMxMSA3OTQgMzQ3CiAgICAgICAgICAgICBDODIzIDM0NiA4NTUgMzU3IDg3NiAzODIKICAgICAgICAgICAgIEM4NDMgMzc5IDgxMiAzOTEgNzk1IDQxNgogICAgICAgICAgICAgQzc4MCA0MzggNzc4IDQ2NyA3ODQgNDk3CiAgICAgICAgICAgICBDODAxIDU4MiA3ODEgNjk3IDcyNyA3NjcKICAgICAgICAgICAgIEM2ODQgODIzIDYxNiA4NDkgNTMwIDgzNQogICAgICAgICAgICAgQzU5NSA4MjcgNjMzIDc5MiA2NTUgNzM5CiAgICAgICAgICAgICBDNjgwIDY3OSA2ODIgNjA2IDY2MiA1NDcKICAgICAgICAgICAgIEM2NDUgNDk1IDYxMSA0NTcgNTY4IDQzMAogICAgICAgICAgICAgQzU1MyA0MjEgNTM3IDQxNCA1MTkgNDA5CiAgICAgICAgICAgICBDNTIzIDM5OSA1MjYgMzkwIDUzMCAzODIgWiIKICAgICAgICAgIGZpbGw9InVybCgjYm9keUdvbGQpIiBzdHJva2U9IiNmZmYzYjUiIHN0cm9rZS13aWR0aD0iMyIgZmlsdGVyPSJ1cmwoI2lubmVyU2hhZG93KSIvPgoKICAgIDwhLS0gVG9wIHdpbmcgLS0+CiAgICA8cGF0aCBkPSJNMjEyIDI1NQogICAgICAgICAgICAgQzI5NiAzNTYgNDEyIDQxNCA1NjMgNDQxCiAgICAgICAgICAgICBDNjIzIDQ1MiA2NjQgNDg0IDY3NSA1NDUKICAgICAgICAgICAgIEM2MjQgNTAzIDU1OCA1MDkgNDc2IDQ5NAogICAgICAgICAgICAgQzMzOCA0NjkgMjM5IDQwNSAyMTEgMzIyCiAgICAgICAgICAgICBDMjAyIDI5NSAyMDQgMjcyIDIxMiAyNTUgWiIKICAgICAgICAgIGZpbGw9InVybCgjd2luZ0dvbGQpIiBzdHJva2U9IiNmZmYxNzgiIHN0cm9rZS13aWR0aD0iMyIgZmlsdGVyPSJ1cmwoI2lubmVyU2hhZG93KSIvPgoKICAgIDwhLS0gTWlkZGxlIHdpbmcgLS0+CiAgICA8cGF0aCBkPSJNMjE2IDQ2NAogICAgICAgICAgICAgQzI5NiA1MzQgNDEwIDU3MCA1NTggNTY1CiAgICAgICAgICAgICBDNjEyIDU2MyA2NTQgNTkwIDY2NiA2NTEKICAgICAgICAgICAgIEM2MTIgNjExIDU1MSA2MjEgNDcwIDYyMAogICAgICAgICAgICAgQzM0MCA2MTkgMjUwIDU3NSAyMTkgNTExCiAgICAgICAgICAgICBDMjExIDQ5MyAyMTEgNDc2IDIxNiA0NjQgWiIKICAgICAgICAgIGZpbGw9InVybCgjd2luZ0dvbGQpIiBzdHJva2U9IiNmZmU2NjgiIHN0cm9rZS13aWR0aD0iMyIgZmlsdGVyPSJ1cmwoI2lubmVyU2hhZG93KSIvPgoKICAgIDwhLS0gTG93ZXIgd2luZyAtLT4KICAgIDxwYXRoIGQ9Ik0yODcgNjUxCiAgICAgICAgICAgICBDMzY4IDY5NiA0NTUgNzEyIDU0NCA2ODMKICAgICAgICAgICAgIEM1OTUgNjY2IDYzNyA2OTAgNjQxIDczMgogICAgICAgICAgICAgQzU4MyA3NjggNDk2IDc2NSA0MTMgNzQwCiAgICAgICAgICAgICBDMzUwIDcyMCAzMDUgNjg4IDI4NyA2NTEgWiIKICAgICAgICAgIGZpbGw9InVybCgjd2luZ0dvbGQpIiBzdHJva2U9IiNmZmQ2NTgiIHN0cm9rZS13aWR0aD0iMyIgZmlsdGVyPSJ1cmwoI2lubmVyU2hhZG93KSIvPgoKICAgIDwhLS0gRXllIGN1dG91dCAtLT4KICAgIDxjaXJjbGUgY3g9IjcwNCIgY3k9IjMzOCIgcj0iMTgiIGZpbGw9IiMwYzA3MDUiLz4KICAgIDxjaXJjbGUgY3g9IjcwNCIgY3k9IjMzOCIgcj0iMTkuNSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmNWM4IiBzdHJva2Utd2lkdGg9IjIiIG9wYWNpdHk9IjAuNTUiLz4KICA8L2c+Cjwvc3ZnPgo=';

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

  // ─── Scan cooldown ────────────────────────────────────────────────

  function checkCooldown(userId, storage) {
    const s = storage || localStorage;
    const raw = s.getItem(COOLDOWN_KEY);
    if (!raw) return null;
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return null; }
    if (!parsed || parsed.userId !== userId) return null;
    const elapsed = Date.now() - parsed.timestamp;
    if (elapsed >= COOLDOWN_MS) return null;
    const remaining = COOLDOWN_MS - elapsed;
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.ceil((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days > 0) return days + 'd ' + hours + 'h';
    return hours + 'h';
  }

  function saveCooldown(userId, storage) {
    const s = storage || localStorage;
    s.setItem(COOLDOWN_KEY, JSON.stringify({ userId: userId, timestamp: Date.now() }));
  }

  // ─── Warm-up requests ────────────────────────────────────────────
  // Make a few normal-looking requests before scanning to give the session
  // realistic browsing activity (profile load + feed fetch).

  async function warmUp(userId) {
    try {
      await doFetch('https://i.instagram.com/api/v1/users/' + userId + '/info/', {
        credentials: 'include',
        headers: igHeaders,
      });
    } catch (e) { /* non-critical */ }
    await throttle();
    try {
      await doFetch('https://i.instagram.com/api/v1/feed/timeline/?count=12', {
        credentials: 'include',
        headers: igHeaders,
      });
    } catch (e) { /* non-critical */ }
    await throttle();
  }

  // ─── DOM utilities ───────────────────────────────────────────────

  const SCROLL_PAUSE_MS = 2000;
  const SCROLL_SETTLE_MS = 500;

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function waitForEl(root, selector, timeout) {
    return new Promise(function (resolve, reject) {
      var deadline = Date.now() + (timeout || 10000);
      (function poll() {
        var el = root.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() > deadline) return reject(new Error('waitForEl timed out: ' + selector));
        setTimeout(poll, 200);
      })();
    });
  }

  function findByText(parent, text) {
    var lower = text.toLowerCase();
    var all = parent.querySelectorAll('a, span, div, button, h1, h2');
    for (var i = 0; i < all.length; i++) {
      if (all[i].textContent.toLowerCase().indexOf(lower) !== -1) return all[i];
    }
    return null;
  }

  var RESERVED_PATHS = /^\/(explore|reels|stories|p|direct|accounts|about|legal|developer|static|press|api|tags|locations|challenge)\b/;

  function extractUsernameFromHref(href) {
    var path = href.replace(/^https?:\/\/[^/]+/, '');
    if (RESERVED_PATHS.test(path)) return null;
    var m = path.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
    return m ? m[1] : null;
  }

  function parseMutualText(text) {
    if (!text || text.indexOf('Followed by') === -1) return 0;
    var othersMatch = text.match(/(\d+)\s*others?\s*$/i);
    var othersCount = othersMatch ? parseInt(othersMatch[1], 10) : 0;
    var afterFollowedBy = text.replace(/^.*?Followed by\s*/i, '');
    var withoutOthers = afterFollowedBy.replace(/\s*and\s*\d+\s*others?\s*$/i, '').replace(/\s*,?\s*\d+\s*others?\s*$/i, '');
    var names = withoutOthers.split(/\s*,\s*|\s+and\s+/).filter(function (s) { return s.trim().length > 0; });
    return names.length + othersCount;
  }

  // ─── Popup management ───────────────────────────────────────────

  var scanPopup = null;

  function openScanPopup(username) {
    var w = 420, h = 720;
    var left = window.screen.availWidth - w - 40;
    var top = 60;
    var features = 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top +
                   ',resizable=yes,scrollbars=yes';
    scanPopup = window.open(
      'https://www.instagram.com/' + encodeURIComponent(username) + '/',
      'flock-scan',
      features
    );
    return scanPopup;
  }

  function closeScanPopup() {
    if (scanPopup && !scanPopup.closed) scanPopup.close();
    scanPopup = null;
  }

  async function waitForProfileRender(popup, timeout) {
    var deadline = Date.now() + (timeout || 20000);
    while (Date.now() < deadline) {
      if (popup.closed) throw new Error('Popup was closed before profile loaded.');
      try {
        var doc = popup.document;
        var links = doc.querySelectorAll('a[href*="/followers"]');
        if (links.length > 0) return;
      } catch (e) {
        // Cross-origin or not-ready — keep polling
      }
      await sleep(500);
    }
    throw new Error('Profile did not load in time. Check your connection and try again.');
  }

  // Parse "1,234" or "12.5K" or "1.2M" to a number
  function parseCountText(s) {
    s = s.replace(/,/g, '').trim();
    if (/[Kk]$/.test(s)) return Math.round(parseFloat(s) * 1000);
    if (/[Mm]$/.test(s)) return Math.round(parseFloat(s) * 1000000);
    return parseInt(s, 10) || 0;
  }

  function readAccountSize(popup) {
    var doc = popup.document;
    var followers = 0, following = 0;

    var allLinks = doc.querySelectorAll('a[href]');
    for (var i = 0; i < allLinks.length; i++) {
      var href = allLinks[i].getAttribute('href') || '';
      var text = allLinks[i].textContent.replace(/,/g, '').trim();
      var numMatch = text.match(/([\d.]+[KkMm]?)/);
      if (!numMatch) continue;
      var num = parseCountText(numMatch[1]);
      if (href.indexOf('/followers') !== -1 && href.indexOf('/following') === -1) {
        followers = num;
      } else if (href.indexOf('/following') !== -1) {
        following = num;
      }
    }
    return { followers: followers, following: following };
  }

  // ─── Modal scraping ─────────────────────────────────────────────

  async function openListModal(popup, type) {
    // type is 'followers' or 'following'
    var doc = popup.document;
    var links = doc.querySelectorAll('a[href]');
    var target = null;
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (type === 'followers' && href.indexOf('/followers') !== -1 && href.indexOf('/following') === -1) {
        target = links[i];
        break;
      }
      if (type === 'following' && href.indexOf('/following') !== -1) {
        target = links[i];
        break;
      }
    }
    if (!target) throw new Error('Could not find ' + type + ' link on profile page.');
    target.click();

    // Wait for modal (role="dialog") to appear
    await waitForEl(doc, '[role="dialog"]', 8000);
    // Small settle for content to render inside the modal
    await sleep(1000);
  }

  // Find the scrollable container inside the modal
  function findScrollableChild(modal) {
    var candidates = modal.querySelectorAll('div');
    for (var i = 0; i < candidates.length; i++) {
      var style = window.getComputedStyle(candidates[i]);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          candidates[i].scrollHeight > candidates[i].clientHeight) {
        return candidates[i];
      }
    }
    return modal;
  }

  function readUserRow(linkEl, username) {
    var row = linkEl.closest('div[role="button"]') ||
              linkEl.parentElement?.parentElement?.parentElement ||
              linkEl.parentElement;

    var fullName = '';
    var isPrivate = false;
    var isVerified = false;
    var mutualCount = 0;

    if (row) {
      var textContent = row.textContent || '';

      var spans = row.querySelectorAll('span');
      for (var i = 0; i < spans.length; i++) {
        var spanText = spans[i].textContent.trim();
        if (spanText === username) continue;
        if (spanText.indexOf('Followed by') !== -1) continue;
        if (spanText === 'Follow' || spanText === 'Following' || spanText === 'Remove') continue;
        if (spanText === 'Requested') continue;
        if (spanText.length > 0 && spanText.length < 60 && !fullName) {
          fullName = spanText;
        }
      }

      mutualCount = parseMutualText(textContent);

      var svg = row.querySelector('svg[aria-label="Verified"]') ||
                row.querySelector('[title="Verified"]');
      if (svg) isVerified = true;
    }

    return {
      username: username,
      full_name: fullName,
      is_private: isPrivate,
      is_verified: isVerified,
      mutual_count: mutualCount,
    };
  }

  async function scrapeModal(popup, cap, onProgress) {
    var doc = popup.document;
    var modal = doc.querySelector('[role="dialog"]');
    if (!modal) throw new Error('No modal found.');

    var users = [];
    var seen = new Set();
    var scrollable = findScrollableChild(modal);
    var noNewContentCount = 0;

    while (users.length < cap) {
      var links = modal.querySelectorAll('a[href]');
      var prevSize = seen.size;

      for (var i = 0; i < links.length; i++) {
        var username = extractUsernameFromHref(links[i].getAttribute('href') || '');
        if (!username || seen.has(username)) continue;
        seen.add(username);

        var userInfo = readUserRow(links[i], username);
        users.push(userInfo);

        if (users.length >= cap) break;
      }

      if (onProgress) onProgress(users.length);

      if (seen.size === prevSize) {
        noNewContentCount++;
        if (noNewContentCount >= 3) break;
      } else {
        noNewContentCount = 0;
      }

      if (scrollable) {
        scrollable.scrollTop = scrollable.scrollHeight;
      }
      await sleep(SCROLL_PAUSE_MS);
    }

    // Close modal by pressing Escape
    doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(500);

    return users;
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

  // Standard headers that match Instagram's own web client requests
  var igHeaders = {
    'X-IG-App-ID': IG_APP_ID,
    'X-IG-WWW-Claim': '0',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': '*/*',
  };

  // fetchPage does the actual HTTP call, with throttling and retry.
  // Returns {users, nextCursor} or throws.
  async function fetchPage(url, opts) {
    opts = opts || {};
    var maxRetries = 2;
    for (var attempt = 0; attempt <= maxRetries; attempt++) {
      if (!opts.skipThrottle || attempt > 0) await throttle();
      // Increasing backoff on retries: 3s, 6s
      if (attempt > 0) await new Promise(function(r) { setTimeout(r, 3000 * attempt); });
      var resp;
      try {
        resp = await doFetch(url, {
          credentials: 'include',
          headers: igHeaders,
        });
      } catch (e) {
        if (attempt < maxRetries) continue;
        throw new Error('network error: ' + e.message);
      }
      // Rate limit responses — no point retrying these
      if (resp.status === 429 || resp.status === 401) {
        throw new RateLimitError('http ' + resp.status);
      }
      var body;
      try {
        body = await resp.json();
      } catch (e) {
        if (attempt < maxRetries) {
          console.warn('[flock] non-json response (attempt ' + (attempt + 1) + '), retrying...');
          continue;
        }
        // After retries exhausted, treat as rate limit so progress is saved
        throw new RateLimitError('non-json response after ' + (maxRetries + 1) + ' attempts');
      }
      return classifyResponse(resp.status, body);
    }
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
    const obj = {
      username: u.username,
      full_name: u.full_name || '',
      is_private: !!u.is_private,
    };
    if (u.is_verified) obj.is_verified = true;
    if (typeof u.follower_count === 'number') obj.follower_count = u.follower_count;
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
      if (all.length >= SCAN_CAP) break;
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
          headers: igHeaders,
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
        headers: igHeaders,
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
          headers: igHeaders,
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
      headers: igHeaders,
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

    // Detect business mode from redirect URL
    const isBiz = FOLLOW_RADAR_URL.indexOf('business') !== -1;
    const accentColor = isBiz ? '#D4A843' : '#6366F1';
    const accentColor2 = isBiz ? '#E8C76A' : '#A855F7';
    const accentColor3 = isBiz ? '#C49530' : '#D946EF';
    const brandName = isBiz ? 'Flock Business' : 'Flock';
    const borderColor = isBiz ? 'rgba(212,168,67,0.25)' : 'rgba(99,102,241,0.2)';
    const bgTint = isBiz ? 'rgba(20,16,8,0.92)' : 'rgba(12,14,36,0.92)';

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
      'background:' + bgTint,
      'backdrop-filter:blur(16px)','-webkit-backdrop-filter:blur(16px)',
      'border:1px solid ' + borderColor,
      'box-shadow:0 4px 24px rgba(0,0,0,0.5),0 0 0 1px ' + borderColor,
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

    // Logo (business) or spinning ring (personal)
    var spinner;
    if (isBiz) {
      spinner = document.createElement('img');
      spinner.src = GOLD_LOGO_URI;
      spinner.setAttribute('style', 'width:28px;height:28px;border-radius:6px;flex-shrink:0');
    } else {
      spinner = document.createElement('div');
      spinner.setAttribute('style', [
        'width:28px','height:28px','border-radius:50%','flex-shrink:0',
        'border:2.5px solid rgba(255,255,255,0.08)',
        'border-top-color:' + accentColor,'border-right-color:' + accentColor2,
        'animation:fr-spin 1s linear infinite',
      ].join(';'));
    }

    // Title column
    const titleCol = document.createElement('div');
    titleCol.setAttribute('style', 'flex:1;min-width:0');
    const title = document.createElement('div');
    title.setAttribute('style', 'font-weight:700;font-size:13px;letter-spacing:0.02em;color:#fff');
    title.textContent = brandName;
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
      'background:' + (isBiz ? 'rgba(212,168,67,0.12)' : 'rgba(99,102,241,0.12)'),
      'flex-shrink:0',
    ].join(';'));
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('div');
      d.setAttribute('style', [
        'width:4px','height:4px','border-radius:50%',
        'background:' + accentColor,
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
      'background:linear-gradient(90deg,' + accentColor + ',' + accentColor2 + ',' + accentColor3 + ')',
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
      'background:linear-gradient(90deg,' + accentColor + ',' + accentColor2 + ',' + accentColor3 + ',' + accentColor + ')',
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

  // ─── Post scraping (for growth analytics) ────────────────────────

  function trimPost(item) {
    return {
      id: item.id || item.pk || '',
      taken_at: item.taken_at || 0,
      like_count: item.like_count || 0,
      comment_count: item.comment_count || 0,
      media_type: item.media_type || 1, // 1=photo, 2=video, 8=carousel
      caption_length: (item.caption && item.caption.text) ? item.caption.text.length : 0,
      carousel_count: (item.carousel_media_count) || (item.carousel_media ? item.carousel_media.length : 0) || 0,
      video_duration: item.video_duration || 0,
    };
  }

  async function scrapePosts(userId, maxPosts) {
    const posts = [];
    let maxId = null;
    const limit = maxPosts || 50;

    for (let page = 0; page < 5; page++) { // max 5 pages to be safe
      await throttle();
      let url = 'https://i.instagram.com/api/v1/feed/user/' + userId + '/?count=33';
      if (maxId) url += '&max_id=' + encodeURIComponent(maxId);

      let r, body;
      try {
        r = await doFetch(url, {
          credentials: 'include',
          headers: igHeaders,
        });
      } catch (e) {
        console.warn('[flock] post fetch network error:', e);
        break;
      }

      if (!r.ok) {
        console.warn('[flock] post fetch http ' + r.status);
        break;
      }

      try {
        body = await r.json();
      } catch (e) {
        break;
      }

      if (!body || !Array.isArray(body.items)) break;

      for (const item of body.items) {
        posts.push(trimPost(item));
        if (posts.length >= limit) break;
      }

      if (posts.length >= limit || !body.more_available || !body.next_max_id) break;
      maxId = body.next_max_id;
    }

    return posts;
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

    // Cooldown check — applies to fresh scans AND resumes.
    const cooldownLeft = checkCooldown(user.userId);
    if (cooldownLeft) {
      alert(
        "You scanned recently. To keep your account safe, Flock limits scans to once every 3 days.\n\n" +
        "You can scan again in " + cooldownLeft + "."
      );
      return;
    }

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
        // Estimate scan time for the overlay
        var totalPages = Math.ceil(Math.min(sizes.followers, SCAN_CAP) / PAGE_SIZE) +
                         Math.ceil(Math.min(sizes.following, SCAN_CAP) / PAGE_SIZE);
        var estMinutes = Math.ceil(totalPages * (THROTTLE_MS + THROTTLE_JITTER_MS / 2) / 60000);
      } catch (e) {
        alert("Could not check account size: " + e.message);
        return;
      }
    }

    // Confirmation dialog on fresh scans.
    if (!resume) {
      var timeMsg = estMinutes ? 'This scan takes about ' + estMinutes + ' minutes. ' : '';
      var ok = confirm(
        timeMsg + 'Flock scans your follower list directly in your browser — nothing is shared with us or any server.\n\n' +
        'We use careful pacing to keep everything smooth, but like any third-party tool, there\'s a small chance Instagram may temporarily limit some activity on your account.\n\n' +
        'Ready to scan?'
      );
      if (!ok) return;
    }

    createOverlay();

    // Warm up the session with normal-looking requests before scanning.
    if (!resume) {
      updateOverlay('Loading your profile\u2026', 0);
      await warmUp(user.userId);
    }

    let followers = initialFollowers || [];
    let following = initialFollowing || [];

    try {
      if (phase === 'followers') {
        var timeNote = estMinutes ? ' (~' + estMinutes + ' min total)' : '';
        updateOverlay('Scanning followers\u2026 ' + followers.length + timeNote, 0);
        followers = await scrapeFollowers(user.userId, followers, initialCursor, (n) => {
          updateOverlay('Scanning followers\u2026 ' + n + timeNote, 0.1 + Math.min(0.4, n / SCAN_CAP));
        });
        phase = 'following';
        initialCursor = null;
      }
      updateOverlay('Scanning following\u2026 ' + following.length, 0.5);
      following = await scrapeFollowing(user.userId, following, phase === 'following' ? initialCursor : null, (n) => {
        updateOverlay('Scanning following\u2026 ' + n, 0.5 + Math.min(0.5, n / SCAN_CAP));
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

    // Phase 3: scrape recent posts for growth analytics
    let posts = [];
    try {
      updateOverlay('Analyzing your posts\u2026', 0.92);
      posts = await scrapePosts(user.userId, 50);
      updateOverlay('Analyzing your posts\u2026 ' + posts.length + ' found', 0.98);
    } catch (e) {
      console.warn('[flock] post scrape failed:', e);
    }

    destroyOverlay();
    clearResumeState();
    saveCooldown(user.userId);

    const payload = {
      username: user.username,
      userId: user.userId,
      scrapedAt: new Date().toISOString(),
      followers: followers,
      following: following,
      posts: posts,
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
      MAX_ACCOUNT_SIZE, SCAN_CAP, THROTTLE_MS, THROTTLE_JITTER_MS, PAGE_SIZE,
      IG_APP_ID, RESUME_MAX_AGE_MS, COOLDOWN_MS, COOLDOWN_KEY,
      FOLLOW_RADAR_URL, RESUME_KEY
    };
    window.__followRadarTest.encodePayload = encodePayload;
    window.__followRadarTest.decodePayload = decodePayload;
    window.__followRadarTest.saveResumeState = saveResumeState;
    window.__followRadarTest.loadResumeState = loadResumeState;
    window.__followRadarTest.clearResumeState = clearResumeState;
    window.__followRadarTest.checkCooldown = checkCooldown;
    window.__followRadarTest.saveCooldown = saveCooldown;
    window.__followRadarTest.warmUp = warmUp;
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
    window.__followRadarTest.sleep = sleep;
    window.__followRadarTest.waitForEl = waitForEl;
    window.__followRadarTest.findByText = findByText;
    window.__followRadarTest.extractUsernameFromHref = extractUsernameFromHref;
    window.__followRadarTest.parseMutualText = parseMutualText;
    window.__followRadarTest.openScanPopup = openScanPopup;
    window.__followRadarTest.closeScanPopup = closeScanPopup;
    window.__followRadarTest.waitForProfileRender = waitForProfileRender;
    window.__followRadarTest.parseCountText = parseCountText;
    window.__followRadarTest.readAccountSize = readAccountSize;
    window.__followRadarTest.openListModal = openListModal;
    window.__followRadarTest.scrapeModal = scrapeModal;
    window.__followRadarTest.findScrollableChild = findScrollableChild;
    window.__followRadarTest.readUserRow = readUserRow;
    window.__followRadarTest.constants.SCROLL_PAUSE_MS = SCROLL_PAUSE_MS;
    window.__followRadarTest.constants.SCROLL_SETTLE_MS = SCROLL_SETTLE_MS;
    return; // skip main() in test mode
  }

  // Production entry point.
  main().catch(e => {
    console.error('[follow radar]', e);
    alert("Unexpected error: " + (e.message || e));
  });
})();
