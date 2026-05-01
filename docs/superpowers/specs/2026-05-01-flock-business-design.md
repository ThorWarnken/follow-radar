# Flock Business - AI-Powered Growth Reports for Businesses

## Overview

Flock Business is a premium tier of Flock that helps businesses grow their Instagram presence and revenue. A business fills out a profile describing who they are, what they do, and what they need help with. They run the same Flock bookmarklet to scan their Instagram. The scan data plus their business profile are sent to Claude API, which generates a professional, actionable growth report with specific recommendations tailored to their business type, target customer, and biggest challenges.

The core value proposition: "A marketing consultant in your browser for $50/month."

## Pricing

| Tier | Price |
|------|-------|
| Monthly | $50/month |
| Yearly | $499/year |

Unlimited scans and report generations. No caps.

## Architecture

### Pages and Files

- `business.html` - standalone page with its own premium design. Landing page, onboarding form, scan results, and report view all in one file (same pattern as `index.html`).
- `b.js` - the existing bookmarklet. No changes needed. It already scrapes followers, following, posts, and mutual counts. It redirects to whatever origin it was loaded from, so when loaded from `business.html`, it redirects back to `business.html#data=...`.
- `worker/src/index.js` - new `/report` endpoint that accepts scan data + business profile, calls Claude API, and returns a structured report.

### Data Flow

1. Business lands on `flockscan.org/business`
2. Creates a business profile (saved to localStorage)
3. Subscribes via Stripe ($50/month or $499/year)
4. Drags the Flock bookmarklet to their bookmarks bar
5. Opens instagram.com, clicks the bookmarklet
6. Bookmarklet scans and redirects to `flockscan.org/business#data=...`
7. `business.html` decodes the scan data
8. Client sends scan data + business profile to worker `/report` endpoint
9. Worker verifies the subscription (same email gate as personal plans)
10. Worker builds a Claude API prompt with all data and sends it
11. Claude returns a structured JSON report
12. Worker returns the report to the client
13. `business.html` renders the report with charts and visualizations
14. Business can download a branded PDF of the full report

### Business Profile (localStorage)

Saved under `flock-business:profile`. Persists across sessions so the business never fills it out twice. Editable anytime.

```json
{
  "businessName": "The Local Kitchen",
  "description": "Farm-to-table restaurant in downtown Gainesville serving locally sourced seasonal dishes",
  "businessType": "Restaurant / Food & Beverage",
  "targetCustomer": "College students and young professionals aged 18-30 who care about sustainable food",
  "marketingGoals": ["More foot traffic", "Promote deals/events", "Grow following"],
  "differentiator": "Only restaurant in Gainesville with a full farm-to-table supply chain. We source from 12 local farms.",
  "customerSources": ["Word of mouth", "Instagram", "Walk-ins"],
  "biggestChallenge": "We can't get people to come in on weekdays. Friday and Saturday are packed but Tuesday through Thursday we're at 40% capacity."
}
```

### Onboarding Form Fields

1. **Business name** - text input
2. **What does your business do?** - text area with placeholder example
3. **Business type** - text input with autocomplete suggestions: Restaurant/Food & Beverage, Retail/E-commerce, Influencer/Content Creator, Local Service, Real Estate, Professional Services, Software/SaaS, Other. Free text accepted for any business type.
4. **Who is your target customer?** - text area
5. **What are your marketing goals?** - multi-select chips: More foot traffic, More online sales, Brand awareness, Land brand deals, Grow following, Promote deals/events, Launch new product, Get more bookings
6. **What makes you different from competitors?** - text area
7. **How do customers find you today?** - multi-select chips: Word of mouth, Instagram, Google, TikTok, Walk-ins, Other social, Paid ads
8. **What is your biggest challenge right now?** - text area

## The Report

The report is the core product. It should feel like receiving a deliverable from a marketing agency.

### Report Sections

#### Header
- Flock Business logo
- Business name, Instagram handle, scan date
- "Download Report" button (PDF)
- "Scan anytime to track your progress"

#### Section 1: Account Health Snapshot
Stat cards showing:
- Follower count
- Following count
- Engagement rate (with industry benchmark comparison)
- Average likes per post
- Average comments per post
- Posts analyzed
- Save rate (if available)
- Post frequency

