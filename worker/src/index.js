// Flock Payments — Cloudflare Worker
// Handles Stripe webhook events and payment verification.
// KV store: email (lowercase) → JSON {plan, expiresAt, stripeCustomerId}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (url.pathname === '/webhook' && request.method === 'POST') {
        return await handleWebhook(request, env, corsHeaders);
      }
      if (url.pathname === '/verify' && request.method === 'GET') {
        return await handleVerify(url, env, corsHeaders);
      }
      if (url.pathname === '/report' && request.method === 'POST') {
        return await handleReport(request, env, corsHeaders);
      }
      return json({ error: 'not found' }, 404, corsHeaders);
    } catch (err) {
      console.error('Unhandled error:', err);
      return json({ error: 'internal error' }, 500, corsHeaders);
    }
  },
};

// ─── Stripe webhook ────────────────────────────────────────────

async function handleWebhook(request, env, corsHeaders) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: 'missing signature or secret' }, 400, corsHeaders);
  }

  // Verify Stripe webhook signature
  const event = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!event) {
    return json({ error: 'invalid signature' }, 400, corsHeaders);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object, env);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    default:
      // Ignore other event types
      break;
  }

  return json({ received: true }, 200, corsHeaders);
}

async function handleCheckoutCompleted(session, env) {
  const email = (session.customer_email || session.customer_details?.email || '').toLowerCase().trim();
  if (!email) {
    console.error('No email found in checkout session:', session.id);
    return;
  }

  const mode = session.mode; // 'payment' or 'subscription'
  let plan, expiresAt, ttl;

  if (mode === 'payment') {
    // One-time scan purchase
    plan = 'scan';
    expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    ttl = 86400; // KV TTL in seconds
  } else if (mode === 'subscription') {
    // Use amount_subtotal (before discounts) so promo codes don't break plan detection.
    // Thresholds sit between price tiers: monthly $99 (9900c), yearly $799 (79900c),
    // personal yearly ~$20-50 range. Business yearly must be > 50000c ($500).
    const amountTotal = session.amount_subtotal || session.amount_total || 0;
    if (amountTotal >= 50000) {
      // $799/yr business yearly (79900 cents)
      plan = 'business-yearly';
      expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
      ttl = 365 * 86400;
    } else if (amountTotal >= 7000) {
      // $99/mo business monthly (9900 cents)
      plan = 'business-monthly';
      expiresAt = Date.now() + 31 * 24 * 60 * 60 * 1000;
      ttl = 31 * 86400;
    } else if (amountTotal >= 1500) {
      // Personal yearly (assumed $20-50 range)
      plan = 'yearly';
      expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
      ttl = 365 * 86400;
    } else {
      plan = 'monthly';
      expiresAt = Date.now() + 31 * 24 * 60 * 60 * 1000;
      ttl = 31 * 86400;
    }
  } else {
    console.error('Unknown checkout mode:', mode);
    return;
  }

  const value = {
    plan,
    expiresAt,
    stripeCustomerId: session.customer || null,
    sessionId: session.id,
    createdAt: Date.now(),
  };

  await env.FLOCK_PAYMENTS.put(email, JSON.stringify(value), { expirationTtl: ttl });
  console.log('Stored payment for', email, plan, 'expires', new Date(expiresAt).toISOString());
}

async function handleSubscriptionDeleted(subscription, env) {
  // Subscription cancelled — find the email via customer ID and let access run until expiresAt
  // We don't revoke immediately; the KV TTL handles natural expiry
  // But we log it for visibility
  console.log('Subscription deleted:', subscription.id, 'customer:', subscription.customer);
}

async function handleSubscriptionUpdated(subscription, env) {
  // If subscription status changes to past_due or unpaid, we could revoke
  // For now, we let the KV TTL handle expiry naturally
  if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
    console.log('Subscription past_due/unpaid:', subscription.id);
  }
}

// ─── Verify endpoint ───────────────────────────────────────────

