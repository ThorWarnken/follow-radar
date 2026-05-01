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
    // Use amount_subtotal (before discounts) so promo codes don't break plan detection
    const amountTotal = session.amount_subtotal || session.amount_total || 0;
    if (amountTotal >= 49000) {
      plan = 'business-yearly';
      expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
      ttl = 365 * 86400;
    } else if (amountTotal >= 4500) {
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
  const metrics = computeMetrics(scan);

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
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API error:', response.status, errText);
      return json({ error: 'AI report generation failed' }, 502, corsHeaders);
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
  const posts = scan.posts || [];
  const followers = scan.followers || [];
  const following = scan.following || [];
  const followerCount = followers.length;
  const followingCount = following.length;
  const postsAnalyzed = posts.length;

  // Basic engagement averages
  const totalLikes = posts.reduce((sum, p) => sum + (p.like_count || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.comment_count || 0), 0);
  const avgLikes = postsAnalyzed > 0 ? Math.round(totalLikes / postsAnalyzed) : 0;
  const avgComments = postsAnalyzed > 0 ? Math.round((totalComments / postsAnalyzed) * 10) / 10 : 0;
  const engagementRate = followerCount > 0 && postsAnalyzed > 0
    ? Math.round(((totalLikes + totalComments) / postsAnalyzed / followerCount) * 10000) / 100
    : 0;
  const likeToFollowerRatio = followerCount > 0 && postsAnalyzed > 0
    ? Math.round((totalLikes / postsAnalyzed / followerCount) * 10000) / 100
    : 0;

  // Post type breakdown (1=Photo, 2=Reel, 8=Carousel)
  const typeNames = { 1: 'Photo', 2: 'Reel', 8: 'Carousel' };
  const typeGroups = {};
  for (const p of posts) {
    const t = p.media_type || 0;
    if (!typeGroups[t]) typeGroups[t] = { count: 0, totalEng: 0 };
    typeGroups[t].count++;
    typeGroups[t].totalEng += (p.like_count || 0) + (p.comment_count || 0);
  }
  const postTypeBreakdown = {};
  for (const [type, data] of Object.entries(typeGroups)) {
    const name = typeNames[type] || `Type ${type}`;
    postTypeBreakdown[name] = {
      count: data.count,
      avgEngagement: Math.round(data.totalEng / data.count),
    };
  }

  // Engagement by day of week and hour
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayData = Array.from({ length: 7 }, (_, i) => ({ day: dayNames[i], totalEng: 0, postCount: 0 }));
  const hourData = {};

  for (const p of posts) {
    if (!p.taken_at) continue;
    const date = new Date(p.taken_at * 1000);
    const eng = (p.like_count || 0) + (p.comment_count || 0);
    const dow = date.getUTCDay();
    dayData[dow].totalEng += eng;
    dayData[dow].postCount++;
    const hour = date.getUTCHours();
    if (!hourData[hour]) hourData[hour] = { totalEng: 0, postCount: 0 };
    hourData[hour].totalEng += eng;
    hourData[hour].postCount++;
  }

  const engagementByDayOfWeek = dayData.map(d => ({
    day: d.day,
    avgEngagement: d.postCount > 0 ? Math.round(d.totalEng / d.postCount) : 0,
    postCount: d.postCount,
  }));

  const engagementByHour = Object.entries(hourData)
    .map(([hour, d]) => ({
      hour: parseInt(hour),
      avgEngagement: d.postCount > 0 ? Math.round(d.totalEng / d.postCount) : 0,
      postCount: d.postCount,
    }))
    .sort((a, b) => a.hour - b.hour);

  // Best posting time and day
  const bestHourEntry = engagementByHour.length > 0
    ? engagementByHour.reduce((best, cur) => cur.avgEngagement > best.avgEngagement ? cur : best)
    : null;
  const bestPostingTime = bestHourEntry ? bestHourEntry.hour : null;

  const bestDayEntry = engagementByDayOfWeek.reduce((best, cur) =>
    cur.avgEngagement > best.avgEngagement ? cur : best
  );
  const bestPostingDay = bestDayEntry.postCount > 0 ? bestDayEntry.day : null;

  // Post frequency (posts per week)
  let postFrequency = 0;
  if (postsAnalyzed >= 2) {
    const timestamps = posts.filter(p => p.taken_at).map(p => p.taken_at).sort((a, b) => a - b);
    if (timestamps.length >= 2) {
      const spanSeconds = timestamps[timestamps.length - 1] - timestamps[0];
      const spanWeeks = spanSeconds / (7 * 24 * 60 * 60);
      postFrequency = spanWeeks > 0 ? Math.round((timestamps.length / spanWeeks) * 10) / 10 : 0;
    }
  }

  // Engagement trend (older half vs newer half)
  let engagementTrend = 0;
  if (postsAnalyzed >= 4) {
    const sorted = [...posts].sort((a, b) => (a.taken_at || 0) - (b.taken_at || 0));
    const mid = Math.floor(sorted.length / 2);
    const olderHalf = sorted.slice(0, mid);
    const newerHalf = sorted.slice(mid);
    const olderAvg = olderHalf.reduce((s, p) => s + (p.like_count || 0) + (p.comment_count || 0), 0) / olderHalf.length;
    const newerAvg = newerHalf.reduce((s, p) => s + (p.like_count || 0) + (p.comment_count || 0), 0) / newerHalf.length;
    engagementTrend = olderAvg > 0
      ? Math.round(((newerAvg - olderAvg) / olderAvg) * 10000) / 100
      : 0;
  }

  // Caption analysis
  const shortCaptions = posts.filter(p => (p.caption_length || 0) < 100);
  const longCaptions = posts.filter(p => (p.caption_length || 0) >= 100);
  const captionAnalysis = {
    short: {
      count: shortCaptions.length,
      avgEngagement: shortCaptions.length > 0
        ? Math.round(shortCaptions.reduce((s, p) => s + (p.like_count || 0) + (p.comment_count || 0), 0) / shortCaptions.length)
        : 0,
    },
    long: {
      count: longCaptions.length,
      avgEngagement: longCaptions.length > 0
        ? Math.round(longCaptions.reduce((s, p) => s + (p.like_count || 0) + (p.comment_count || 0), 0) / longCaptions.length)
        : 0,
    },
  };

  // Top 3 posts by total engagement
  const topPosts = [...posts]
    .map(p => ({
      likeCount: p.like_count || 0,
      commentCount: p.comment_count || 0,
      totalEngagement: (p.like_count || 0) + (p.comment_count || 0),
      mediaType: typeNames[p.media_type] || `Type ${p.media_type}`,
      captionLength: p.caption_length || 0,
      takenAt: p.taken_at ? new Date(p.taken_at * 1000).toISOString() : null,
    }))
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 3);

  return {
    followerCount,
    followingCount,
    postsAnalyzed,
    avgLikes,
    avgComments,
    engagementRate,
    likeToFollowerRatio,
    postTypeBreakdown,
    engagementByDayOfWeek,
    engagementByHour,
    bestPostingTime,
    bestPostingDay,
    postFrequency,
    engagementTrend,
    captionAnalysis,
    topPosts,
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
