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
  const BIRD_LOGO_URI = 'data:image/svg+xml;base64,' + 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbDpzcGFjZT0icHJlc2VydmUiIHZpZXdCb3g9IjAgMCAzMTIgMjc2Ij48cGF0aCBmaWxsPSIjODU4MGQ0IiBkPSJNMTc4IDI3N0gxVjFoMzEydjI3NnptLTQuNy00NC0xLjIuNy0uOC4yLTEuMi44LS45LjFjLTMuOCAxLjctNy41IDMuMy0xMi4xIDVxLTEwIDEuNi0yMC41IDNsLTEuMi42IDIuMSAxLjJhODggODggMCAwIDAgNzEtNi40IDExMCAxMTAgMCAwIDAgNDUtNDUuMmMxLjEtMS41IDItMy4zIDMuNC00LjQgMi4zLTIgMi4yLTMuNyAwLTYuM3EuNi0xLjYgMi0zLjNsMS43LTEuMmMtLjYtLjMtMS0uNS0xLjYtMS41cTAtLjYgMS0xLjN2LTIuOHEuNy0zIDIuMi02LjNsLS4zLTIuOHEuNS0zIDEuNC02LjJsLS40LTIuOHEwLTggLjYtMTYuM2wtLjktMi42cS0uNC0yIC4yLTQuNWwyLTMuNXEtMS43LS40LTQtMS45Yy0uNS0yLjgtMS4yLTUuNS0xLjItOC42bC0xLjktMTAuNGMwLS41LS44LTEtMS4zLTEuMnMtMSAwLTItLjVjLS41LTEuNi0xLTMtLjYtNC42cTEtMiAxLjYtNC4xbDEuOC0xMnEuNy0yLjkgMi4xLTYuNSAzLjMtMS44IDcuMy0yLjhjMi44IDAgNi4zIDIgOC0yLjlsNS40LTEuMWE0MyA0MyAwIDAgMS00LTUuNGMtLjktLjMtMS42LS43LTMuMS0xLjEtMi0xLTMuOC0yLjMtNS44LTIuNy02LTEuMy0xMC00LjktMTQtOS4zLTMtMy4yLTcuMi01LjMtMTEuMy04LjNxLTcuNy0xLjktMTYuNS00LjNjLTI1LTEuNy01NS43IDE4LTYyLjMgNDAuNGw0LjcgMS4zYzcuNyAyLjYgMTUuNyA0LjUgMjMgOGE2MSA2MSAwIDAgMSAzNC44IDQ0bDEuMyAyLjVxLjIgMS4yLS40IDIuNmwxLjMgMy42cS4yIDItLjUgNC4ybC44IDguN3EtLjIgMi41LTEuMiA1LjRsLjEgNC41cS0uMiAxLjEtMSAyLjR2Mi42YTkyIDkyIDAgMCAxLTE4LjMgMzYuM2MtOC4yIDEwLjItMTguNSAxOC0zMC4zIDI0LjlsLTEuNCAxaC0uNmwtMS4zIDF6bTE0LjUtNTEgOSAxMS42YzQuNi03LjUgNS44LTE0LjcgMi4xLTIzLjFsLTEuNS0zLjRxLTItMy00LjMtN2wtMTEuNS04LjlxLTMuNi0xLjEtOC0yLjhsLTEyLjQtMS41Yy0xMS43LTEtMjMuNC0xLjMtMzUtMi44LTEwLjgtMS40LTIxLjUtNC0zMy02LjFRODMuNCAxMzUgNzMgMTMxcS04LjktNC0xOC40LTguOC0zLjItMS41LTctMy45TDM2LjEgMTExbC0xLjEgMWMyIDExLjIgNS4zIDIyIDEzIDMxLjhsMTMuMyAxNGE2OCA2OCAwIDAgMCAyNi4yIDEzLjhjMTYuMiA1IDMyLjggNS43IDQ5LjUgMy44IDE1LjYtMS45IDMxLTQuOCA0Ni4zIDMuMnEyIDEgNC41IDMuMm0tMTU1LTExNyAzIDhMNDQgODhsMTcuMyAxNi45cTEyLjIgNi41IDI1IDEzLjhjMTMuMyAzLjQgMjYuNCA3IDQwLjIgMTAuOWwyNi4zIDIgNC43LjEgNC4yLjZxMS4zIDAgMy45LjNjMS44LjIgMy41LjQgNS45IDFxNy42IDIuMSAxNS45IDVjOS43IDUgMTYuOSAxMi42IDIyLjUgMjMuNWE0NCA0NCAwIDAgMC0xLTI3LjhsLTQuOS0xMWE0MCA0MCAwIDAgMC0xOS40LTE4Yy04LjktMy42LTE4LjMtNi0yNy41LTguNS0xMi43LTMuNS0yNS40LTYuNi0zOC43LTEwLjNsLTE1LjItNS42cS0yLjQtLjgtNC42LTEuNy05LjctNS4xLTIwLTExLTkuMi02LTE4LjktMTMtMy0yLTYuNS00LjktNi43LTYuNS0xMy43LTEzLjdsLTgtOC41QTc4IDc4IDAgMCAwIDMyLjggNjVNOTAuMiAyMTNxMTEuMyA1LjMgMjMuMyAxMS41YzI2LjUgNyA0OS42IDAgNzAuMS0xNy4yIDEuMi0xIDIuMy0zLjEgMi00LjVxLTEuNC03LjMtOC4yLTExLjFhNTAgNTAgMCAwIDAtMzMuOC0zLjlxLTEyLjYgMi4yLTI2LjIgNC41LTIuMSAwLTQuOC0uMkgxMTBjLTMuNyAwLTcuNCAwLTExLjktLjNsLTMxLjMtNS43YTc0IDc0IDAgMCAwIDIzLjMgMjYuOSIvPjxwYXRoIGZpbGw9IiMwZDEyMzEiIGQ9Im0yMjcuOSAxNDYtLjItNC44LS44LTMuMnEwLTEtLjItMi45bC0uNy0yLjFhNjMgNjMgMCAwIDAtMzUuNC00My44Yy03LjItMy41LTE1LjItNS40LTIzLThsLTQuNi0xLjNjNi42LTIyLjQgMzcuMy00MiA2Mi41LTQwLTEgMS0yLjEgMS40LTQuNiAyLjQgMi43IDEuNyA0LjIgMyA2IDMuNyAyLjcgMSA1LjggMS4zIDguNSAyLjIgNCAxLjUgNi40LjYgNi45LTQgMy42IDIuNiA3LjkgNC43IDEwLjggOCA0IDQuMyA4IDggMTQgOS4yIDIgLjQgMy45IDEuNyA2LjMgM2wyLjYgMS41IDQgNC43LTYgMS4ycS00LjYgMS4yLTggMi4zbC03LjIgMy42Yy03LjMgNi45LTkgMTQtNS44IDIyLjNhMjMxIDIzMSAwIDAgMCA2IDE3bDIgOSAxLjIgNSAuNCA0LjguNSAyLjItLjIgMTktMSA2LjgtLjIgMi4zLTEuOSA2LjctLjMgMi4yLS44IDEuOC0uNCAyLjItMS42IDMuOS00IDEwYTEwNCAxMDQgMCAwIDEtNDQuMSA0NS4zIDg3IDg3IDAgMCAxLTcxLjMgNS45cS0uNC0xLS4zLTEuMSAxMC0xLjYgMjAuNS0yLjhjMy41IDYuNSA3LjQgOCAxNS4zIDZsLTIuOC0xMS40aC41cTEuMS0uNiAxLjUtMWguNXExLS41IDEuNC0xIDAgLjEuMy4xIDEuMi0uNSAxLjctMWguM3ExLjItLjUgMS43LTFhMTEzIDExMyAwIDAgMCAyOS43LTI0LjkgOTIgOTIgMCAwIDAgMTguNC0zNi45bC4zLTIuMi44LTIuOGMuMi0xLjkuMi0zIC4yLTQuMmwuOC01LjhxMC00LjYtLjItOG0yLjQtNzkuOGMyLjkgMiA2IDIuMiA3LjgtLjggMS0xLjUuOC01LjItLjItNmE4IDggMCAwIDAtNy0uOWMtMyAxLjQtMyA0LjQtLjYgNy43Ii8+PHBhdGggZmlsbD0iIzgxN2ZlZiIgZD0iTTk0IDEzOGMxMC43IDIgMjEuNCA0LjYgMzIuMiA2IDExLjYgMS41IDIzLjMgMS45IDM1IDIuOHE2LjEuNiAxMi41IDJjLTEuNSAzLjQtLjEgNS4zIDIuMyA2IDIuNi42IDUuNC40IDYuMS0zLjIgMy43IDIuOCA3LjMgNS41IDEwLjkgOS0yLjEgMy4zLTQuNSA2LjItMS4zIDkuMyAzLjEgMyAzLjktMS41IDUuOC0yLjJxLjggMS40IDEuMSAzYy0zLjIgMS01LjYgNC43LTkuMSAycS0uMi42LS44IDEuNGwtNS43IDRjLTE1LTcuNS0zMC40LTQuNi00Ni0yLjctMTYuNyAyLTMzLjMgMS4yLTQ5LjctNC41cS43LTMuMyAxLjYtNS42IDIuMy03LjIgNC4xLTE0LjQuOC0zLjMuOS02Ljd6Ii8+PHBhdGggZmlsbD0iIzgxODJmMCIgZD0iTTExOSA4Ni44cTE5LjIgNC44IDM4LjIgOS45YzkuMiAyLjUgMTguNiA0LjkgMjcuNSA4LjUgOC41IDMuNCAxNC44IDEwIDE5LjEgMTguNHEtNC43IDIuMS04LjcgMy45Yy0yIC45LTQgMi42LTYgMi44LTIuOS4zLTUuOC0uOC04LjctMS0zLjYtLjItOC0xLjgtOS40IDMuOHEtMi42LS4yLTUuNy0xLjEtMy00LjItNC4zIDAtMS42IDAtMy43LS45Yy0uNS00LjItMi44LTQuOC02LjMtNC43bDEuMSA1cS0xMi43LS44LTI1LjYtMi40IDYtNC40IDExLjctNy44Yy00LjYtOS4xLTE1LjItNi40LTIxLjgtMTIuNiA1LjctMS4yIDgtNCA1LTguNC0yLjktNC4zLTIuNC04LjgtMi40LTEzLjRtMzMuNCAxNS40LTEuNi01LTEuMy0uNWMtLjggMi4xLTIuMyA0LjQtMiA2LjQuMiAxLjIgMy4xIDIgNSAyLjguNS4yIDEuNS0uOCAyLjMtMS4ycS0uNy0xLTIuNC0yLjVtNy45LS4xIDEuNS0uMi0uNC0xLjNxLS42LjMtMS4xIDEuNSIvPjxwYXRoIGZpbGw9IiM4MDgwZWYiIGQ9Ik0xMTguMiAxOTIuNnExMi43LTIuNSAyNS40LTQuN2MxMS42LTEuOSAyMy0yIDMzLjggMy45cTYuOSAzLjggOC4yIDExLjFjLjMgMS40LS44IDMuNi0yIDQuNS0yMC41IDE3LjMtNDMuNiAyNC4xLTcwLjMgMTYuNnEuOC0zLjggMi41LTYuMmMxLjctMi4yIDUtMy44IDUuNS02LjIgMS0zLjkgMi40LTYuMiA2LjMtNy4yLjgtLjIgMS4yLTIuMiAxLjctMy40LTEuNC4yLTMgMC00LjIuNi0xLjIuNC0yIDItMyAyLjItOC40IDEuMy0xMi43LTMuMi0xMS4xLTExLjVxLjYtLjEgMiAuNGMyIC4zIDMuNiAwIDUuMi0uMSIvPjxwYXRoIGZpbGw9IiM4MjgxZWYiIGQ9Ik0xMTguOCA4Ni42Yy4yIDQuOC0uMyA5LjMgMi42IDEzLjYgMyA0LjMuNyA3LjItNSA4LjQgNi42IDYuMiAxNy4yIDMuNSAyMS44IDEyLjZsLTEyIDcuNWE2NjYgNjY2IDAgMCAxLTQwLTEwLjhxLS4xLTIuMi40LTMuNCAzLTUgNS43LTEwYzIuNi01LjEgNC4zLTEwLjcgNy42LTE1LjMgMS45LTIuNiA0LjktNC4zIDQuMS04LjJ6Ii8+PHBhdGggZmlsbD0iIzg1N2NlZiIgZD0iTTEwMy42IDgxYzEuMiA0LTEuOCA1LjYtMy43IDguMi0zLjMgNC42LTUgMTAuMi03LjYgMTUuMnEtMi43IDUuMS01LjcgMTAtLjQgMS40LS42IDMuMy0xMi4yLTYtMjQuOC0xMy42IDEuOS01LjYgNC40LTEwLjNsOC41LTE1LjVxMi43LTQuOCA1LTkuNkw5OC43IDc5cTIgLjkgNSAxLjgiLz48cGF0aCBmaWxsPSIjOGI3NGVkIiBkPSJNNzkgNjguNGExMTEgMTExIDAgMCAxLTQuOSA5LjlsLTguNSAxNS41cS0yLjQgNC44LTQuNiAxMC04LjUtNy40LTE3LTE2LjZjLTEuNi01IC45LTguMyAzLTExLjZsMTMuMS0xOS45eiIvPjxwYXRoIGZpbGw9IiM4NTc4ZWUiIGQ9Ik05My42IDEzOHEuNSAzIC4zIDYuMnQtLjkgNi43cS0xLjggNy4yLTQgMTQuNGwtMiA1LjRhNTMgNTMgMCAwIDEtMjUuOS0xMy42cS42LTMuOCAyLTYuNSA1LTkuNSAxMC0xOC45eiIvPjxwYXRoIGZpbGw9IiM3Zjc4ZWUiIGQ9Ik0xMTAuNSAxOTIuMmMtMSA4LjQgMy4yIDEyLjkgMTEuNiAxMS42IDEtLjEgMS44LTEuOCAzLTIuMiAxLjMtLjUgMi44LS40IDQuMi0uNi0uNSAxLjItLjkgMy4yLTEuNyAzLjQtMy45IDEtNS4zIDMuMy02LjMgNy4yLS42IDIuNC0zLjggNC01LjUgNi4ycS0xLjYgMi41LTIuOCA2YTIzMyAyMzMgMCAwIDEtMjMtMTEuNXExLjUtOS43IDMtMTYuOWw2LTMuM3oiLz48cGF0aCBmaWxsPSIjOGM2ZmVjIiBkPSJNNzMgMTMxLjRxLTUgOS44LTEwIDE5LjJjLTEgMS44LTEuNCAzLjktMiA2LjJxLTYuNS02LTEzLTEzLjdjMS02LjIgMi0xMS42IDMuNC0xNy4xcTItMS41IDMuNi0zLjEgOSA0IDE4IDguNSIvPjxwYXRoIGZpbGw9IiM5MTZkZWMiIGQ9Ik02MCA1NS40cS02LjQgMTAuMy0xMyAyMC4yYy0yLjEgMy4zLTQuNiA2LjYtMyAxMS4zcS00LjItNi42LTgtMTQuNSAxLjQtMi40IDIuMS00LjFjMy03LjggNi45LTE0LjcgMTUuNS0xNy40eiIvPjxwYXRoIGZpbGw9IiM4YTc0ZWMiIGQ9Ik05OC42IDE5MnEtMS44IDEuNC01LjcgMy40LTEuNCA3LjItMyAxNi43Yy0xMC02LjEtMTcuMS0xNS0yMy0yNS45eiIvPjxwYXRoIGZpbGw9IiM4MTgyZjAiIGQ9Ik0yMDkgMTM1YTQxIDQxIDAgMCAxIDEgMjcgNTYgNTYgMCAwIDAtMjIuOC0yNC4yYy43LTEuOCAxLjctMy44IDIuNi0zLjhxOS42LjMgMTkuMiAxIi8+PHBhdGggZmlsbD0iIzkxNjNlYyIgZD0iTTUzLjUgNTAuNUM0NSA1My41IDQxIDYwLjUgMzggNjguM3EtLjcgMS44LTIgMy43YTI3IDI3IDAgMCAxLTMtNy43YzEuMS00LjggMy4yLTkuMSAyLjYtMTMuMS0uOC01LjggMS41LTkuOCA0LjItMTQuMXE2LjcgNi40IDEzLjYgMTMuNCIvPjxwYXRoIGZpbGw9IiM5MTY3ZTkiIGQ9Im01MSAxMjYtMyAxNi44YTYxIDYxIDAgMCAxLTEzLTMwLjlsMS0uOXE1LjkgMy42IDExLjggOHoiLz48cGF0aCBmaWxsPSIjN2M3YmVlIiBkPSJNMjA5IDEzNC42Yy02LjQgMC0xMi44LS41LTE5LjItLjYtMSAwLTEuOSAyLTIuOCAzLjVxLTcuNi0xLjYtMTUuNy00LjJjMS01LjggNS41LTQuMiA5LjEtNCAzIC4yIDUuOCAxLjMgOC42IDEgMi4xLS4yIDQtMiA2LTIuOGw4LjktMy42cTIuOSA1IDUuMSAxMC43Ii8+PHBhdGggZmlsbD0iIzdlN2VlZCIgZD0ibTE4OSAxNzQgLjUtMS4zYzMuNSAyLjcgNS45LTEgOS4yLTEuNyAzLjkgNy44IDIuNyAxNS0yIDIyLjVxLTQuNy02LjItOC42LTEyeiIvPjxwYXRoIGZpbGw9IiM5MjYwZWMiIGQ9Ik0zOS44IDM2LjhjLTIuNiA0LjYtNSA4LjYtNC4xIDE0LjQuNiA0LTEuNSA4LjMtMi43IDEyLjdBNzEgNzEgMCAwIDEgMzEuNiAyOHoiLz48cGF0aCBmaWxsPSIjMTExODNiIiBkPSJNMTY5LjYgMjM0LjhhMTIzIDEyMyAwIDAgMSAzLjIgMTEuM2MtNy45IDIuMS0xMS44LjYtMTQuOS02cTUuNi0yLjkgMTEuNy01LjMiLz48cGF0aCBmaWxsPSIjMTExODM4IiBkPSJNMjQyIDQ0Yy0uMiA0LjgtMi41IDUuNy02LjYgNC4yLTIuNy0xLTUuOC0xLjItOC41LTIuMi0xLjgtLjYtMy4zLTItNi0zLjcgMi41LTEgMy42LTEuNCA1LTIuMnE4IDEuNSAxNi4xIDQiLz48cGF0aCBmaWxsPSIjZThlOGVjIiBkPSJNMjUzLjQgMTAwcS01LjQtMTIuMiA1LjMtMjJjLS4zIDItMS4xIDMuOS0xLjUgNS45LS43IDQtMSA4LTEuOCAxMmExMSAxMSAwIDAgMS0yIDQiLz48cGF0aCBmaWxsPSIjODU4NWVlIiBkPSJNMTk3LjQgMTY3LjRjLTEuOCAxLTIuNiA1LjYtNS43IDIuNS0zLjItMy4xLS44LTYgMS40LTlxMi4yIDIuNyA0LjMgNi41Ii8+PHBhdGggZmlsbD0iIzg3ODhmMCIgZD0iTTE4MS45IDE1MS4zYy0uNSAzLjktMy4zIDQuMS01LjkgMy40LTIuNC0uNi0zLjgtMi41LTItNS42cTMuOS43IDcuOSAyLjIiLz48cGF0aCBmaWxsPSIjODU4NWVlIiBkPSJNMTg4LjcgMTc0LjFxMCAzLjMtLjggNy0yLjYtMS4yLTQuNy0yLjggMi40LTIuMiA1LjUtNC4yIi8+PHBhdGggZmlsbD0iIzk0NzJlYiIgZD0iTTUxLjQgMTI2cS0yLTMtMy40LTYuNyAzLjMgMS4yIDYuOCAzLjMtMS4zIDEuOC0zLjQgMy40Ii8+PHBhdGggZmlsbD0iI2U4ZThlYyIgZD0iTTI1OS4zIDExNi45YTEwNiAxMDYgMCAwIDEtNC40LTExLjVxLjctLjUgMS41LS4zYy41LjMgMS4zLjcgMS4zIDEuMnExLjEgNS4yIDEuNiAxMC42TTI1My4xIDE5M3ExLjMtNC43IDMuNi05LjggMy42IDIuNS4yIDUuNGMtMS40IDEuMS0yLjMgMi45LTMuOCA0LjQiLz48cGF0aCBmaWxsPSIjODI4MWVmIiBkPSJNMTUyLjUgMTMxLjVxLS45LTIuMy0xLjUtNWMzLjUtLjIgNS44LjQgNiA0LjVhMTQgMTQgMCAwIDEtNC41LjUiLz48cGF0aCBmaWxsPSIjZTBlMGU0IiBkPSJNMjI3LjUgMTQ2cS43IDMuNi42IDcuNy0uNy0zLjYtLjYtNy42Ii8+PHBhdGggZmlsbD0iI2U4ZThlYyIgZD0iTTI2Ni4zIDc0LjRxMy4xLTEuNSA3LjMtMi41Yy0uNyA0LjgtNC4yIDIuOC03LjMgMi41TTI2Mi41IDEzMC44cS0xLTEuOS0xLjMtNC41IDEuOC4xIDMuNi45eiIvPjxwYXRoIGZpbGw9IiNlMGUwZTQiIGQ9Ik0yMjcgMTYwcS40IDEuNSAwIDMuNy0uMy0xLjYgMC0zLjciLz48cGF0aCBmaWxsPSIjODI4MWVmIiBkPSJNMTYxLjQgMTMyLjJxLjgtNC40IDMuNi0uNGE5IDkgMCAwIDEtMy42LjQiLz48cGF0aCBmaWxsPSIjZTBlMGU0IiBkPSJNMjI2LjcgMTM4LjJxLjcgMSAuOSAyLjZhNSA1IDAgMCAxLTEtMi42Ii8+PHBhdGggZmlsbD0iI2U4ZThlYyIgZD0iTTI1OC42IDE3OXEtLjQtLjcuMi0xLjhsMS44LjZxLS44LjYtMiAxLjIiLz48cGF0aCBmaWxsPSIjN2Y3OGVlIiBkPSJNMTE3LjggMTkyLjVxLTEuOC41LTQuNi4zIDEuOC0uNSA0LjYtLjMiLz48cGF0aCBmaWxsPSIjMjMyNzQxIiBkPSJNMTM2LjggMjQyLjlxLjMuMy4yIDEtLjgtLjEtMS42LS41LjUtLjMgMS40LS41Ii8+PHBhdGggZmlsbD0iI2U4ZThlYyIgZD0iTTI1OS43IDE3NXEtLjMtLjcuMi0xLjguMy43LS4yIDEuOCIvPjxwYXRoIGZpbGw9IiNlMGUwZTQiIGQ9Ik0yMjYgMTY3cS40LjcgMCAxLjgtLjMtLjcgMC0xLjgiLz48cGF0aCBmaWxsPSIjZThlOGVjIiBkPSJNMjYyIDE2NnEtLjQtLjctLjEtMS44LjMuNiAwIDEuOE0yNjMuMSAxNTdxLS4zLS43LS4yLTEuOC40LjYuMiAxLjdNMjYzLjMgMTM3LjlxLS42LS42LS41LTEuNy41LjYuNSAxLjciLz48cGF0aCBmaWxsPSIjZTBlMGU0IiBkPSJNMjI1LjggMTMzLjFxLjYuNi43IDEuNy0uNi0uNi0uNy0xLjciLz48cGF0aCBmaWxsPSIjZThlOGVjIiBkPSJNMjc2IDY1LjZxLTEtLjEtMi4zLTEuMSAxIDAgMi4zIDEiLz48cGF0aCBmaWxsPSIjMTExODNiIiBkPSJNMTc3LjYgMjMwLjhxLS4yLjYtMS40IDEuMS4yLS42IDEuNC0xTTE3NS42IDIzMS45cS0uMi41LTEuNCAxIC4yLS41IDEuNC0xTTE3My42IDIzMi45cTAgLjQtMSAuOCAwLS4zIDEtLjhNMTcxLjcgMjMzLjhxMCAuNC0xLjEgMSAwLS42IDEtMSIvPjxwYXRoIGZpbGw9IiNlNmU3ZWEiIGQ9Ik0yMzAgNjZjLTItMy0yLjEtNiAxLTcuNCAxLjktLjggNS4xLS4zIDYuOSAxIDEgLjcgMS4xIDQuNC4yIDYtMS45IDMtNSAyLjctOCAuNCIvPjxwYXRoIGZpbGw9IiM4MjgxZWYiIGQ9Ik0xNTIuNyAxMDIuM3ExLjQgMS40IDIgMi40Yy0uNy40LTEuNyAxLjQtMi4yIDEuMi0xLjktLjctNC44LTEuNi01LTIuOC0uMy0yIDEuMi00LjMgMi02LjRsMS4zLjVxLjcgMi41IDIgNS4xTTE2MC4yIDEwMS44cS42LS44IDEuMi0xLjJsLjQgMS4zcS0uNy4xLTEuNi0uMSIvPjwvc3ZnPg==';

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
    // Outer wrapper — gradient border via padding trick
    overlayEl = document.createElement('div');
    overlayEl.setAttribute('style', [
      'position:fixed','bottom:24px','right:24px','z-index:2147483647',
      'padding:1.5px','border-radius:16px',
      'background:linear-gradient(135deg,#6366F1,#D946EF)',
      'box-shadow:0 8px 40px rgba(0,0,0,0.4),0 0 24px rgba(99,102,241,0.25)',
      'font:500 13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'min-width:280px','animation:fr-fadein 0.4s cubic-bezier(0.16,1,0.3,1)',
    ].join(';'));
    // Inner dark card
    const inner = document.createElement('div');
    inner.setAttribute('style', [
      'background:#0F142B','border-radius:14.5px','padding:16px 20px','color:#FFFFFF',
    ].join(';'));
    // Header row — bird icon + title + scanning dot
    const header = document.createElement('div');
    header.setAttribute('style', 'display:flex;align-items:center;gap:10px;margin-bottom:12px');
    // Bird icon in a soft gradient circle
    const iconWrap = document.createElement('div');
    iconWrap.setAttribute('style', 'width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(217,70,239,0.1));display:flex;align-items:center;justify-content:center;flex-shrink:0');
    const birdImg = document.createElement('img');
    birdImg.setAttribute('width', '22');
    birdImg.setAttribute('height', '22');
    birdImg.setAttribute('src', BIRD_LOGO_URI);
    iconWrap.appendChild(birdImg);
    const titleCol = document.createElement('div');
    titleCol.setAttribute('style', 'flex:1;min-width:0');
    const title = document.createElement('div');
    title.setAttribute('style', 'font-weight:700;font-size:14px;letter-spacing:-0.01em;color:#fff');
    title.textContent = 'Flock';
    const subtitle = document.createElement('div');
    subtitle.setAttribute('style', 'font-size:11px;color:#667085;margin-top:1px');
    subtitle.textContent = 'Scanning your account';
    titleCol.appendChild(title);
    titleCol.appendChild(subtitle);
    // Pulsing live dot
    const dot = document.createElement('div');
    dot.setAttribute('style', 'width:8px;height:8px;border-radius:50%;background:#34c759;flex-shrink:0;animation:fr-pulse 1.5s ease-in-out infinite');
    header.appendChild(iconWrap);
    header.appendChild(titleCol);
    header.appendChild(dot);
    inner.appendChild(header);
    // Status text
    overlayTextEl = document.createElement('div');
    overlayTextEl.textContent = 'Starting\u2026';
    overlayTextEl.setAttribute('style', 'margin-bottom:12px;font-size:12.5px;color:#EEF0FF;font-variant-numeric:tabular-nums');
    inner.appendChild(overlayTextEl);
    // Progress bar
    const track = document.createElement('div');
    track.setAttribute('style', 'height:4px;background:rgba(99,102,241,0.12);border-radius:2px;overflow:hidden');
    overlayBarEl = document.createElement('div');
    overlayBarEl.setAttribute('style', 'height:100%;width:0%;background:linear-gradient(90deg,#6366F1,#D946EF);border-radius:2px;transition:width 0.4s cubic-bezier(0.16,1,0.3,1)');
    track.appendChild(overlayBarEl);
    inner.appendChild(track);
    overlayEl.appendChild(inner);
    // Inject animations
    const style = document.createElement('style');
    style.textContent = '@keyframes fr-fadein{from{opacity:0;transform:translateY(16px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes fr-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.85)}}';
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