async function handleVerify(url, env, corsHeaders) {
  const email = (url.searchParams.get('email') || '').toLowerCase().trim();
  const username = (url.searchParams.get('username') || '').toLowerCase().trim();

  if (!email) {
    return json({ error: 'email required' }, 400, corsHeaders);
  }

  const raw = await env.FLOCK_PAYMENTS.get(email);
  if (!raw) {
    return json({ unlocked: false }, 200, corsHeaders);
  }

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return json({ unlocked: false }, 200, corsHeaders);
  }

  // Check if the unlock has expired
  if (record.expiresAt && Date.now() > record.expiresAt) {
    await env.FLOCK_PAYMENTS.delete(email);
    return json({ unlocked: false }, 200, corsHeaders);
  }

  // For monthly/yearly subscriptions, lock to one Instagram account
  if (record.plan === 'monthly' || record.plan === 'yearly') {
    if (username) {
      if (!record.igUsername) {
        // First scan — bind this subscription to this Instagram account
        record.igUsername = username;
        const remainingTtl = Math.max(60, Math.floor((record.expiresAt - Date.now()) / 1000));
        await env.FLOCK_PAYMENTS.put(email, JSON.stringify(record), { expirationTtl: remainingTtl });
      } else if (record.igUsername !== username) {
        // Different Instagram account — deny access
        return json({
          unlocked: false,
          error: 'This subscription is linked to @' + record.igUsername,
          linkedUsername: record.igUsername,
        }, 200, corsHeaders);
      }
    }
  }

  return json({
    unlocked: true,
    plan: record.plan,
    expiresAt: record.expiresAt,
    igUsername: record.igUsername || null,
  }, 200, corsHeaders);
}

// ─── Report endpoint ──────────────────────────────────────────

async function handleReport(request, env, corsHeaders) {
  // 1. Parse and validate request
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400, corsHeaders);
  }

  const { email, profile, scan } = body;
  if (!email || !profile || !scan) {
    return json({ error: 'email, profile, and scan are required' }, 400, corsHeaders);
  }

  // 2. Verify subscription
  const normalizedEmail = email.toLowerCase().trim();
  const raw = await env.FLOCK_PAYMENTS.get(normalizedEmail);
  if (!raw) {
    return json({ error: 'no active subscription found' }, 403, corsHeaders);
  }

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid subscription record' }, 403, corsHeaders);
  }

  if (record.expiresAt && Date.now() > record.expiresAt) {
    return json({ error: 'subscription expired' }, 403, corsHeaders);
  }

  if (record.plan !== 'business-monthly' && record.plan !== 'business-yearly') {
    return json({ error: 'business plan required' }, 403, corsHeaders);
  }

  // 3. Compute metrics from scan data
  let metrics;
  try {
    metrics = computeMetrics(scan);
  } catch (e) {
    console.error('computeMetrics error:', e.message, JSON.stringify(scan).slice(0, 500));
    return json({ error: 'Failed to compute metrics: ' + e.message }, 500, corsHeaders);
  }

  // 4. Build prompt and call Claude API
  const systemPrompt = `You are an expert Instagram growth strategist who helps businesses increase their revenue through social media. You analyze Instagram data and generate specific, actionable recommendations tailored to each business's type, audience, and challenges.

Your recommendations must be:
- Specific to this business (reference their data, their type, their challenge)
- Actionable (step-by-step, not vague advice)
- Tied to revenue impact (not just engagement)
- Realistic and grounded in their actual metrics

Return your response as valid JSON matching the exact schema provided. Do not include any text outside the JSON.`;

  const userPrompt = buildUserPrompt(profile, metrics);

  if (!env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return json({ error: 'API key not configured' }, 500, corsHeaders);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API error:', response.status, errText);
      // Surface the actual API error for debugging
      let detail = '';
      try { detail = JSON.parse(errText).error?.message || errText.slice(0, 200); } catch(e) { detail = errText.slice(0, 200); }
      return json({ error: 'AI report generation failed (status ' + response.status + '): ' + detail }, 502, corsHeaders);
    }

    const result = await response.json();
    const textContent = result.content?.[0]?.text;
    if (!textContent) {
      console.error('Claude API returned no text content');
      return json({ error: 'AI returned empty response' }, 502, corsHeaders);
    }

    // Extract JSON from Claude's response (handle markdown code fences and whitespace)
    let report;
    try {
      let jsonStr = textContent.trim();
      // Remove markdown code fences if present
      const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();
      report = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse Claude JSON response:', e.message, textContent.slice(0, 200));
      return json({ error: 'AI returned invalid JSON' }, 502, corsHeaders);
    }

    return json({ success: true, metrics, report }, 200, corsHeaders);
  } catch (err) {
    console.error('Claude API request failed:', err);
    return json({ error: 'AI report generation failed' }, 502, corsHeaders);
  }
}

