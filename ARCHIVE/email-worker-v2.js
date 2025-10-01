/**
 * ChittyOS Email Worker v2 - Enhanced with real features
 * Handles email routing with ChittyID tracking, analytics, and rate limiting
 */

export default {
  async email(message, env, ctx) {
    const startTime = Date.now();

    // Generate transaction ID (ChittyID when API is available)
    const transactionId = await generateTransactionId(env, message);

    // Multi-domain routing - only real domains
    const DOMAIN_CONFIG = {
      "nevershitty.com": {
        defaultForward: "nick@mrniceweird.com", // Forward to your main email
        trackAnalytics: true,
        enableWebhooks: true,
      },
      "chitty.cc": {
        defaultForward: "nick@mrniceweird.com",
        trackAnalytics: true,
        apiDomain: true, // Special handling for API emails
      },
      "chittychat.com": {
        defaultForward: "nick@mrniceweird.com",
        trackAnalytics: true,
      },
      "chittyos.com": {
        defaultForward: "nick@mrniceweird.com",
        trackAnalytics: true,
        developmentDomain: true,
      },
      "mrniceweird.com": {
        defaultForward: "nick@mrniceweird.com",
        personalDomain: true,
      },
      "chittyrouter.com": {
        defaultForward: "nick@mrniceweird.com",
        infrastructureDomain: true,
      },
    };

    try {
      const [recipientLocal, recipientDomain] = message.to
        .toLowerCase()
        .split("@");

      console.log(`[${transactionId}] Email received:`, {
        from: message.from,
        to: message.to,
        domain: recipientDomain,
        timestamp: new Date().toISOString(),
      });

      // Check domain configuration
      const domainConfig = DOMAIN_CONFIG[recipientDomain];
      if (!domainConfig) {
        console.log(`Unknown domain: ${recipientDomain}`);
        await message.setReject("Domain not configured");
        return;
      }

      // Rate limiting
      if (await checkRateLimit(env, message.from)) {
        await logAnalytics(env, {
          transactionId,
          action: "rate_limited",
          from: message.from,
          domain: recipientDomain,
        });
        await message.setReject("Rate limit exceeded - please try again later");
        return;
      }

      // Spam detection
      if (await isSpam(message)) {
        await logAnalytics(env, {
          transactionId,
          action: "spam_blocked",
          from: message.from,
          domain: recipientDomain,
        });
        await message.setReject("Message classified as spam");
        return;
      }

      // Determine forwarding address
      let forwardTo = domainConfig.defaultForward;

      // Special routing for specific addresses
      const specialRoutes = {
        legal: "nick@mrniceweird.com", // Legal emails need attention
        security: "nick@mrniceweird.com", // Security alerts
        abuse: "nick@mrniceweird.com", // Abuse reports
        postmaster: "nick@mrniceweird.com", // Required postmaster
        api: "nick@mrniceweird.com", // API notifications
        webhook: "nick@mrniceweird.com", // Webhook notifications
        id: "nick@mrniceweird.com", // ChittyID related
        support: "nick@mrniceweird.com",
        admin: "nick@mrniceweird.com",
      };

      if (specialRoutes[recipientLocal]) {
        forwardTo = specialRoutes[recipientLocal];
      }

      // Add tracking headers
      message.headers.set("X-Cloudflare-Worker", "chittyos-email-v2");
      message.headers.set("X-Transaction-ID", transactionId);
      message.headers.set("X-Original-To", message.to);
      message.headers.set("X-Processing-Time", `${Date.now() - startTime}ms`);
      message.headers.set("X-Routed-Domain", recipientDomain);

      // Check for priority emails
      const isPriority = checkPriority(message, recipientLocal);
      if (isPriority) {
        message.headers.set("X-Priority", "High");
        message.headers.set("Importance", "high");
      }

      // Forward the email
      console.log(`[${transactionId}] Forwarding to ${forwardTo}`);
      await message.forward(forwardTo);

      // Analytics tracking
      if (domainConfig.trackAnalytics && env.EMAIL_ANALYTICS) {
        await logAnalytics(env, {
          transactionId,
          action: "forwarded",
          from: message.from,
          to: message.to,
          forwardedTo: forwardTo,
          domain: recipientDomain,
          processingTime: Date.now() - startTime,
          priority: isPriority,
          size: message.raw.length,
        });
      }

      // Send webhooks for important emails
      if (domainConfig.enableWebhooks && isPriority) {
        await sendWebhookNotification(env, {
          transactionId,
          event: "priority_email",
          from: message.from,
          to: message.to,
          subject: message.headers.get("subject"),
          domain: recipientDomain,
        });
      }

      // Update rate limit counter
      await updateRateLimit(env, message.from);
    } catch (error) {
      console.error(`[${transactionId}] Error:`, error);

      // Fallback forwarding
      try {
        await message.forward("nick@mrniceweird.com");
      } catch (fallbackError) {
        console.error(`[${transactionId}] Fallback failed:`, fallbackError);
      }
    }
  },
};

