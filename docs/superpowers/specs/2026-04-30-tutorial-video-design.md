# Tutorial Video — Hybrid Animated Explainer

## Overview

A 40-45 second tutorial video built with Remotion (React). Hybrid style: branded animated graphics for intro/outro, simulated browser mockups for the walkthrough steps. Background music. Hosted on the site for new visitors.

## Scenes

### Scene 1 — Branded Intro (0-5s)
- Dark gradient background matching the site (purple/indigo radial)
- Flock bird logo scales in with a spring animation
- Text fades in below: "See who doesn't follow you back"
- Subtle particle/glow effect behind logo

### Scene 2 — Drag the Bookmarklet (6-14s)
- Simulated browser chrome (address bar showing flockscan.org, bookmarks bar)
- Simplified mockup of the Flock landing page with the "Flock" bookmarklet button visible
- Animated cursor drags the button up to the bookmarks bar
- Button settles into the bar with a satisfying bounce
- Text overlay: "Drag to your bookmarks bar"

### Scene 3 — Click on Instagram (15-22s)
- Browser address bar changes to instagram.com
- Simplified IG feed mockup (generic placeholder posts, IG-style layout)
- Cursor moves to bookmarks bar and clicks "Flock"
- Flock overlay appears on the page: progress bar + "Scanning..."
- Text overlay: "Click it on Instagram"

### Scene 4 — Results (23-32s)
- Browser redirects back to flockscan.org
- Results view appears: 4 stat cards animate up with count-up effect
- Brief scroll through a few unfollower cards (gradient avatars, usernames)
- 10k+ accounts shown at bottom with gray badge
- Text overlay: "See your results instantly"

### Scene 5 — Growth Analytics (33-40s)
- Cursor clicks the "Potential Growth" tab (PRO badge visible)
- Growth analytics cards animate in: engagement rate, best time to post, engagement trend
- One card expands to show the bar chart detail view
- Text overlay: "Unlock growth analytics"

### Scene 6 — Outro (40-45s)
- Fade to branded gradient background
- Bird logo centered
- Text: "flockscan.org"
- Subtitle: "Try it free"
- Logo and text fade out

## Visual Style

- **Background:** Dark gradient matching site (warm cream undertones in browser mockups, dark for branded scenes)
- **Fonts:** Nunito for headings, Quicksand for body — same as the site
- **Colors:** Instagram brand palette (#f77737 orange, #e1306c pink, #833ab4 purple) plus site indigo
- **Animations:** Spring-based (not linear), matching the site's `--bounce` easing
- **Browser mockup:** Simplified chrome — just address bar + bookmarks bar, rounded corners, dark theme
- **Cursor:** macOS-style pointer, smooth bezier movement between targets

## Audio

- Lo-fi/ambient background music, upbeat but not distracting
- No voiceover
- Royalty-free

## Technical

- Built with Remotion (React)
- 1920x1080, 30fps
- Output: MP4
- Rendered locally, exported as a static file to embed on the site
- No new dependencies added to the main project — Remotion project lives in a separate directory

## What This Does NOT Include

- Voiceover or narration
- Real Instagram screenshots (all simulated/mockup)
- Sound effects
- Mobile-specific tutorial