function computeMetrics(scan) {
  // Scan data arrives pre-aggregated from the client.
  // Map the client shape to the metrics shape used by buildUserPrompt and the response.
  var typeNames = { 'photo': 'Photo', 'video': 'Reel', 'carousel': 'Carousel' };
  var postTypeBreakdown = {};
  var breakdown = scan.post_type_breakdown || {};
  for (var key in breakdown) {
    var displayName = typeNames[key] || key;
    postTypeBreakdown[displayName] = { count: breakdown[key], avgEngagement: 0 };
  }

  var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var bestDays = scan.best_posting_days || {};
  var engagementByDayOfWeek = dayNames.map(function(day) {
    return { day: day, avgEngagement: bestDays[day] || 0, postCount: 0 };
  });

  var bestHours = scan.best_posting_hours || {};
  var engagementByHour = Object.keys(bestHours)
    .map(function(h) { return { hour: parseInt(h), avgEngagement: bestHours[h] || 0, postCount: 0 }; })
    .sort(function(a, b) { return a.hour - b.hour; });

  var bestHourEntry = engagementByHour.length > 0
    ? engagementByHour.reduce(function(best, cur) { return cur.avgEngagement > best.avgEngagement ? cur : best; })
    : null;
  var bestDayEntry = engagementByDayOfWeek.reduce(function(best, cur) {
    return cur.avgEngagement > best.avgEngagement ? cur : best;
  });

  return {
    followerCount: scan.follower_count || 0,
    followingCount: scan.following_count || 0,
    postsAnalyzed: scan.total_posts_scanned || 0,
    avgLikes: scan.avg_likes_per_post || 0,
    avgComments: scan.avg_comments_per_post || 0,
    engagementRate: scan.engagement_rate || 0,
    likeToFollowerRatio: scan.follower_count > 0
      ? Math.round((scan.avg_likes_per_post / scan.follower_count) * 10000) / 100
      : 0,
    postTypeBreakdown: postTypeBreakdown,
    engagementByDayOfWeek: engagementByDayOfWeek,
    engagementByHour: engagementByHour,
    bestPostingTime: bestHourEntry ? bestHourEntry.hour : null,
    bestPostingDay: bestDayEntry.avgEngagement > 0 ? bestDayEntry.day : null,
    postFrequency: 0,
    engagementTrend: 0,
    captionAnalysis: { short: { count: 0, avgEngagement: 0 }, long: { count: 0, avgEngagement: 0 } },
    topPosts: [],
  };
}