// Generate transaction ID (will use ChittyID API when available)
async function generateTransactionId(env, message) {
  // Try to get ChittyID from service
  if (env.CHITTY_API_KEY) {
    try {
      const response = await fetch("https://id.chitty.cc/api/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CHITTY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "email",
          domain: message.to.split("@")[1],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.id;
      }
    } catch (error) {
      console.error("ChittyID generation failed:", error);
    }
  }

  // Fallback to UUID-like ID
  return `EMAIL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Check if email is spam
async function isSpam(message) {
  const spamKeywords = [
    "viagra",
    "casino",
    "lottery",
    "inheritance",
    "nigerian prince",
    "click here now",
    "act now",
    "limited time offer",
    "you have won",
    "bitcoin mining",
    "forex trading",
    "make money fast",
  ];

  const subject = (message.headers.get("subject") || "").toLowerCase();
  const from = message.from.toLowerCase();

  // Check for spam keywords
  for (const keyword of spamKeywords) {
    if (subject.includes(keyword)) {
      return true;
    }
  }

  // Check sender patterns
  if (
    from.match(/\d{5,}@/) || // Too many numbers
    from.includes("..") || // Double dots
    (from.includes("noreply@") &&
      !from.includes("@github.com") &&
      !from.includes("@google.com"))
  ) {
    return true;
  }

  return false;
}

// Check if email is priority
function checkPriority(message, recipientLocal) {
  const priorityAddresses = ["legal", "security", "abuse", "urgent"];
  const prioritySenders = [
    "@cloudflare.com",
    "@google.com",
    "@github.com",
    "@stripe.com",
  ];

  // Check if it's a priority address
  if (priorityAddresses.includes(recipientLocal)) {
    return true;
  }

  // Check if from priority sender
  const from = message.from.toLowerCase();
  for (const sender of prioritySenders) {
    if (from.includes(sender)) {
      return true;
    }
  }

  // Check subject for urgent keywords
  const subject = (message.headers.get("subject") || "").toLowerCase();
  if (
    subject.includes("urgent") ||
    subject.includes("critical") ||
    subject.includes("security")
  ) {
    return true;
  }

  return false;
}

// Check rate limiting
async function checkRateLimit(env, sender) {
  if (!env.RATE_LIMITS) return false;

  const key = `rate:${sender}`;
  const data = await env.RATE_LIMITS.get(key);

  if (data) {
    const parsed = JSON.parse(data);
    // Allow 50 emails per hour
    if (parsed.count > 50) {
      return true; // Rate limited
    }
  }

  return false;
}

// Update rate limit counter
async function updateRateLimit(env, sender) {
  if (!env.RATE_LIMITS) return;

  const key = `rate:${sender}`;
  const existing = await env.RATE_LIMITS.get(key);

  let data;
  if (existing) {
    data = JSON.parse(existing);
    // Reset if hour has passed
    if (Date.now() - data.window > 3600000) {
      data = { count: 1, window: Date.now() };
    } else {
      data.count++;
    }
  } else {
    data = { count: 1, window: Date.now() };
  }

  await env.RATE_LIMITS.put(key, JSON.stringify(data), {
    expirationTtl: 3600, // Expire after 1 hour
  });
}

// Log analytics
async function logAnalytics(env, data) {
  if (!env.EMAIL_ANALYTICS) return;

  try {
    const key = `email:${data.domain}:${data.transactionId}`;
    await env.EMAIL_ANALYTICS.put(
      key,
      JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      }),
      {
        expirationTtl: 86400 * 30, // Keep for 30 days
        metadata: {
          domain: data.domain,
          action: data.action,
        },
      },
    );
  } catch (error) {
    console.error("Analytics logging failed:", error);
  }
}

// Send webhook notification
async function sendWebhookNotification(env, data) {
  if (!env.WEBHOOK_URL) return;

  try {
    await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ChittyOS-Event": "email",
      },
      body: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("Webhook notification failed:", error);
  }
}