#### Section 2: Content Performance Analysis
CSS bar charts and data cards:
- Engagement by post type (Reels vs Photos vs Carousels)
- Engagement by day of week
- Engagement by time of day
- Top 3 performing posts with engagement breakdown
- Content type distribution (what % of posts are Reels, Photos, Carousels)
- Caption length impact analysis

#### Section 3: Audience and Reach
- Follower-to-engagement ratio with benchmark for their business type
- Like-to-follower ratio with industry context
- Post frequency vs engagement correlation
- Growth trajectory (engagement trend over analyzed posts)

#### Section 4: Your Growth Playbook (AI-Generated - THE CORE VALUE)

This is the largest and most important section. Generated by Claude API using the full business profile + scan data.

**What's Working** (3-5 items)
Each item backed by specific data from their scan. Not generic praise.

**Opportunities** (5-8 items)
Each is a specific, actionable recommendation with:
- What to do
- Why it matters for THEIR business specifically
- Expected impact on revenue
- How to measure success

**Content Calendar**
A suggested week of posts:
- Day, time, format (Reel/Carousel/Story), topic, and why

**Revenue Levers**
The 3 highest-impact things they can do THIS MONTH to make more money. Specific to their business type, target customer, and challenge.

#### Section 5: Your Action Plan (THE CENTERPIECE)

This is where the business gets the most value. The Action Plan is the section they come back to every week. Every other section exists to support this one.

Each action item is a full card with:

1. **The recommendation** in plain language
2. **Why this matters for YOUR business** - ties directly to their specific challenge, customer, and business type. References their actual data.
3. **What to do** - step-by-step instructions specific enough that someone with no marketing experience can execute
4. **Expected impact** - realistic, grounded in their data. Includes estimated reach, engagement, and where applicable, revenue impact.
5. **How to measure success** - the specific metric to watch and what "good" looks like
6. **Timeline** - when to start, how long to test before evaluating

Action items are ranked by expected revenue impact, not engagement.

**Business-type-specific recommendations:**

- **Restaurant/F&B**: Menu engineering from content performance. Day-of-week promotions for low-traffic days. UGC strategy. Story reservation funnels. Seasonal menu launch playbooks.
- **Influencer/Creator**: Media kit metrics from actual data. Niche positioning strategy. Next deal tier roadmap. Brand outreach templates. Content that attracts sponsors.
- **Retail/E-commerce**: Product content strategy (lifestyle vs catalog). Shopping tag optimization. Drop/launch playbook. Story funnel from poll to purchase. Seasonal promotion calendar.
- **Local Service**: Before/after content cadence. Review funnel from Instagram to Google. Booking optimization. Seasonal service calendar. Client testimonial strategy.
- **Real Estate**: Neighborhood authority content. Lead nurture via Stories. Market update cadence. Listing vs lifestyle content ratio. Open house promotion strategy.
- **Professional Services**: Trust-building content calendar. Educational carousel topics by season. Consultation funnel from saves to DMs. Thought leadership positioning.
- **Software/SaaS**: Tutorial and tip content strategy. Customer proof formats. Product-led vs culture content ratio. Signup funnel optimization. Feature launch playbooks.
- **Other**: General growth strategy based on their description, goals, and data. Applies universal Instagram principles (saves = intent, shares = reach, DMs = purchase signals) to their specific situation.

**Footer of Action Plan:**
"Scan anytime to track your progress. Flock compares your new metrics against previous scans and shows you what improved."

#### Section 6: Competitive Position
- Where they stand relative to benchmarks for their business type
- Engagement rate vs industry average
- Posting frequency vs recommended frequency
- Content mix compared to top performers in their category

### PDF Download

"Download Report" generates a branded PDF including:
- Flock Business header with logo
- All charts rendered as images
- Full Action Plan with all recommendations
- Clean typography, proper page breaks
- Footer: "Generated by Flock Business - flockscan.org/business"

Implementation: Use the browser's print stylesheet or jsPDF for a polished output.

## Worker: /report Endpoint

### Request
```
POST /report
Content-Type: application/json

{
  "email": "owner@thelocalkitchen.com",
  "username": "thelocalkitchen",
  "profile": { ...business profile object... },
  "scan": {
    "followers": [...],
    "following": [...],
    "posts": [...],
    "scrapedAt": "2026-05-01T..."
  }
}
```

