# Flock Business Phase 1 - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Flock Business landing page with premium design, onboarding form, Stripe payment integration, and bookmarklet support so businesses can subscribe and run scans.

**Architecture:** `business.html` is a standalone page following the same single-file pattern as `index.html`. It shares the existing bookmarklet (`b.js`), bird logo, and Cloudflare Worker. The worker gets updated to handle business-tier subscription plans. Business profile data persists in localStorage.

**Tech Stack:** Vanilla HTML/CSS/JS (same as `index.html`), Stripe Payment Links, Cloudflare Worker (KV store), Google Fonts (Nunito + Quicksand)

**Spec:** `docs/superpowers/specs/2026-05-01-flock-business-design.md`

---

### Task 1: Create business.html with premium shell and navigation

**Files:**
- Create: `business.html`

- [ ] **Step 1: Create the HTML boilerplate with premium CSS variables**

Create `business.html` with the full `<head>`, premium CSS custom properties (gold accent #D4A843, deeper dark tones), and the nav bar with "Back to Flock" link.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Flock Business - AI-Powered Growth Reports for Instagram</title>
<meta name="description" content="Professional Instagram growth reports for businesses. AI-powered recommendations to increase revenue.">
<link rel="icon" type="image/svg+xml" href="bird-logo.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#08080f;
  --bg-alt:#0d0d18;
  --bg-card:#12121f;
  --bg-card-hover:rgba(212,168,67,0.04);
  --border:#1e1e30;
  --border-hover:rgba(212,168,67,0.25);
  --text:#FFFFFF;
  --text-soft:#E8E4D9;
  --text-muted:#8A8673;
  --gold:#D4A843;
  --gold-soft:#E8C76A;
  --gold-bg:rgba(212,168,67,0.08);
  --gold-border:rgba(212,168,67,0.15);
  --gradient-gold:linear-gradient(135deg,#D4A843,#C49530);
  --gradient-premium:linear-gradient(135deg,#D4A843,#E8C76A);
  --radius:12px;
  --radius-lg:16px;
  --radius-xl:24px;
  --radius-pill:100px;
  --shadow-sm:0 2px 8px rgba(0,0,0,0.3);
  --shadow-md:0 4px 20px rgba(0,0,0,0.4);
  --shadow-lg:0 8px 40px rgba(0,0,0,0.5);
  --shadow-gold:0 4px 24px rgba(212,168,67,0.15);
  --font:'Nunito',sans-serif;
  --font-body:'Quicksand',sans-serif;
  --ease:cubic-bezier(0.16,1,0.3,1);
  --bounce:cubic-bezier(0.34,1.2,0.64,1);
}
html{scroll-behavior:smooth;background:var(--bg)}
body{
  font-family:var(--font-body);font-weight:400;color:var(--text);
  line-height:1.7;overflow-x:hidden;-webkit-font-smoothing:antialiased;
  background:var(--bg);
}

/* Navigation */
.nav{position:fixed;top:0;left:0;right:0;z-index:1000;padding:1rem 2rem;display:flex;align-items:center;justify-content:space-between;background:rgba(8,8,15,0.85);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.04)}
.nav-logo{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--text);font-family:var(--font);font-weight:800;font-size:1.2rem}
.nav-logo img{width:28px;height:28px}
.nav-badge{font-size:0.6rem;font-weight:700;color:var(--gold);background:var(--gold-bg);border:1px solid var(--gold-border);padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:0.1em}
.nav-links{display:flex;align-items:center;gap:2rem}
.nav-links a{color:var(--text-muted);text-decoration:none;font-size:0.85rem;font-weight:600;transition:color 0.2s}
.nav-links a:hover{color:var(--text)}
.nav-cta{padding:8px 20px;border-radius:var(--radius-pill);background:var(--gradient-gold);color:#000;font-weight:700;font-size:0.82rem;text-decoration:none;transition:opacity 0.2s}
.nav-cta:hover{opacity:0.9;color:#000}

/* Sections */
section{max-width:1100px;margin:0 auto;padding:6rem 1.5rem}
.section-badge{display:inline-block;font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:5px 14px;border-radius:var(--radius-pill)}
.badge-gold{color:var(--gold);background:var(--gold-bg);border:1px solid var(--gold-border)}
</style>
</head>
<body>

<nav class="nav">
  <a href="business.html" class="nav-logo">
    <img src="bird-logo.svg" alt="Flock">
    Flock
    <span class="nav-badge">Business</span>
  </a>
  <div class="nav-links">
    <a href="index.html">Personal</a>
    <a href="#pricing">Pricing</a>
    <a href="#get-started" class="nav-cta">Get Started</a>
  </div>
</nav>

</body>
</html>
```

- [ ] **Step 2: Verify the page loads in browser**

Run: `open /Users/thorwarnken/Projects/follow-radar/business.html`
Expected: Dark page with gold-accented nav bar, "Flock Business" logo, links.

- [ ] **Step 3: Commit**

```bash
git add business.html
git commit -m "feat: create business.html with premium shell and nav"
```

---

### Task 2: Build the hero section

**Files:**
- Modify: `business.html`

- [ ] **Step 1: Add hero CSS and HTML after the nav**

Add these styles inside `<style>`:

```css
/* Hero */
.hero{padding-top:10rem;padding-bottom:6rem;text-align:center;position:relative}
.hero::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:800px;height:600px;background:radial-gradient(ellipse,rgba(212,168,67,0.06) 0%,transparent 70%);pointer-events:none}
.hero h1{font-family:var(--font);font-weight:900;font-size:3.2rem;letter-spacing:-0.03em;line-height:1.15;max-width:700px;margin:0 auto 1.2rem}
.hero h1 strong{background:var(--gradient-premium);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero .subtitle{font-size:1.1rem;color:var(--text-muted);max-width:560px;margin:0 auto 2.5rem;line-height:1.7;font-weight:500}
.hero-cta{display:inline-flex;align-items:center;gap:10px;padding:16px 40px;border-radius:var(--radius-pill);background:var(--gradient-gold);color:#000;font-family:var(--font);font-weight:800;font-size:1.05rem;text-decoration:none;box-shadow:var(--shadow-gold);transition:transform 0.3s var(--bounce),box-shadow 0.3s}
.hero-cta:hover{transform:scale(1.03);box-shadow:0 8px 40px rgba(212,168,67,0.25);color:#000}
.hero-cta svg{width:18px;height:18px}
.hero-trust{margin-top:1.5rem;display:flex;align-items:center;justify-content:center;gap:8px;color:var(--text-muted);font-size:0.82rem;font-weight:600}
.hero-trust svg{width:16px;height:16px;color:var(--gold)}
```

Add this HTML after `</nav>`:

```html
<section class="hero">
  <div class="section-badge badge-gold">For Businesses</div>
  <h1>Turn your Instagram into a <strong>revenue engine</strong>.</h1>
  <p class="subtitle">AI-powered growth reports that tell you exactly what to post, when to post, and how to turn followers into paying customers.</p>
  <a href="#get-started" class="hero-cta">
    Start Growing
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
  </a>
  <div class="hero-trust">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    Unlimited scans and reports. Cancel anytime.
  </div>
</section>
```

- [ ] **Step 2: Verify hero renders correctly**

Open `business.html` in browser. Expected: gold gradient heading, centered layout, premium CTA button.

- [ ] **Step 3: Commit**

```bash
git add business.html
git commit -m "feat: add premium hero section to business page"
```

---

### Task 3: Build the value proposition section

**Files:**
- Modify: `business.html`

- [ ] **Step 1: Add feature cards CSS and HTML**

Add these styles:

```css
/* Features */
.features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;margin-top:2rem}
@media(max-width:768px){.features-grid{grid-template-columns:1fr}}
.feature-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:2rem;transition:border-color 0.3s,transform 0.3s var(--bounce)}
.feature-card:hover{border-color:var(--border-hover);transform:translateY(-4px)}
.feature-icon{width:48px;height:48px;border-radius:12px;background:var(--gold-bg);border:1px solid var(--gold-border);display:flex;align-items:center;justify-content:center;margin-bottom:1.2rem}
.feature-icon svg{width:24px;height:24px;stroke:var(--gold)}
.feature-card h3{font-family:var(--font);font-weight:700;font-size:1.05rem;margin-bottom:0.5rem}
.feature-card p{color:var(--text-muted);font-size:0.88rem;line-height:1.7}
```

Add this HTML after the hero section:

```html
<section class="features" id="features">
  <div style="text-align:center;margin-bottom:1rem">
    <div class="section-badge badge-gold">Why Flock Business</div>
  </div>
  <h2 style="text-align:center;font-family:var(--font);font-weight:800;font-size:2rem;margin-bottom:0.5rem;letter-spacing:-0.02em">Your AI marketing consultant.</h2>
  <p style="text-align:center;color:var(--text-muted);font-size:1rem;max-width:500px;margin:0 auto 2rem">Every scan generates a professional report with actionable steps to grow your revenue.</p>
  <div class="features-grid">
    <div class="feature-card">
      <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
      <h3>Growth Playbook</h3>
      <p>Get a prioritized action plan ranked by revenue impact. Not generic tips. Specific steps for your business type, audience, and goals.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
      <h3>Content Calendar</h3>
      <p>A full week of posts planned for you. What to post, when, and why. Based on when your audience is most active and what content performs best.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
      <h3>Revenue Levers</h3>
      <p>The 3 highest-impact things you can do this month to make more money. Tied to your data, your industry, and your biggest challenge.</p>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Verify features section renders**

- [ ] **Step 3: Commit**

```bash
git add business.html
git commit -m "feat: add value proposition features section"
```

---

### Task 4: Build the pricing section

**Files:**
- Modify: `business.html`

- [ ] **Step 1: Add pricing CSS and HTML**

Add styles:

```css
/* Pricing */
.pricing-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1.5rem;max-width:700px;margin:2rem auto 0}
@media(max-width:600px){.pricing-grid{grid-template-columns:1fr}}
.pricing-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-xl);padding:2.5rem;text-align:center;text-decoration:none;color:var(--text);transition:border-color 0.3s,transform 0.3s var(--bounce)}
.pricing-card:hover{border-color:var(--border-hover);transform:translateY(-4px)}
.pricing-card.featured{border-color:var(--gold-border);background:linear-gradient(180deg,rgba(212,168,67,0.04) 0%,var(--bg-card) 100%)}
.pricing-card .plan-name{font-family:var(--font);font-weight:700;font-size:1.1rem;margin-bottom:0.5rem}
.pricing-card .price{font-family:var(--font);font-weight:900;font-size:3rem;letter-spacing:-0.03em;margin-bottom:0.25rem}
.pricing-card .price span{font-size:1rem;font-weight:600;color:var(--text-muted)}
.pricing-card .plan-sub{color:var(--text-muted);font-size:0.85rem;margin-bottom:1.5rem}
.pricing-card .plan-cta{display:block;padding:12px 28px;border-radius:var(--radius-pill);font-family:var(--font);font-weight:700;font-size:0.9rem;text-decoration:none;transition:opacity 0.2s}
.pricing-card .plan-cta{background:var(--gradient-gold);color:#000}
.pricing-card .plan-cta:hover{opacity:0.9}
.pricing-card .best-value{display:inline-block;font-size:0.65rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;background:var(--gradient-gold);color:#000;padding:3px 10px;border-radius:var(--radius-pill);margin-bottom:0.8rem}
.plan-features{list-style:none;text-align:left;margin:1.5rem 0;display:flex;flex-direction:column;gap:0.6rem}
.plan-features li{display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-soft)}
.plan-features li svg{width:16px;height:16px;stroke:var(--gold);flex-shrink:0}
```

Add HTML after features section. Use placeholder hrefs for now (we'll add real Stripe links before launch):

```html
<section class="pricing" id="pricing">
  <div style="text-align:center;margin-bottom:1rem">
    <div class="section-badge badge-gold">Pricing</div>
  </div>
  <h2 style="text-align:center;font-family:var(--font);font-weight:800;font-size:2rem;margin-bottom:0.5rem;letter-spacing:-0.02em">Invest in your growth.</h2>
  <p style="text-align:center;color:var(--text-muted);font-size:1rem;max-width:480px;margin:0 auto">Unlimited scans. Unlimited reports. Cancel anytime.</p>
  <div class="pricing-grid">
    <a class="pricing-card" id="biz-pay-monthly" href="javascript:void(0)" target="_blank" rel="noopener">
      <div class="plan-name">Monthly</div>
      <div class="price">$50<span>/mo</span></div>
      <div class="plan-sub">Billed monthly</div>
      <ul class="plan-features">
        <li><svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Unlimited AI growth reports</li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Personalized action plans</li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Content calendar</li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>PDF report downloads</li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Progress tracking</li>
      </ul>
      <div class="plan-cta">Get Started</div>
    </a>
    <a class="pricing-card featured" id="biz-pay-yearly" href="javascript:void(0)" target="_blank" rel="noopener">
      <div class="best-value">Save $101/year</div>
      <div class="plan-name">Yearly</div>
      <div class="price">$499<span>/yr</span></div>
      <div class="plan-sub">$41.58/month, billed annually</div>
      <ul class="plan-features">
        <li><svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Everything in Monthly</li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Save $101 vs monthly</li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Priority support</li>
      </ul>
      <div class="plan-cta">Get Started</div>
    </a>
  </div>
</section>
```

- [ ] **Step 2: Verify pricing section renders**

- [ ] **Step 3: Commit**

```bash
git add business.html
git commit -m "feat: add business pricing section with $50/mo and $499/yr"
```

---

### Task 5: Build the onboarding form

**Files:**
- Modify: `business.html`

- [ ] **Step 1: Add form CSS**

```css
/* Onboarding Form */
.onboard{display:none}
.onboard.show{display:block}
.onboard-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-xl);padding:3rem;max-width:700px;margin:0 auto}
.onboard-card h2{font-family:var(--font);font-weight:800;font-size:1.8rem;margin-bottom:0.5rem;letter-spacing:-0.02em}
.onboard-card .onboard-sub{color:var(--text-muted);font-size:0.95rem;margin-bottom:2.5rem}
.form-group{margin-bottom:2rem}
.form-group label{display:block;font-family:var(--font);font-weight:700;font-size:0.9rem;margin-bottom:0.5rem;color:var(--text-soft)}
.form-group .form-hint{font-size:0.78rem;color:var(--text-muted);margin-bottom:0.5rem}
.form-input{width:100%;padding:12px 16px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-alt);color:var(--text);font:inherit;font-size:0.9rem;outline:none;transition:border-color 0.2s}
.form-input:focus{border-color:var(--gold-border)}
textarea.form-input{min-height:80px;resize:vertical}
.form-chips{display:flex;flex-wrap:wrap;gap:8px}
.form-chip{padding:8px 16px;border-radius:var(--radius-pill);border:1px solid var(--border);background:none;color:var(--text-muted);font:inherit;font-size:0.82rem;font-weight:600;cursor:pointer;transition:all 0.2s}
.form-chip.selected{background:var(--gold-bg);border-color:var(--gold-border);color:var(--gold)}
.form-chip:hover:not(.selected){border-color:rgba(255,255,255,0.15);color:var(--text-soft)}
.form-submit{display:block;width:100%;padding:14px;border:none;border-radius:var(--radius-pill);background:var(--gradient-gold);color:#000;font-family:var(--font);font-weight:800;font-size:1rem;cursor:pointer;transition:opacity 0.2s;margin-top:1rem}
.form-submit:hover{opacity:0.9}
.type-suggestions{position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);margin-top:4px;z-index:10;display:none;max-height:200px;overflow-y:auto}
.type-suggestions.show{display:block}
.type-suggestion{padding:10px 16px;cursor:pointer;font-size:0.88rem;color:var(--text-soft);transition:background 0.15s}
.type-suggestion:hover{background:var(--gold-bg);color:var(--gold)}
```

- [ ] **Step 2: Add form HTML**

Add this as a new section after pricing. It starts hidden and is shown by JS when the user clicks "Get Started":

```html
<section class="onboard" id="get-started">
  <div class="onboard-card">
    <div class="section-badge badge-gold" style="margin-bottom:1rem">Your Profile</div>
    <h2>Tell us about your business.</h2>
    <p class="onboard-sub">This helps us generate reports tailored to your specific situation. You can update this anytime.</p>

    <div class="form-group">
      <label>Business name</label>
      <input class="form-input" id="biz-name" type="text" placeholder="The Local Kitchen">
    </div>

    <div class="form-group">
      <label>What does your business do?</label>
      <div class="form-hint">Describe what you offer and where you're based.</div>
      <textarea class="form-input" id="biz-desc" placeholder="We're a farm-to-table restaurant in downtown Gainesville serving locally sourced seasonal dishes."></textarea>
    </div>

    <div class="form-group" style="position:relative">
      <label>Business type</label>
      <div class="form-hint">Type your business category or pick from suggestions.</div>
      <input class="form-input" id="biz-type" type="text" placeholder="Restaurant / Food & Beverage" autocomplete="off">
      <div class="type-suggestions" id="type-suggestions">
        <div class="type-suggestion">Restaurant / Food & Beverage</div>
        <div class="type-suggestion">Retail / E-commerce</div>
        <div class="type-suggestion">Influencer / Content Creator</div>
        <div class="type-suggestion">Local Service</div>
        <div class="type-suggestion">Real Estate</div>
        <div class="type-suggestion">Professional Services</div>
        <div class="type-suggestion">Software / SaaS</div>
        <div class="type-suggestion">Other</div>
      </div>
    </div>

    <div class="form-group">
      <label>Who is your target customer?</label>
      <div class="form-hint">Describe your ideal customer in detail.</div>
      <textarea class="form-input" id="biz-target" placeholder="College students and young professionals aged 18-30 who care about sustainable food and dining experiences."></textarea>
    </div>

    <div class="form-group">
      <label>What are your marketing goals?</label>
      <div class="form-chips" id="biz-goals">
        <button class="form-chip" type="button">More foot traffic</button>
        <button class="form-chip" type="button">More online sales</button>
        <button class="form-chip" type="button">Brand awareness</button>
        <button class="form-chip" type="button">Land brand deals</button>
        <button class="form-chip" type="button">Grow following</button>
        <button class="form-chip" type="button">Promote deals/events</button>
        <button class="form-chip" type="button">Launch new product</button>
        <button class="form-chip" type="button">Get more bookings</button>
      </div>
    </div>

    <div class="form-group">
      <label>What makes you different from competitors?</label>
      <textarea class="form-input" id="biz-diff" placeholder="Only restaurant in Gainesville with a full farm-to-table supply chain. We source from 12 local farms."></textarea>
    </div>

    <div class="form-group">
      <label>How do customers find you today?</label>
      <div class="form-chips" id="biz-sources">
        <button class="form-chip" type="button">Word of mouth</button>
        <button class="form-chip" type="button">Instagram</button>
        <button class="form-chip" type="button">Google</button>
        <button class="form-chip" type="button">TikTok</button>
        <button class="form-chip" type="button">Walk-ins</button>
        <button class="form-chip" type="button">Other social</button>
        <button class="form-chip" type="button">Paid ads</button>
      </div>
    </div>

    <div class="form-group">
      <label>What is your biggest challenge right now?</label>
      <div class="form-hint">Be specific. The more detail, the better your report will be.</div>
      <textarea class="form-input" id="biz-challenge" placeholder="We can't get people to come in on weekdays. Friday and Saturday are packed but Tuesday through Thursday we're at 40% capacity."></textarea>
    </div>

    <button class="form-submit" id="biz-save" type="button">Save Profile and Continue</button>
  </div>
</section>
```

- [ ] **Step 3: Commit**

```bash
git add business.html
git commit -m "feat: add business onboarding form with premium styling"
```

---

### Task 6: Add form JavaScript (localStorage persistence, chips, suggestions)

**Files:**
- Modify: `business.html`

- [ ] **Step 1: Add the JavaScript before `</body>`**

```html
<script>
(function() {
  'use strict';

  var PROFILE_KEY = 'flock-business:profile';

  // ── Chip toggles ──
  document.querySelectorAll('.form-chips').forEach(function(container) {
    container.querySelectorAll('.form-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        this.classList.toggle('selected');
      });
    });
  });

  // ── Business type suggestions ──
  var typeInput = document.getElementById('biz-type');
  var suggestionsEl = document.getElementById('type-suggestions');
  if (typeInput && suggestionsEl) {
    typeInput.addEventListener('focus', function() { suggestionsEl.classList.add('show'); });
    typeInput.addEventListener('blur', function() { setTimeout(function() { suggestionsEl.classList.remove('show'); }, 150); });
    suggestionsEl.querySelectorAll('.type-suggestion').forEach(function(s) {
      s.addEventListener('click', function() {
        typeInput.value = this.textContent;
        suggestionsEl.classList.remove('show');
      });
    });
    typeInput.addEventListener('input', function() {
      var q = this.value.toLowerCase();
      suggestionsEl.querySelectorAll('.type-suggestion').forEach(function(s) {
        s.style.display = s.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }

  // ── Get selected chips ──
  function getSelectedChips(containerId) {
    var chips = [];
    document.querySelectorAll('#' + containerId + ' .form-chip.selected').forEach(function(c) {
      chips.push(c.textContent);
    });
    return chips;
  }

  // ── Set selected chips ──
  function setSelectedChips(containerId, values) {
    document.querySelectorAll('#' + containerId + ' .form-chip').forEach(function(c) {
      if (values.indexOf(c.textContent) !== -1) c.classList.add('selected');
      else c.classList.remove('selected');
    });
  }

  // ── Save profile ──
  function saveProfile() {
    var profile = {
      businessName: document.getElementById('biz-name').value.trim(),
      description: document.getElementById('biz-desc').value.trim(),
      businessType: document.getElementById('biz-type').value.trim(),
      targetCustomer: document.getElementById('biz-target').value.trim(),
      marketingGoals: getSelectedChips('biz-goals'),
      differentiator: document.getElementById('biz-diff').value.trim(),
      customerSources: getSelectedChips('biz-sources'),
      biggestChallenge: document.getElementById('biz-challenge').value.trim(),
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  }

  // ── Load profile ──
  function loadProfile() {
    try {
      var raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e) { return null; }
  }

  // ── Restore profile into form ──
  function restoreForm(profile) {
    if (!profile) return;
    document.getElementById('biz-name').value = profile.businessName || '';
    document.getElementById('biz-desc').value = profile.description || '';
    document.getElementById('biz-type').value = profile.businessType || '';
    document.getElementById('biz-target').value = profile.targetCustomer || '';
    setSelectedChips('biz-goals', profile.marketingGoals || []);
    document.getElementById('biz-diff').value = profile.differentiator || '';
    setSelectedChips('biz-sources', profile.customerSources || []);
    document.getElementById('biz-challenge').value = profile.biggestChallenge || '';
  }

  // ── Show onboarding section ──
  function showOnboarding() {
    document.getElementById('get-started').classList.add('show');
    setTimeout(function() {
      document.getElementById('get-started').scrollIntoView({behavior:'smooth', block:'start'});
    }, 100);
  }

  // ── Init ──
  var saved = loadProfile();
  if (saved) restoreForm(saved);

  // "Get Started" / CTA clicks show the form
  document.querySelectorAll('a[href="#get-started"]').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      showOnboarding();
    });
  });

  // Save button
  var saveBtn = document.getElementById('biz-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      var profile = saveProfile();
      if (!profile.businessName) {
        alert('Please enter your business name.');
        return;
      }
      // Show bookmarklet section
      document.getElementById('biz-scan-section').classList.add('show');
      document.getElementById('biz-scan-section').scrollIntoView({behavior:'smooth', block:'start'});
    });
  }

})();
</script>
```

- [ ] **Step 2: Verify form works**

Open `business.html`, click "Get Started", fill out the form, click "Save Profile and Continue". Reload the page and click "Get Started" again - form should be pre-filled.

- [ ] **Step 3: Commit**

```bash
git add business.html
git commit -m "feat: add form JS with localStorage persistence, chip toggles, type suggestions"
```

---

### Task 7: Add bookmarklet section and scan data handling

**Files:**
- Modify: `business.html`

- [ ] **Step 1: Add bookmarklet section HTML and CSS**

Add CSS:

```css
/* Bookmarklet */
.biz-scan{display:none;text-align:center}
.biz-scan.show{display:block}
.biz-scan-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-xl);padding:3rem;max-width:600px;margin:0 auto}
.biz-bm-button{display:inline-flex;align-items:center;gap:10px;padding:16px 40px;border-radius:var(--radius-pill);background:var(--gradient-gold);color:#000;font-family:var(--font);font-weight:800;font-size:1.05rem;text-decoration:none;box-shadow:var(--shadow-gold);cursor:grab;user-select:none;-webkit-user-drag:element;transition:transform 0.3s var(--bounce)}
.biz-bm-button:hover{transform:scale(1.04)}
.biz-bm-button:active{cursor:grabbing}
```

Add HTML after the onboarding form section:

```html
<section class="biz-scan" id="biz-scan-section">
  <div class="biz-scan-card">
    <div class="section-badge badge-gold" style="margin-bottom:1rem">Step 2</div>
    <h2 style="font-family:var(--font);font-weight:800;font-size:1.8rem;margin-bottom:0.5rem">Scan your Instagram.</h2>
    <p style="color:var(--text-muted);font-size:0.95rem;margin-bottom:2rem;max-width:400px;margin-left:auto;margin-right:auto">Drag this button to your bookmarks bar, then click it on your Instagram profile page.</p>
    <a class="biz-bm-button" id="biz-bm-link" href="javascript:void(0)">
      <img src="bird-logo.svg" alt="" width="20" height="20" style="pointer-events:none">
      Flock Business
    </a>
    <p style="color:var(--text-muted);font-size:0.78rem;margin-top:1.5rem">Scan anytime to track your progress.</p>
  </div>
</section>
```

- [ ] **Step 2: Add bookmarklet href and scan data handler to the JS**

Add this inside the `(function() { ... })()` block, after the existing init code:

```javascript
  // ── Bookmarklet setup ──
  var bmLink = document.getElementById('biz-bm-link');
  var bmCode = document.getElementById('biz-bm-code');
  if (bmLink) {
    // Same bookmarklet as personal Flock but loads from this page's origin
    bmLink.href = "javascript:(()=>{if(!/(^|\\.)instagram\\.com$/.test(location.hostname)){alert('Open instagram.com first, then click this bookmarklet.');return}fetch('https://flockscan.org/b.js?v='+Date.now()).then(r=>r.text()).then(eval).catch(e=>alert('Could not load Flock: '+e.message))})()";
  }

  // ── Handle scan data from bookmarklet redirect ──
  async function handleScanData() {
    var hash = window.location.hash || '';
    if (hash.indexOf('#data=') !== 0) return;

    var encoded = hash.slice(6);
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch(e) {}

    // Decode the payload (same logic as index.html)
    var payload;
    try {
      var tag = encoded.slice(0,2);
      var body = encoded.slice(2);
      var bytes = Uint8Array.from(atob(body), function(c) { return c.charCodeAt(0); });
      var raw;
      if (tag === 'g:') {
        var ds = new DecompressionStream('gzip');
        var stream = new Blob([bytes]).stream().pipeThrough(ds);
        var buf = await new Response(stream).arrayBuffer();
        raw = new Uint8Array(buf);
      } else {
        raw = bytes;
      }
      payload = JSON.parse(new TextDecoder().decode(raw));
    } catch(e) {
      alert('Could not read scan results: ' + e.message);
      return;
    }

    // Save scan data
    localStorage.setItem('flock-business:scan', JSON.stringify({
      username: payload.username || '',
      followers: payload.followers,
      following: payload.following,
      posts: payload.posts || [],
      partial: !!payload.partial,
      scannedAt: Date.now(),
    }));

    // Show a temporary "scan complete" message
    // (Phase 2 will replace this with the full report)
    alert('Scan complete for @' + (payload.username || 'unknown') + '. ' + payload.followers.length + ' followers, ' + payload.following.length + ' following, ' + (payload.posts || []).length + ' posts analyzed. Report generation coming in Phase 2.');
  }

  handleScanData();
```

- [ ] **Step 3: Verify bookmarklet link is set and scan handler works**

- [ ] **Step 4: Commit**

```bash
git add business.html
git commit -m "feat: add bookmarklet section and scan data handler"
```

---

### Task 8: Add "For Business" button to main Flock homepage

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add a "For Business" link in the nav**

Find the nav links in `index.html` (around line 861-867) and add a "For Business" link:

In the `.nav-links` div, add before the "Get Started" CTA:

```html
<a href="business.html" style="color:#D4A843;font-weight:700">For Business</a>
```

- [ ] **Step 2: Verify link appears in nav and works**

- [ ] **Step 3: Commit**

```bash
git add index.html business.html
git commit -m "feat: add 'For Business' link to main Flock nav"
```

---

### Task 9: Update worker for business subscription plans

**Files:**
- Modify: `worker/src/index.js`

- [ ] **Step 1: Update handleCheckoutCompleted to detect business plans**

In `handleCheckoutCompleted`, update the subscription plan detection logic. Business monthly is $50 (5000 cents), business yearly is $499 (49900 cents). Add these above the existing threshold checks:

```javascript
  } else if (mode === 'subscription') {
    const amountTotal = session.amount_total || 0;
    if (amountTotal >= 40000) {
      plan = 'business-yearly';
      expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
      ttl = 365 * 86400;
    } else if (amountTotal >= 4000) {
      plan = 'business-monthly';
      expiresAt = Date.now() + 31 * 24 * 60 * 60 * 1000;
      ttl = 31 * 86400;
    } else if (amountTotal >= 2000) {
      plan = 'yearly';
      expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
      ttl = 365 * 86400;
    } else {
      plan = 'monthly';
      expiresAt = Date.now() + 31 * 24 * 60 * 60 * 1000;
      ttl = 31 * 86400;
    }
  }
```

- [ ] **Step 2: Update handleVerify to return business plan types**

No changes needed to `handleVerify` - it already returns `plan` from the KV record, which will now include `business-monthly` and `business-yearly`.

- [ ] **Step 3: Deploy worker**

```bash
cd worker && wrangler deploy
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.js
git commit -m "feat: add business plan detection to worker webhook handler"
```

---

### Task 10: Final integration and push

**Files:**
- Modify: `business.html`

- [ ] **Step 1: Add email verification gate to business.html**

Add an email verification section (same pattern as personal Flock's growth gate) that shows after the profile is saved. The user enters their email to verify their business subscription before scanning.

Add HTML before the bookmarklet section:

```html
<section class="onboard" id="biz-verify-section">
  <div class="onboard-card" style="max-width:500px;text-align:center">
    <div class="section-badge badge-gold" style="margin-bottom:1rem">Verify Subscription</div>
    <h2 style="font-size:1.5rem">Enter your email to continue.</h2>
    <p class="onboard-sub">Use the email associated with your Flock Business subscription.</p>
    <input class="form-input" id="biz-email" type="email" placeholder="you@business.com" style="text-align:center;max-width:320px;margin:0 auto 1rem">
    <button class="form-submit" id="biz-verify-btn" type="button" style="max-width:320px;margin:0 auto">Verify</button>
    <div id="biz-verify-error" style="color:#EF4444;font-size:0.82rem;margin-top:0.8rem;display:none"></div>
  </div>
</section>
```

Add JS for the verify button (inside the IIFE):

```javascript
  var verifyBtn = document.getElementById('biz-verify-btn');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async function() {
      var email = document.getElementById('biz-email').value.trim().toLowerCase();
      var errEl = document.getElementById('biz-verify-error');
      if (!email || email.indexOf('@') === -1) {
        errEl.textContent = 'Please enter a valid email address.';
        errEl.style.display = 'block';
        return;
      }
      verifyBtn.textContent = 'Checking...';
      verifyBtn.disabled = true;
      errEl.style.display = 'none';
      try {
        var r = await fetch('https://flock-payments.warnkenc.workers.dev/verify?email=' + encodeURIComponent(email));
        var result = await r.json();
        if (result && result.unlocked && (result.plan === 'business-monthly' || result.plan === 'business-yearly')) {
          localStorage.setItem('flock-business:email', email);
          document.getElementById('biz-verify-section').classList.remove('show');
          document.getElementById('biz-scan-section').classList.add('show');
          document.getElementById('biz-scan-section').scrollIntoView({behavior:'smooth', block:'start'});
        } else {
          errEl.textContent = 'No active business subscription found for this email. Subscribe above to get started.';
          errEl.style.display = 'block';
        }
      } catch(e) {
        errEl.textContent = 'Could not verify. Please try again.';
        errEl.style.display = 'block';
      }
      verifyBtn.textContent = 'Verify';
      verifyBtn.disabled = false;
    });
  }
```

Update the save button handler to show verify section instead of scan section:

```javascript
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      var profile = saveProfile();
      if (!profile.businessName) {
        alert('Please enter your business name.');
        return;
      }
      // Check if already verified
      var savedEmail = localStorage.getItem('flock-business:email');
      if (savedEmail) {
        document.getElementById('biz-scan-section').classList.add('show');
        document.getElementById('biz-scan-section').scrollIntoView({behavior:'smooth', block:'start'});
      } else {
        document.getElementById('biz-verify-section').classList.add('show');
        document.getElementById('biz-verify-section').scrollIntoView({behavior:'smooth', block:'start'});
      }
    });
  }
```

- [ ] **Step 2: Add footer**

```html
<footer style="text-align:center;padding:4rem 1.5rem 2rem;color:var(--text-muted);font-size:0.78rem">
  <p>Flock Business by <a href="index.html" style="color:var(--gold);text-decoration:none">Flock</a></p>
</footer>
```

- [ ] **Step 3: Test the full flow**

1. Open `business.html`
2. Click "Get Started"
3. Fill out the form
4. Click "Save Profile and Continue"
5. Verify section appears
6. Reload page - form should be pre-filled

- [ ] **Step 4: Commit and push**

```bash
git add business.html index.html worker/src/index.js
git commit -m "feat: complete Flock Business Phase 1 - landing, onboarding, payment, verification"
git push
```
