# Flock Business Interactive Tutorial Page -- Design Spec

## Overview

A single-file interactive marketing page (`tutorial.html`) that functions as a guided product demo for Flock Business. All data is mocked but designed to feel real. Every section follows a hook-question -> data-reveal -> cost-callout -> CTA pattern to build urgency and convert visitors.

This is a standalone marketing asset, not part of the core product flow. It links out to `business.html` for the actual bookmarklet/scan flow.

## Design Approach

**Hybrid editorial**: Uses Flock Business color tokens (gold/dark palette) but with a more editorial layout -- bigger type, full-bleed sections, generous whitespace. Stays within CLAUDE.md constraints: Nunito + Quicksand fonts, no emojis (SVG icons only), no Inter, no glassmorphism, no build step, vanilla JS.

**Interaction model**: Scroll-triggered reveal with pause points. Sections animate in via Intersection Observer. Key numbers (counters, cost callouts) use count-up animations that fire once when visible. Section 5 (Revenue Gap Calculator) is fully interactive with live-updating sliders/dropdowns. Everything else is scroll-driven.

## Technical Constraints

- Single HTML file: `tutorial.html` in project root
- No build step, no npm, no frameworks
- Chart.js via CDN (https://cdn.jsdelivr.net/npm/chart.js)
- All JS inline
- All icons are inline SVGs (no emojis)
- Mobile responsive (stack to single column at 768px)
- `prefers-reduced-motion` respected: counters show final values immediately, chart animations disabled, pulse animations disabled
- Google Fonts: Nunito (headings) + Quicksand (body)

## Design Tokens

Inherited from Flock Business (`business.html`):

```
--bg: #08080f
--bg-card: #12121f
--border: #1e1e30
--gold: #D4A843
--gold-bg: rgba(212,168,67,0.08)
--gold-border: rgba(212,168,67,0.15)
--gradient-gold: linear-gradient(135deg,#D4A843,#C49530)
--text: #FFFFFF
--text-soft: #d0d0e0
--text-muted: #6b6b80
--radius: 12px
--radius-lg: 16px
--radius-xl: 24px
--radius-pill: 100px
--shadow-sm: 0 2px 8px rgba(0,0,0,0.3)
--shadow-md: 0 4px 20px rgba(0,0,0,0.4)
--shadow-lg: 0 8px 40px rgba(0,0,0,0.5)
--shadow-gold: 0 4px 24px rgba(212,168,67,0.2)
--font: 'Nunito', sans-serif
--font-body: 'Quicksand', sans-serif
--ease: cubic-bezier(0.16,1,0.3,1)
```

Additional tokens for this page:

```
--cost-red: #e85454 (cost callout accent)
--cost-red-bg: rgba(232,84,84,0.08)
--gain-green: #4ade80 (positive delta)
--section-gap: 120px (vertical spacing between sections on desktop, 80px mobile)
```

## Page Structure

### Navigation
- Fixed top bar, dark (#08080f) with 80% opacity backdrop-blur
- Left: Flock gold logo (embedded base64 PNG) + "Flock" text + gold "BUSINESS" badge
- Right: single CTA button "Start Free Scan" linking to business.html
- Height: 64px

### Hero Section
- Full viewport height, centered text
- Small gold badge above headline: "PRODUCT TOUR"
- Headline (Nunito 800, clamp 2.5-4rem): "Your Instagram is leaving money on the table."
- Subtitle (Quicksand 500, --text-soft): "We analyzed 2,400 business accounts. Here's what they all have in common."
- Scroll indicator: animated down-chevron SVG at bottom of viewport
- No background shader (keep page lightweight; shader is for business.html)

### Section 1: Audience Health Check

**Headline:** "What if a third of your audience is dead weight?"

**Layout:** Two-column on desktop (chart left, stats right), stacked on mobile.

**Left column:** Donut chart (Chart.js, doughnut type) showing:
- Real Followers: 66% (gold segment)
- Ghost Followers: 34% (--cost-red segment, subtle pulse glow via CSS box-shadow animation)

Chart center text: "8,184 real" in gold (counts up from 0).

**Right column:** Two stat blocks stacked:
- Block 1: Label "Reported Engagement Rate" -> value "1.2%" (counts up, white text)
- Block 2: Label "Adjusted for Ghosts" -> value "1.8%" (counts up, gold text, larger)
- Small annotation: "Your real rate is higher than you think -- but Instagram doesn't know that."

**Cost callout card:** Full-width below the two columns. Dark card (--bg-card) with --cost-red left border (4px).
- Text: "With 12,400 followers, 4,216 are ghosts dragging your engagement rate down. Instagram's algorithm sees 1.2% engagement and buries your posts. At $18 CPM, that's roughly **$340/mo in reach you're paying for but never getting.**"
- Dollar amount rendered large and in --cost-red.

**CTA:** Gold outline button, subtle pulse: "See your real audience health"

### Section 2: Post Graveyard

**Headline:** "What if you knew which posts were dead before you hit publish?"

**Layout:** Horizontal bar chart (Chart.js, horizontal bar) showing 3 bars:
- Reels: 3,200 avg reach (gold bar)
- Carousels: 1,800 avg reach (--text-muted bar)
- Static Images: 420 avg reach (--cost-red bar, barely visible)

Below chart: a 14-cell grid (7x2) of small squares (48x48px). Each represents a post from the mock month.
- 5 cells: subtle gold border glow, small Reel/Carousel icon
- 9 cells: dim overlay (#08080f at 70% opacity), small custom skull-crossbones SVG, "< 500 reach" label in --text-muted

**Cost callout card:** --cost-red left border.
- Text: "You posted 14 times last month. 9 were static images that reached fewer than 500 people each. If those had been Reels, you'd have reached an additional ~25,200 people. At $18 CPM, that's **$453 left on the table.**"

**CTA:** "Stop guessing. See what's working."

### Section 3: Posting Time Intelligence

**Headline:** "What if you've been posting when nobody's watching?"

**Layout:** CSS grid heatmap, 7 columns (Mon-Sun) x 6 rows (representing 4-hour blocks: 12am-4am, 4am-8am, 8am-12pm, 12pm-4pm, 4pm-8pm, 8pm-12am). Simplify to 6 time blocks rather than 24 hours for readability on mobile.

Each cell: small rounded rect, background color intensity mapped to audience activity (transparent -> gold at varying opacity 0.05 to 0.5). Peak cells (Tue/Thu/Sun 4pm-8pm block) have brightest gold.

Overlay: small white dot markers on cells where mock user posted (clustered in Mon-Fri 8am-12pm block).

Column and row labels in --text-muted, small font.

Below heatmap: side-by-side comparison cards:
- Left card: "You post at" -> "10:00 AM weekdays" (white text)
- Right card: "They're online at" -> "7:00 PM Tue, Thu, Sun" (gold text)
- Between them: a horizontal arrow SVG with "4 hours off peak" label in --cost-red

**Cost callout card:** --cost-red left border.
- Text: "Posts published off-peak reach 40-60% fewer people. Across 14 posts last month, that's roughly 18,000 missed impressions -- **$324 in invisible reach.**"

**CTA:** "Find your real peak hours."

### Section 4: Follower Momentum

**Headline:** "What if your growth stalled and you didn't even notice?"

**Layout:** Line chart (Chart.js, line type) showing follower count over 90 days. Y-axis: follower count (~12,000-12,400 range). X-axis: day labels (every 15 days).

The line generally trends up. Two annotation points rendered as custom HTML elements positioned via chart plugin or absolute-positioned divs:
- Day ~30: Red dot + callout label: "3 static posts in a row -> +47 unfollows"
- Day ~65: Red dot + callout label: "No posts for 8 days -> -32 followers"
- Day ~45-55 (steepest growth): Green dot + callout label: "5 Reels in 10 days -> +189 followers"

Below chart: three mini stat cards in a horizontal row:
- "Net growth: +214" (gold text)
- "Hidden unfollows: -79" (--cost-red text)
- "Growth velocity: 2.4/day" (--text-muted, small note: "below avg for your niche")

**Cost callout card:** --cost-red left border.
- Text: "Those 79 unfollows weren't random -- they correlated with your lowest-performing content. Every unfollow lowers your engagement rate, which lowers your reach, which lowers your next post's performance. It compounds."
- No specific dollar amount here -- the compounding framing is the punch.

**CTA:** "See what's driving your unfollows."

### Section 5: Revenue Gap Calculator

**Headline:** "How much is your Instagram actually leaving on the table?"

**Layout:** Full-width dark card with gold border glow (box-shadow: var(--shadow-gold)). Generous padding (48px desktop, 24px mobile).

**Input controls:**

1. **Follower count** -- HTML range slider (1,000 to 500,000, step 1,000) with a synced number `<input>` beside it. Default: 12,000. Slider track styled gold.
2. **Niche** -- `<select>` dropdown. Options with hidden CPM values:
   - Fashion ($22), Fitness ($18), Food ($15), Beauty ($28), Travel ($20), Tech ($35), Business/Finance ($45), Lifestyle ($16), Other ($12)
3. **Posts per month** -- range slider (1 to 60, step 1). Default: 12.

All inputs update output in real-time via `input` event listeners.

**Output (live-updating):**

Two large numbers side-by-side (stacked on mobile):
- Left: "Current estimated reach value" -> "$XXX/mo" (--text-muted, normal weight)
- Right: "Optimized reach value" -> "$X,XXX/mo" (gold, bold, larger)

Below: large delta number with subtle pulse animation:
- "You're leaving **$XXX/mo** on the table" (--cost-red, large font)
- Under that: "That's **$X,XXX/year**" (--text-muted, smaller)

**Math (shown in collapsible details/summary element: "How we calculate this"):**
- Current monthly reach value = followers x 0.15 (avg reach rate) x posts x CPM / 1000
- Optimized monthly reach value = followers x 0.35 (optimized reach rate) x posts x CPM / 1000
- Delta = optimized - current
- Annual = delta x 12

**CTA:** Full-width gold gradient button with pulse animation: "Get Your Personalized Revenue Report"

### Section 6: How the Bookmarklet Works

**Headline:** "One click. No passwords. No installs. No data stored."

**Layout:** Three cards in a horizontal row (stacked on mobile). Each card:
- Large circled number (1, 2, 3) in gold, 48px
- Custom SVG icon (32x32), gold stroke
- Bold title (Nunito 700)
- Short description (Quicksand 400, --text-soft)

**Card 1:**
- Icon: Bookmark SVG (rectangle with folded corner)
- Title: "Drag to your bookmarks bar"
- Description: "One-time setup. Takes 3 seconds."

**Card 2:**
- Icon: Instagram-style camera SVG
- Title: "Visit Instagram and click it"
- Description: "Flock reads your session in your own browser. No passwords leave your device. Ever."

**Card 3:**
- Icon: Bar chart with upward arrow SVG
- Title: "Get your AI growth report"
- Description: "Personalized playbook: what to post, when to post, and how to turn followers into revenue."

**Trust strip:** Single horizontal row of 4 items (wraps on mobile), each with a small checkmark SVG icon in gold:
- "No password required"
- "No app to install"
- "Nothing stored on our servers"
- "Works in 60 seconds"

**Final CTA:** Full-width, gold gradient background, large text (Nunito 800, 20px), pulse animation: "Start Your Free Scan". Links to `business.html`.

### Footer
- Simple dark strip, centered
- Gold Flock Business logo (small, embedded base64)
- "flockscan.org/business" in --text-muted
- Minimal padding

## Animation Behavior

**Scroll reveals:** Each section starts with `opacity: 0; transform: translateY(40px)`. Intersection Observer (threshold 0.15) adds a `.visible` class that transitions to `opacity: 1; transform: translateY(0)` over 0.6s with var(--ease).

**Count-up counters:** Numbers animate from 0 to target over 1.5s using requestAnimationFrame. Triggered once when the containing section becomes visible. Dollar values include `$` prefix and comma formatting. Percentages include `%` suffix.

**Chart animations:** Chart.js built-in animation (1s duration) triggered by drawing the chart when its section enters the viewport. Charts are created lazily (not on page load).

**Pulse CTA:** `@keyframes pulse` -- subtle box-shadow oscillation on the gold CTA buttons (shadow-gold opacity 0.2 -> 0.5 -> 0.2, 2s infinite).

**Revenue calculator:** Output numbers use a fast count-up (0.4s) on each input change to feel snappy.

**prefers-reduced-motion:** All animations disabled. Counters show final values immediately. Charts render without animation. Pulse keyframes disabled. Sections start visible (no scroll reveal).

## Responsive Breakpoints

- Desktop (>1024px): Two-column layouts, horizontal card rows, full heatmap
- Tablet (768-1024px): Two-column layouts compress, cards stack to 2-wide
- Mobile (<768px): Single column everything, full-width cards, heatmap simplifies to 7x6 but smaller cells, sliders full-width

## File Location

`/Users/thorwarnken/Projects/follow-radar/tutorial.html` -- single file in project root, consistent with `index.html` and `business.html`.

## Links and Navigation

- All CTAs within sections scroll to Section 6 (bookmarklet explainer) OR link to `business.html`
- Final CTA links to `business.html`
- Nav CTA links to `business.html`
- No internal routing, no hash-based navigation

## Out of Scope

- No actual data fetching or API calls
- No payment flow
- No bookmarklet functionality (that lives in business.html)
- No backend interaction
- No user authentication