function buildUserPrompt(profile, metrics) {
  return `Analyze this Instagram business account and generate a detailed growth report.

BUSINESS PROFILE:
- Business Name: ${profile.businessName}
- Description: ${profile.description}
- Business Type: ${profile.businessType}
- Target Customer: ${profile.targetCustomer}
- Marketing Goals: ${(profile.marketingGoals || []).join(', ')}
- Differentiator: ${profile.differentiator}
- Customer Sources: ${(profile.customerSources || []).join(', ')}
- Biggest Challenge: ${profile.biggestChallenge}

ACCOUNT METRICS:
- Followers: ${metrics.followerCount}
- Following: ${metrics.followingCount}
- Posts Analyzed: ${metrics.postsAnalyzed}
- Average Likes per Post: ${metrics.avgLikes}
- Average Comments per Post: ${metrics.avgComments}
- Engagement Rate: ${metrics.engagementRate}%
- Like-to-Follower Ratio: ${metrics.likeToFollowerRatio}%
- Post Frequency: ${metrics.postFrequency} posts/week
- Engagement Trend (older vs newer posts): ${metrics.engagementTrend > 0 ? '+' : ''}${metrics.engagementTrend}%
- Best Posting Day: ${metrics.bestPostingDay || 'N/A'}
- Best Posting Hour (UTC): ${metrics.bestPostingTime !== null ? metrics.bestPostingTime + ':00' : 'N/A'}

POST TYPE BREAKDOWN:
${JSON.stringify(metrics.postTypeBreakdown, null, 2)}

ENGAGEMENT BY DAY OF WEEK:
${JSON.stringify(metrics.engagementByDayOfWeek, null, 2)}

ENGAGEMENT BY HOUR:
${JSON.stringify(metrics.engagementByHour, null, 2)}

CAPTION ANALYSIS:
- Short captions (<100 chars): ${metrics.captionAnalysis.short.count} posts, avg engagement ${metrics.captionAnalysis.short.avgEngagement}
- Long captions (>=100 chars): ${metrics.captionAnalysis.long.count} posts, avg engagement ${metrics.captionAnalysis.long.avgEngagement}

TOP 3 POSTS:
${JSON.stringify(metrics.topPosts, null, 2)}

Generate a report as JSON matching this exact schema. Make the actionPlan the most detailed section with 5-8 items ranked by revenue impact. Reference specific numbers from the data above in your recommendations. Consider their business type (${profile.businessType}) and tailor advice to that industry.

{
  "whatsWorking": [
    { "title": "string", "detail": "string", "dataPoint": "string" }
  ],
  "opportunities": [
    { "title": "string", "why": "string", "what": "string", "impact": "string", "metric": "string" }
  ],
  "contentCalendar": [
    { "day": "string", "time": "string", "format": "string", "topic": "string", "why": "string" }
  ],
  "revenueLevers": [
    { "title": "string", "detail": "string", "estimatedImpact": "string" }
  ],
  "actionPlan": [
    {
      "priority": 1,
      "recommendation": "string",
      "whyItMatters": "string",
      "steps": ["string"],
      "expectedImpact": "string",
      "howToMeasure": "string",
      "timeline": "string"
    }
  ],
  "competitivePosition": {
    "engagementVsBenchmark": "string",
    "frequencyVsRecommended": "string",
    "contentMixAssessment": "string",
    "overallAssessment": "string"
  }
}`;
}

// ─── Stripe signature verification ─────────────────────────────

async function verifyStripeSignature(payload, sigHeader, secret) {
  // Parse the signature header: t=timestamp,v1=signature[,v1=signature2,...]
  let timestamp = null;
  const v1Sigs = [];
  for (const item of sigHeader.split(',')) {
    const eqIdx = item.indexOf('=');
    if (eqIdx === -1) continue;
    const key = item.slice(0, eqIdx).trim();
    const value = item.slice(eqIdx + 1).trim();
    if (key === 't') timestamp = value;
    else if (key === 'v1') v1Sigs.push(value);
  }

  if (!timestamp || v1Sigs.length === 0) {
    return null;
  }

  // Reject timestamps older than 5 minutes to prevent replay attacks
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (age > 300) {
    console.error('Webhook timestamp too old:', age, 'seconds');
    return null;
  }

  // Compute expected signature: HMAC-SHA256(secret, timestamp + '.' + payload)
  const signedPayload = timestamp + '.' + payload;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const computedSig = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Check against all v1 signatures (Stripe may send multiple during secret rotation)
  let matched = false;
  for (const expectedSig of v1Sigs) {
    if (computedSig.length !== expectedSig.length) continue;
    let mismatch = 0;
    for (let i = 0; i < computedSig.length; i++) {
      mismatch |= computedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    if (mismatch === 0) { matched = true; break; }
  }
  if (!matched) {
    return null;
  }

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

// ─── Helpers ───────────────────────────────────────────────────

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}
