# CLAUDE.md — Follow Radar

## Project overview
Follow Radar is a single-file, client-side web app that tells Instagram users who doesn't follow them back. No backend, no login, no data leaves the browser. Privacy is load-bearing — never add a server component.

## File structure
```
follow-radar/
├── CLAUDE.md          # This file — project context for Claude Code
├── index.html         # The entire app (~775 lines, single file, no build step)
├── test_followers_1.json   # Test data Format A (top-level array, 8 accounts)
└── test_following.json     # Test data Format B (keyed object, 10 accounts)
```

## Tech stack
- **Single HTML file** — vanilla JS, no frameworks, no build tools, no bundler
- **JSZip** via CDN (`cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`) for client-side .zip extraction
- **WebGL shader background** — purple/indigo plasma lines at opacity 0.18 (vanilla JS port)
- **Google Fonts**: Nunito (display headings) + Quicksand (body text)
- **Virtual scrolling** — 64px row height, 15-row buffer, kicks in above 200 results

## How it works
1. User taps button → opens Instagram's "Download Your Information" page
2. User requests Followers + Following as JSON → receives a .zip via email
3. User uploads the .zip (or individual .json files) to the drop zone
4. JSZip extracts JSON client-side, parser handles both Instagram JSON formats
5. Computes: `following − followers = not following back`
6. Results: stat cards, searchable/sortable list with virtual scrolling, CSV export

## Instagram JSON formats (both must be supported)
- **Format A**: top-level array `[{string_list_data: [{value, href, timestamp}]}]`
- **Format B**: keyed object `{relationships_followers: [...], relationships_following: [...]}`
- Auto-detects followers vs following by: filename → key structure → parse attempt

## Design system — DO NOT DEVIATE
- **Instagram brand palette**: `#f77737` orange, `#e1306c` pink, `#833ab4` purple
- Clean gray background (`#f5f5f7`), white cards, subtle shadows
- Gender-neutral aesthetic — NOT feminine/pastel, NOT generic AI aesthetic
- **Banned**: Inter font, purple-only gradients outside IG palette, glassmorphism, emojis
- Mobile-first: separate `.drop-desktop` / `.drop-mobile` text classes, large touch targets, single-column
- `prefers-reduced-motion` respected (shader hidden, animations disabled)

## Copy tone
Sophisticated, non-suspicious framing:
- "instagram's built-in feature" (not "export your data")
- "get your follower list" (not "download your data")
- "run the check" / "here's what we found"
- **No emojis anywhere** — all icons are custom animated inline SVGs

## 8 custom SVG icons (replacing former emoji spots)
1. Hero — person silhouette with IG gradient + radar-ping rings
2. Scroll hint — chevron with bounce animation
3. Step 1 — Instagram camera/profile icon, breathing pulse
4. Step 2 — package/box icon (purple), breathing pulse
5. Drop zone — file with upload arrow, float animation
6. Analyze button — inline magnifying glass
7. Results section — bar chart + trend line (orange), breathing pulse
8. Empty state — shield with checkmark, stroke-dashoffset draw animation

## Results view features
- 4 stat cards with animated count-up (followers / following / not following back / mutuals)
- Debounced search (150ms)
- Sort: recent / oldest / alphabetical
- CSV export: username, profile URL, follow date, days since follow (UTF-8 BOM)
- Virtual scrolling above 200 items
- Per-row: gradient avatar initial, username → IG profile link, relative + absolute date, external link icon

## Visual guide / walkthrough
Collapsible toggle showing a fake iPhone UI cycling through 4 steps:
Accounts Center → Download info → Some of your information → check Followers/Following + JSON
Auto-advances every 3.5s, dots are clickable. All walkthrough icons are inline SVGs.

## Hard rules — NEVER violate these
1. **No emojis** — every icon is a custom SVG
2. **No backend** — everything runs client-side; privacy story is the selling point
3. **No username-based scanning** — Instagram Basic Display API is dead (Dec 2024), Graph API only returns counts. The official data export is the only legitimate path.
4. **No generic AI aesthetics** — no Inter, no glassmorphism, no purple-only gradients
5. **Single file** — no build step, no framework, no npm
6. **Stop and check** — before making changes, show the plan. One command per block. Confirm before executing.

## Workflow preferences (for Claude Code sessions)
- Use PowerShell as terminal environment
- Explicit stop-and-check points before modifying code
- One command per block
- When editing: show the specific lines being changed and what they become
- Preserve existing working code — don't refactor unless asked
- Test with both Format A and Format B JSON files after any parser changes
