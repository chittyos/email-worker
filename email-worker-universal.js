/**
 * Universal Email Worker for ChittyOS
 * Automatically handles any domain configured in Cloudflare Email Routing
 */

export default {
  async email(message, env, ctx) {
    const startTime = Date.now();

    // Extract domain and local part
    const [recipientLocal, recipientDomain] = message.to
      .toLowerCase()
      .split("@");

    // Generate transaction ID
    const transactionId = `EMAIL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[${transactionId}] Email received:`, {
      from: message.from,
      to: message.to,
      domain: recipientDomain,
      timestamp: new Date().toISOString(),
    });

    // Default forwarding address for all domains
    const DEFAULT_FORWARD = env.DEFAULT_FORWARD || "no-reply@itcan.llc";

    // Known domain configurations (can be extended)
    const KNOWN_DOMAINS = {
      "nevershitty.com": { priority: true },
      "chitty.cc": { priority: true },
      "chittychat.com": { priority: false },
      "chittyos.com": { priority: true },
      "mrniceweird.com": { priority: false },
      "chittyrouter.com": { priority: false },
      // Additional domains will use default config
    };

    try {
      // Rate limiting check
      if (await checkRateLimit(env, message.from)) {
        console.log(`[${transactionId}] Rate limited: ${message.from}`);
        await message.setReject("Rate limit exceeded - please try again later");
        return;
      }

      // Spam check
      if (await isSpam(message)) {
        console.log(`[${transactionId}] Spam detected from ${message.from}`);
        await message.setReject("Message classified as spam");
        return;
      }

      // Get domain config (use defaults if unknown)
      const domainConfig = KNOWN_DOMAINS[recipientDomain] || {
        priority: false,
      };

      // Determine forwarding address
      let forwardTo = DEFAULT_FORWARD;

      // Special routing for specific local parts
      const MGMT_FORWARD = "mgmt@aribia.llc";
      const specialRoutes = {
        // Management emails
        admin: MGMT_FORWARD,
        support: MGMT_FORWARD,
        legal: MGMT_FORWARD,
        security: MGMT_FORWARD,
        abuse: MGMT_FORWARD,
        postmaster: MGMT_FORWARD,
        mgmt: MGMT_FORWARD,
        management: MGMT_FORWARD,

        // Personal routing
        nick: "nick@jeanarlene.com",
        sharon: "sharon@itcanbellc.com",

        // Developer/API emails (use default catch-all)
        api: DEFAULT_FORWARD,
        webhook: DEFAULT_FORWARD,
        id: DEFAULT_FORWARD,
        dev: DEFAULT_FORWARD,
        info: DEFAULT_FORWARD,
        hello: DEFAULT_FORWARD,

        // Don't forward
        noreply: null,
        "no-reply": null,
      };

      // Check for no-reply addresses
      if (
        recipientLocal.includes("noreply") ||
        recipientLocal.includes("no-reply")
      ) {
        console.log(
          `[${transactionId}] Discarding no-reply email to ${message.to}`,
        );
        return;
      }

      // Use special route if defined
      if (specialRoutes[recipientLocal] !== undefined) {
        if (specialRoutes[recipientLocal] === null) {
          console.log(
            `[${transactionId}] Discarding email to ${recipientLocal}@${recipientDomain}`,
          );
          return;
        }
        forwardTo = specialRoutes[recipientLocal];
      }

      // Check for priority
      const isPriority =
        domainConfig.priority ||
        ["legal", "security", "abuse"].includes(recipientLocal) ||
        checkPrioritySender(message.from);

      // Add tracking headers
      message.headers.set("X-Cloudflare-Worker", "chittyos-email-universal");
      message.headers.set("X-Transaction-ID", transactionId);
      message.headers.set("X-Original-To", message.to);
      message.headers.set("X-Routed-Domain", recipientDomain);
      message.headers.set("X-Processing-Time", `${Date.now() - startTime}ms`);

      if (isPriority) {
        message.headers.set("X-Priority", "High");
        message.headers.set("Importance", "high");
      }

      // Forward the email
      console.log(
        `[${transactionId}] Forwarding to ${forwardTo} (priority: ${isPriority})`,
      );
      await message.forward(forwardTo);

      // Log analytics
      if (env.EMAIL_ANALYTICS) {
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

      // Send webhook for priority emails
      if (isPriority && env.WEBHOOK_URL) {
        await sendWebhook(env.WEBHOOK_URL, {
          transactionId,
          event: "priority_email",
          from: message.from,
          to: message.to,
          subject: message.headers.get("subject"),
          domain: recipientDomain,
        });
      }

      // Update rate limit
      await updateRateLimit(env, message.from);
    } catch (error) {
      console.error(`[${transactionId}] Error:`, error);

      // Fallback forwarding
      try {
        await message.forward(DEFAULT_FORWARD);
      } catch (fallbackError) {
        console.error(`[${transactionId}] Fallback failed:`, fallbackError);
      }
    }
  },
};

// Check if sender is priority
function checkPrioritySender(from) {
  const prioritySenders = [
    "@cloudflare.com",
    "@google.com",
    "@github.com",
    "@stripe.com",
    "@openai.com",
    "@anthropic.com",
  ];

  const fromLower = from.toLowerCase();
  return prioritySenders.some((sender) => fromLower.includes(sender));
}

// Spam detection
async function isSpam(message) {
  const spamKeywords = [
    "viagra",
    "casino",
    "lottery",
    "inheritance",
    "prince",
    "click here now",
    "act now",
    "limited time",
    "you have won",
    "bitcoin mining",
    "forex",
    "make money fast",
    "guarantee",
  ];

  const subject = (message.headers.get("subject") || "").toLowerCase();
  const from = message.from.toLowerCase();

  // Check keywords
  for (const keyword of spamKeywords) {
    if (subject.includes(keyword)) return true;
  }

  // Check patterns
  if (from.match(/\d{5,}@/) || from.includes("..")) {
    return true;
  }

  return false;
}

// Rate limiting
async function checkRateLimit(env, sender) {
  if (!env.RATE_LIMITS) return false;

  try {
    const key = `rate:${sender}`;
    const data = await env.RATE_LIMITS.get(key);

    if (data) {
      const parsed = JSON.parse(data);
      // 50 emails per hour
      return parsed.count > 50;
    }
  } catch (error) {
    console.error("Rate limit check failed:", error);
  }

  return false;
}

// Update rate limit
async function updateRateLimit(env, sender) {
  if (!env.RATE_LIMITS) return;

  try {
    const key = `rate:${sender}`;
    const existing = await env.RATE_LIMITS.get(key);

    let data;
    if (existing) {
      data = JSON.parse(existing);
      if (Date.now() - data.window > 3600000) {
        data = { count: 1, window: Date.now() };
      } else {
        data.count++;
      }
    } else {
      data = { count: 1, window: Date.now() };
    }

    await env.RATE_LIMITS.put(key, JSON.stringify(data), {
      expirationTtl: 3600,
    });
  } catch (error) {
    console.error("Rate limit update failed:", error);
  }
}

// Log analytics
async function logAnalytics(env, data) {
  try {
    const key = `email:${data.domain}:${data.transactionId}`;
    await env.EMAIL_ANALYTICS.put(
      key,
      JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      }),
      {
        expirationTtl: 86400 * 30,
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

// Send webhook
async function sendWebhook(url, data) {
  try {
    await fetch(url, {
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
    console.error("Webhook failed:", error);
  }
}
