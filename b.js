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
  const RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days between scans
  const COOLDOWN_KEY = 'flock:last-scan';
  const FOLLOW_RADAR_URL = (typeof window !== 'undefined' && window.__flockBiz) ? 'https://flockscan.org/business.html' : 'https://flockscan.org';
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

  async function waitForProfileRender(page, timeout) {
    var deadline = Date.now() + (timeout || 15000);
    while (Date.now() < deadline) {
      try {
        var doc = page.document;
        var links = doc.querySelectorAll('a[href*="/followers"]');
        if (links.length > 0) return;
        var allLinks = doc.querySelectorAll('a');
        for (var i = 0; i < allLinks.length; i++) {
          if (/\d+\s*followers/i.test(allLinks[i].textContent)) return;
        }
      } catch (e) { /* keep polling */ }
      await sleep(500);
    }
    throw new Error('Profile did not load in time.');
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

  // ─── List navigation ─────────────────────────────────────────────

  // Simulate a real mouse click that triggers React's event system
  function simulateClick(el) {
    var rect = el.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    var opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }

  function findFollowLink(doc, type) {
    // Strategy 1: <a> with href containing /followers or /following
    var links = doc.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (type === 'followers' && href.indexOf('/followers') !== -1 && href.indexOf('/following') === -1) return links[i];
      if (type === 'following' && href.indexOf('/following') !== -1) return links[i];
    }
    // Strategy 2: text pattern match
    var allEls = doc.querySelectorAll('a, span, div, button, li');
    var pattern = type === 'followers'
      ? /[\d,.]+[KkMm]?\s+followers/i
      : /[\d,.]+[KkMm]?\s+following/i;
    for (var j = 0; j < allEls.length; j++) {
      var txt = allEls[j].textContent || '';
      if (txt.length < 30 && pattern.test(txt)) return allEls[j];
    }
    return null;
  }

  async function openList(username, type) {
    var target = findFollowLink(document, type);
    if (!target) throw new Error('Could not find ' + type + ' link on profile.');

    var urlBefore = location.pathname;
    simulateClick(target);

    // Wait for something to happen: modal, URL change, or new content
    var deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      // Check for modal
      var modal = findModal(document);
      if (modal) return { mode: 'modal' };
      // Check for URL change (SPA navigation)
      if (location.pathname !== urlBefore) return { mode: 'page' };
      await sleep(300);
    }

    // If simulated click didn't work, try direct navigation as fallback
    // This kills our script context, so save state first
    throw new Error('Could not open ' + type + ' list. Click did not trigger navigation or modal.');
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

  function findModal(doc) {
    // Try multiple selectors for the modal container
    var modal = doc.querySelector('[role="dialog"]');
    if (modal) return modal;

    // Fallback: look for presentation overlay
    var pres = doc.querySelectorAll('div[role="presentation"], div[tabindex="-1"]');
    for (var i = 0; i < pres.length; i++) {
      var rect = pres[i].getBoundingClientRect();
      if (rect.width > 200 && rect.height > 200) return pres[i];
    }

    // Fallback: find a fixed/absolute positioned overlay with scrollable content
    var divs = doc.querySelectorAll('div[style*="position: fixed"], div[style*="position: absolute"]');
    for (var j = 0; j < divs.length; j++) {
      var r = divs[j].getBoundingClientRect();
      if (r.width > 200 && r.height > 200 && divs[j].querySelectorAll('a[href]').length > 3) {
        return divs[j];
      }
    }

    return null;
  }

  async function scrapeModal(popup, cap, onProgress) {
    var doc = popup.document;
    var modal = findModal(doc);
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

  // Scrape from a full-page followers/following list (SPA navigation mode)
  async function scrapePage(cap, onProgress) {
    var users = [];
    var seen = new Set();
    var noNewContentCount = 0;

    // Wait for initial user links to appear
    var waitDeadline = Date.now() + 8000;
    while (Date.now() < waitDeadline) {
      var initialLinks = document.querySelectorAll('a[href]');
      var userLinkCount = 0;
      for (var k = 0; k < initialLinks.length; k++) {
        if (extractUsernameFromHref(initialLinks[k].getAttribute('href') || '')) userLinkCount++;
      }
      if (userLinkCount >= 3) break;
      await sleep(500);
    }

    while (users.length < cap) {
      var links = document.querySelectorAll('a[href]');
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

      // Scroll the page itself
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(SCROLL_PAUSE_MS);
    }

    return users;
  }

  // ─── Post grid scraping ─────────────────────────────────────────

  function readPostTile(linkEl, href) {
    var container = linkEl.closest('article') || linkEl.parentElement;
    var text = (container && container.textContent) || '';

    var likeMatch = text.match(/([\d,]+)\s*likes?/i);
    var commentMatch = text.match(/([\d,]+)\s*comments?/i);

    var mediaType = 1; // default: photo
    if (href.indexOf('/reel/') !== -1) mediaType = 2; // video/reel

    return {
      id: href.replace(/.*\/(p|reel)\/([^/]+).*/, '$2'),
      taken_at: 0,
      like_count: likeMatch ? parseInt(likeMatch[1].replace(/,/g, ''), 10) : 0,
      comment_count: commentMatch ? parseInt(commentMatch[1].replace(/,/g, ''), 10) : 0,
      media_type: mediaType,
      caption_length: 0,
      carousel_count: 0,
      video_duration: 0,
    };
  }

  async function scrapePostGrid(popup, maxPosts) {
    var doc = popup.document;
    var posts = [];
    var seen = new Set();
    var limit = maxPosts || 50;
    var noNewCount = 0;

    while (posts.length < limit) {
      var postLinks = doc.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');

      var prevSize = seen.size;
      for (var i = 0; i < postLinks.length; i++) {
        var href = postLinks[i].getAttribute('href') || '';
        if (seen.has(href)) continue;
        seen.add(href);

        var post = readPostTile(postLinks[i], href);
        if (post) posts.push(post);
        if (posts.length >= limit) break;
      }

      if (seen.size === prevSize) {
        noNewCount++;
        if (noNewCount >= 3) break;
      } else {
        noNewCount = 0;
      }

      popup.scrollTo(0, popup.document.documentElement.scrollHeight);
      await sleep(SCROLL_PAUSE_MS);
    }

    return posts;
  }

  // ─── React fiber fallback ───────────────────────────────────────

  function getFiberKey(element) {
    var keys = Object.keys(element);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf('__reactFiber$') === 0 || keys[i].indexOf('__reactInternalInstance$') === 0) {
        return keys[i];
      }
    }
    return null;
  }

  function walkFiber(fiber, predicate, maxDepth) {
    if (!fiber || maxDepth <= 0) return null;
    if (predicate(fiber)) return fiber;
    var result = walkFiber(fiber.child, predicate, maxDepth - 1);
    if (result) return result;
    return walkFiber(fiber.sibling, predicate, maxDepth - 1);
  }

  function getReactFiberData(element, dataKey) {
    var fiberKey = getFiberKey(element);
    if (!fiberKey) return null;
    var fiber = element[fiberKey];

    // Walk up to find a fiber with memoizedProps containing user data
    var node = fiber;
    for (var i = 0; i < 20 && node; i++) {
      var props = node.memoizedProps || {};
      if (props[dataKey] && Array.isArray(props[dataKey])) {
        return props[dataKey];
      }
      props = node.pendingProps || {};
      if (props[dataKey] && Array.isArray(props[dataKey])) {
        return props[dataKey];
      }
      node = node.return;
    }

    // Walk down as well
    var found = walkFiber(fiber, function (f) {
      var p = f.memoizedProps || f.pendingProps || {};
      return p[dataKey] && Array.isArray(p[dataKey]);
    }, 15);

    if (found) {
      var p = found.memoizedProps || found.pendingProps || {};
      return p[dataKey];
    }
    return null;
  }

  // ─── Progress overlay ────────────────────────────────────────────

  let overlayEl = null;
  let overlayBarEl = null;
  let overlayTextEl = null;
  var overlayDoc = null;

  function createOverlay(targetDoc) {
    overlayDoc = targetDoc || document;
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
    const style = overlayDoc.createElement('style');
    style.textContent = [
      '@keyframes fr-in{from{opacity:0;transform:translateY(12px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}',
      '@keyframes fr-spin{to{transform:rotate(360deg)}}',
      '@keyframes fr-dots{0%,80%,100%{opacity:.25}40%{opacity:1}}',
      '@keyframes fr-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}',
    ].join('');
    overlayDoc.head.appendChild(style);

    // Outer container
    overlayEl = overlayDoc.createElement('div');
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
    const content = overlayDoc.createElement('div');
    content.setAttribute('style', 'padding:14px 16px 12px');

    // Top row: spinner + title + live badge
    const topRow = overlayDoc.createElement('div');
    topRow.setAttribute('style', 'display:flex;align-items:center;gap:10px;margin-bottom:10px');

    // Logo (business) or spinning ring (personal)
    var spinner;
    if (isBiz) {
      spinner = overlayDoc.createElement('img');
      spinner.src = GOLD_LOGO_URI;
      spinner.setAttribute('style', 'width:28px;height:28px;border-radius:6px;flex-shrink:0');
    } else {
      spinner = overlayDoc.createElement('div');
      spinner.setAttribute('style', [
        'width:28px','height:28px','border-radius:50%','flex-shrink:0',
        'border:2.5px solid rgba(255,255,255,0.08)',
        'border-top-color:' + accentColor,'border-right-color:' + accentColor2,
        'animation:fr-spin 1s linear infinite',
      ].join(';'));
    }

    // Title column
    const titleCol = overlayDoc.createElement('div');
    titleCol.setAttribute('style', 'flex:1;min-width:0');
    const title = overlayDoc.createElement('div');
    title.setAttribute('style', 'font-weight:700;font-size:13px;letter-spacing:0.02em;color:#fff');
    title.textContent = brandName;
    const subtitle = overlayDoc.createElement('div');
    subtitle.setAttribute('style', 'font-size:10px;color:rgba(255,255,255,0.4);margin-top:1px;text-transform:uppercase;letter-spacing:0.06em');
    subtitle.textContent = 'Scanning';
    titleCol.appendChild(title);
    titleCol.appendChild(subtitle);

    // Live badge with animated dots
    const badge = overlayDoc.createElement('div');
    badge.setAttribute('style', [
      'display:flex','align-items:center','gap:3px',
      'padding:3px 8px','border-radius:20px',
      'background:' + (isBiz ? 'rgba(212,168,67,0.12)' : 'rgba(99,102,241,0.12)'),
      'flex-shrink:0',
    ].join(';'));
    for (let i = 0; i < 3; i++) {
      const d = overlayDoc.createElement('div');
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
    overlayTextEl = overlayDoc.createElement('div');
    overlayTextEl.textContent = 'Starting...';
    overlayTextEl.setAttribute('style', 'font-size:12px;color:rgba(255,255,255,0.65);font-variant-numeric:tabular-nums;margin-bottom:12px');
    content.appendChild(overlayTextEl);

    // Progress bar track
    const track = overlayDoc.createElement('div');
    track.setAttribute('style', 'height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden');
    overlayBarEl = overlayDoc.createElement('div');
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
    const accent = overlayDoc.createElement('div');
    accent.setAttribute('style', [
      'height:2px',
      'background:linear-gradient(90deg,' + accentColor + ',' + accentColor2 + ',' + accentColor3 + ',' + accentColor + ')',
      'background-size:200% 100%',
      'animation:fr-shimmer 3s linear infinite',
    ].join(';'));
    overlayEl.appendChild(accent);

    overlayDoc.body.appendChild(overlayEl);
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
    overlayDoc = null;
  }

  // ─── Ship results ────────────────────────────────────────────────

  async function shipResults(payload) {
    const encoded = await encodePayload(payload);
    var url = FOLLOW_RADAR_URL + '/#data=' + encoded;
    // Try multiple redirect methods — Instagram may block some
    try { window.location.href = url; } catch (e) {}
    await sleep(1000);
    // If still on Instagram, try replace
    if (location.hostname.indexOf('instagram.com') !== -1) {
      try { window.location.replace(url); } catch (e) {}
      await sleep(1000);
    }
    // If still here, try window.open as last resort
    if (location.hostname.indexOf('instagram.com') !== -1) {
      var w = window.open(url, '_self');
      if (!w) window.open(url, '_blank');
    }
  }


  // ─── Current user detection ─────────────────────────────────────

  function getCurrentUserDOM() {
    try {
      var sd = window._sharedData && window._sharedData.config && window._sharedData.config.viewer;
      if (sd && sd.id && sd.username) {
        return { userId: String(sd.id), username: sd.username };
      }
    } catch (e) { /* fall through */ }

    var cookieUserId = null;
    try {
      var m = document.cookie.match(/(?:^|;\s*)ds_user_id=(\d+)/);
      if (m) cookieUserId = m[1];
    } catch (e) { /* fall through */ }

    if (cookieUserId) {
      var navLinks = document.querySelectorAll('a[href]');
      for (var i = 0; i < navLinks.length; i++) {
        var href = navLinks[i].getAttribute('href') || '';
        var username = extractUsernameFromHref(href);
        if (username && navLinks[i].querySelector('img[alt]')) {
          return { userId: cookieUserId, username: username };
        }
      }
    }

    if (cookieUserId) {
      return { userId: cookieUserId, username: null };
    }

    throw new Error("Could not determine logged-in user. Make sure you're logged into instagram.com.");
  }

  // ─── Main entry ──────────────────────────────────────────────────
  // Runs directly on the current Instagram page -- no popup needed.
  // The user must be on their own profile page or we navigate there.

  async function main() {
    var user;
    try {
      user = getCurrentUserDOM();
    } catch (e) {
      alert(e.message);
      return;
    }

    if (!user.username) {
      var pathMatch = location.pathname.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
      if (pathMatch) {
        user.username = pathMatch[1];
      } else {
        alert("Could not determine your username. Navigate to your profile and try again.");
        return;
      }
    }

    // Check resume state
    var existing = loadResumeState(user.userId);
    if (existing && existing.mismatch) {
      alert("You have a scan in progress on a different account. Switch back to that account, or clear it from DevTools (localStorage key '" + RESUME_KEY + "').");
      return;
    }

    var resume = existing;
    var phase = (resume && resume.phase) || 'followers';

    // Cooldown check
    var cooldownLeft = checkCooldown(user.userId);
    if (cooldownLeft) {
      alert(
        "You scanned recently. To keep your account safe, Flock limits scans to once every 3 days.\n\n" +
        "You can scan again in " + cooldownLeft + "."
      );
      return;
    }

    // Navigate to profile if not already there
    var profilePath = '/' + user.username + '/';
    if (location.pathname !== profilePath) {
      location.href = 'https://www.instagram.com' + profilePath;
      // After navigation, user clicks bookmarklet again
      return;
    }

    // Use current page as the scan target (like a "popup" but it's this window)
    var page = { document: document, scrollTo: window.scrollTo.bind(window) };

    // Wait for profile to fully render
    try {
      await waitForProfileRender(page, 10000);
    } catch (e) {
      alert("Could not detect your profile. Make sure you're on your own profile page and try again.");
      return;
    }

    // Read account size from profile DOM
    var sizes = readAccountSize(page);
    if (sizes.followers > MAX_ACCOUNT_SIZE || sizes.following > MAX_ACCOUNT_SIZE) {
      alert(
        "Flock is built for accounts under " + MAX_ACCOUNT_SIZE.toLocaleString() + " followers/following.\n\n" +
        "Yours has " + sizes.followers.toLocaleString() + " followers and " + sizes.following.toLocaleString() + " following."
      );
      return;
    }

    // Estimate time
    var totalUsers = Math.min(sizes.followers, SCAN_CAP) + Math.min(sizes.following, SCAN_CAP);
    var estMinutes = Math.ceil(totalUsers / 20 * SCROLL_PAUSE_MS / 60000) + 1;

    // Confirmation dialog
    if (!resume) {
      var ok = confirm(
        'This scan takes about ' + estMinutes + ' minutes. ' +
        'Flock will scroll through your follower list on this page -- nothing is shared with us or any server.\n\n' +
        'Keep this tab open while it runs. You can use other tabs and apps.\n\n' +
        'Ready to scan?'
      );
      if (!ok) return;
    }

    // Create overlay on current page
    createOverlay();

    var followers = (resume && resume.partialFollowers) || [];
    var following = (resume && resume.partialFollowing) || [];

    try {
      // Phase 1: Scrape followers
      if (phase === 'followers') {
        updateOverlay('Scanning followers... (~' + estMinutes + ' min)', 0);
        var fResult = await openList(user.username, 'followers');
        await sleep(2000);
        // Re-create overlay (may have been lost during navigation)
        createOverlay();
        updateOverlay('Scanning followers...', 0.05);
        if (fResult.mode === 'modal') {
          followers = await scrapeModal(page, SCAN_CAP, function (n) {
            updateOverlay('Scanning followers... ' + n, 0.05 + Math.min(0.4, n / SCAN_CAP));
          });
        } else {
          followers = await scrapePage(SCAN_CAP, function (n) {
            updateOverlay('Scanning followers... ' + n, 0.05 + Math.min(0.4, n / SCAN_CAP));
          });
          // Go back to profile for next phase
          history.back();
          await sleep(2000);
        }
        phase = 'following';
      }

      // Phase 2: Scrape following
      updateOverlay('Scanning following...', 0.5);
      var gResult = await openList(user.username, 'following');
      await sleep(2000);
      createOverlay();
      updateOverlay('Scanning following...', 0.5);
      if (gResult.mode === 'modal') {
        following = await scrapeModal(page, SCAN_CAP, function (n) {
          updateOverlay('Scanning following... ' + n, 0.5 + Math.min(0.35, n / SCAN_CAP));
        });
      } else {
        following = await scrapePage(SCAN_CAP, function (n) {
          updateOverlay('Scanning following... ' + n, 0.5 + Math.min(0.35, n / SCAN_CAP));
        });
        // Go back to profile for post scraping
        history.back();
        await sleep(2000);
      }

      // Phase 3: Scrape posts
      updateOverlay('Analyzing your posts...', 0.9);
      var posts = [];
      try {
        var page2 = { document: document, scrollTo: window.scrollTo.bind(window) };
        posts = await scrapePostGrid(page2, 50);
        updateOverlay('Analyzing your posts... ' + posts.length + ' found', 0.98);
      } catch (e) {
        console.warn('[flock] post scrape failed:', e);
      }

    } catch (e) {
      destroyOverlay();

      if (followers.length > 0 || following.length > 0) {
        saveResumeState({
          userId: user.userId,
          username: user.username,
          phase: phase,
          cursor: null,
          partialFollowers: followers,
          partialFollowing: following,
        });
        var payload = {
          username: user.username,
          userId: user.userId,
          scrapedAt: new Date().toISOString(),
          followers: followers,
          following: following,
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
    saveCooldown(user.userId);

    var payload = {
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
      MAX_ACCOUNT_SIZE, SCAN_CAP, SCROLL_PAUSE_MS, SCROLL_SETTLE_MS,
      COOLDOWN_MS, COOLDOWN_KEY, FOLLOW_RADAR_URL, RESUME_KEY
    };
    window.__followRadarTest.encodePayload = encodePayload;
    window.__followRadarTest.decodePayload = decodePayload;
    window.__followRadarTest.saveResumeState = saveResumeState;
    window.__followRadarTest.loadResumeState = loadResumeState;
    window.__followRadarTest.clearResumeState = clearResumeState;
    window.__followRadarTest.checkCooldown = checkCooldown;
    window.__followRadarTest.saveCooldown = saveCooldown;
    window.__followRadarTest.sleep = sleep;
    window.__followRadarTest.waitForEl = waitForEl;
    window.__followRadarTest.findByText = findByText;
    window.__followRadarTest.extractUsernameFromHref = extractUsernameFromHref;
    window.__followRadarTest.parseMutualText = parseMutualText;
    window.__followRadarTest.parseCountText = parseCountText;
    window.__followRadarTest.openScanPopup = openScanPopup;
    window.__followRadarTest.closeScanPopup = closeScanPopup;
    window.__followRadarTest.readAccountSize = readAccountSize;
    window.__followRadarTest.openListModal = openListModal;
    window.__followRadarTest.scrapeModal = scrapeModal;
    window.__followRadarTest.findScrollableChild = findScrollableChild;
    window.__followRadarTest.readUserRow = readUserRow;
    window.__followRadarTest.readPostTile = readPostTile;
    window.__followRadarTest.scrapePostGrid = scrapePostGrid;
    window.__followRadarTest.getFiberKey = getFiberKey;
    window.__followRadarTest.walkFiber = walkFiber;
    window.__followRadarTest.getReactFiberData = getReactFiberData;
    window.__followRadarTest.getCurrentUserDOM = getCurrentUserDOM;
    window.__followRadarTest.shipResults = shipResults;
    window.__followRadarTest.main = main;
    return;
  }

  // Production entry point.
  if (!/(^|\.)instagram\.com$/.test(location.hostname)) {
    alert("Open instagram.com first, then click this bookmarklet.");
  } else {
    main().catch(function (e) {
      console.error('[flock]', e);
      alert("Unexpected error: " + (e.message || e));
    });
  }
})();