### Flow
1. Verify subscription: check KV for active business plan (same pattern as personal verify)
2. Compute metrics from scan data (engagement rate, post type breakdown, time analysis, etc.)
3. Build Claude API prompt with computed metrics + full business profile
4. Call Claude API (claude-sonnet-4-6 for speed + quality balance)
5. Parse Claude's response (structured JSON)
6. Return report to client

### Claude API Prompt Strategy

The prompt includes:
- System prompt establishing Claude as an Instagram growth strategist with deep knowledge of how each business type generates revenue from social media
- The computed metrics (not raw arrays of followers/posts)
- The full business profile
- Instructions to return structured JSON matching the report schema
- Explicit instruction to make every recommendation specific, actionable, and tied to revenue impact
- Industry benchmarks for their business type
- Instruction to reference their specific data points, challenge, and target customer in every recommendation

### Response Schema
```json
{
  "whatsWorking": [
    { "title": "...", "detail": "...", "dataPoint": "..." }
  ],
  "opportunities": [
    { "title": "...", "why": "...", "what": "...", "impact": "...", "metric": "..." }
  ],
  "contentCalendar": [
    { "day": "Monday", "time": "5 PM", "format": "Reel", "topic": "...", "why": "..." }
  ],
  "revenueLevers": [
    { "title": "...", "detail": "...", "estimatedImpact": "..." }
  ],
  "actionPlan": [
    {
      "priority": 1,
      "recommendation": "...",
      "whyItMatters": "...",
      "steps": ["...", "..."],
      "expectedImpact": "...",
      "howToMeasure": "...",
      "timeline": "..."
    }
  ],
  "competitivePosition": {
    "engagementVsBenchmark": "...",
    "frequencyVsRecommended": "...",
    "contentMixAssessment": "...",
    "overallAssessment": "..."
  }
}
```

## Design Language

Flock Business has its own elevated visual identity:

- **Background**: Deeper, richer dark tones. Less purple glow, more matte black with subtle warm accents.
- **Accent color**: Gold/amber (#D4A843) instead of the consumer purple/indigo. Communicates premium.
- **Typography**: Same Nunito/Quicksand family but with more generous spacing, larger sizes, and more whitespace.
- **Cards**: Slightly larger border radius, subtle gold border accents on hover, more padding.
- **Animations**: Slower, more deliberate. Spring animations with higher damping for a sophisticated feel.
- **Charts**: Clean, minimal. Thin lines, subtle grid, gold accent bars.
- **Overall feel**: Think "private banking app" not "social media tool."

The main Flock homepage gets a "For Business" button in the nav that links to `/business`.

## Subscription Verification

Same pattern as personal plans:
- New Stripe products/prices for Business Monthly ($50) and Business Yearly ($499)
- Payment links with "Allow promotion codes" enabled
- Webhook handler stores plan as `business-monthly` or `business-yearly` in KV
- `/verify` endpoint checks for business plan type
- `/report` endpoint also verifies before calling Claude API

## Progress Tracking

When a business scans again, the report includes a "Changes Since Last Scan" section at the top:
- Follower growth
- Engagement rate change
- Which Action Plan items they appear to have executed (based on content pattern changes)

Previous scan data stored in localStorage under `flock-business:history` as an array of timestamped snapshots.

## What This Does NOT Include

- No mobile app
- No real-time monitoring or alerts
- No competitor account scraping (only the business's own account)
- No direct posting or scheduling
- No CRM or customer database
- No multi-user team access (single login via email)

## Build Phases

**Phase 1: Landing page + onboarding + payment**
- `business.html` with premium landing page
- Business profile onboarding form with localStorage persistence
- Stripe payment links for $50/month and $499/year
- "For Business" button on main Flock homepage
- Bookmarklet works from business.html

**Phase 2: Report engine + rendering**
- Worker `/report` endpoint
- Claude API integration with business-specific prompt
- Report rendering in business.html with all 6 sections
- CSS charts and data visualizations
- Action Plan cards with full detail

**Phase 3: PDF + progress tracking**
- PDF download with branded layout and charts
- Scan history in localStorage
- "Changes Since Last Scan" comparison section
- Profile editing
