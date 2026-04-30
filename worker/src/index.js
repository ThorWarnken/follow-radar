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
    // Monthly or yearly — determine from the amount or interval
    const amountTotal = session.amount_total || 0;
    // $4 one-time, $5/mo = 500, $30/yr = 3000 (in cents)
    // We'll also check subscription metadata if available
    if (amountTotal >= 2000) {
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
