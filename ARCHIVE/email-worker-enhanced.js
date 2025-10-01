/**
 * ChittyOS Enhanced Email Worker
 * Multi-domain routing with ChittyID, analytics, and advanced features
 */

export default {
  async email(message, env, ctx) {
    // Generate ChittyID for email transaction
    const chittyId = await generateChittyId(env, message);

    // Start performance tracking
    const startTime = Date.now();

    // Rate limiting check
    const rateLimitKey = `rate:${message.from}`;
    const rateLimit = await env.RATE_LIMITS?.get(rateLimitKey);
    if (rateLimit && JSON.parse(rateLimit).count > 50) {
      await logEmail(env, {
        chittyId,
        action: "rate_limited",
        from: message.from,
        to: message.to,
      });
      await message.setReject("Rate limit exceeded");
      return;
    }

    // Enhanced domain configuration with ChittyOS features
    const DOMAIN_CONFIG = {
      "nevershitty.com": {
        googleWorkspace: true,
        defaultForward: "admin@nevershitty.com",
        webhooks: ["https://discord.chitty.cc/webhook/email"],
        priority: true,
        routes: {
          admin: "admin@nevershitty.com",
          support: "support@nevershitty.com",
          info: "info@nevershitty.com",
          legal: {
            forward: "legal@nevershitty.com",
            webhook: "https://litigation.chitty.cc/intake",
            priority: "high",
          },
        },
      },
      "chitty.cc": {
        googleWorkspace: true,
        defaultForward: "nick@mrniceweird.com",
        aiProcessing: true,
        routes: {
          admin: "nick@mrniceweird.com",
          support: "nick@mrniceweird.com",
          api: {
            forward: "nick@mrniceweird.com",
            autoRespond: true,
            logToKV: true,
          },
          id: {
            forward: "nick@mrniceweird.com",
            chittyIdValidation: true,
          },
          schema: "nick@mrniceweird.com",
          gateway: "nick@mrniceweird.com",
        },
      },
      "chittychat.com": {
        googleWorkspace: true,
        defaultForward: "admin@chittychat.com",
        supportTicketing: true,
        routes: {
          admin: "admin@chittychat.com",
          support: {
            forward: "support@chittychat.com",
            createTicket: true,
            priority: "medium",
          },
          hello: "hello@chittychat.com",
          legal: {
            forward: "legal@chittychat.com",
            evidenceCapture: true,
          },
        },
      },
      "chittyos.com": {
        googleWorkspace: true,
        defaultForward: "admin@chittyos.com",
        developmentMode: true,
        routes: {
          admin: "admin@chittyos.com",
          dev: {
            forward: "dev@chittyos.com",
            codeFormatting: true,
          },
          security: {
            forward: "security@chittyos.com",
            priority: "high",
            encrypt: true,
          },
          api: {
            forward: "api@chittyos.com",
            parseWebhooks: true,
          },
        },
      },
      "mrniceweird.com": {
        googleWorkspace: true,
        defaultForward: "nick@mrniceweird.com",
        personalMode: true,
        routes: {
          nick: "nick@mrniceweird.com",
          admin: "nick@mrniceweird.com",
          hello: "nick@mrniceweird.com",
        },
      },
      "chittyrouter.com": {
        googleWorkspace: true,
        defaultForward: "admin@chittyrouter.com",
        infrastructureMode: true,
        routes: {
          admin: "admin@chittyrouter.com",
          router: "router@chittyrouter.com",
          status: {
            forward: "admin@chittyrouter.com",
            statusPage: true,
          },
        },
      },
    };

    try {
      // Extract domain and local part
      const [recipientLocal, recipientDomain] = message.to
        .toLowerCase()
        .split("@");

      // Enhanced logging with ChittyID
      console.log(`[${chittyId}] Email received:`, {
        from: message.from,
        to: message.to,
        domain: recipientDomain,
        subject: message.headers.get("subject"),
        timestamp: new Date().toISOString(),
      });

      // Get domain configuration
      const domainConfig = DOMAIN_CONFIG[recipientDomain];

      if (!domainConfig) {
        await logEmail(env, {
          chittyId,
          action: "rejected",
          reason: "unknown_domain",
          domain: recipientDomain,
        });
        await message.setReject("Domain not configured");
        return;
      }

      // Advanced spam detection with AI
      if (env.AI && (await isSpamAI(env.AI, message))) {
        await logEmail(env, {
          chittyId,
          action: "spam_blocked",
          from: message.from,
          to: message.to,
        });
        await message.setReject("Message classified as spam");
        return;
      }

      // VIP/Priority sender check
      const vipSenders = [
        "important@client.com",
        "legal@lawfirm.com",
        "admin@cloudflare.com",
      ];

      const isVIP = vipSenders.some((vip) => message.from.includes(vip));
      const isPriority =
        isVIP || recipientLocal === "legal" || recipientLocal === "security";

      // Determine routing
      let routeConfig =
        domainConfig.routes[recipientLocal] || domainConfig.defaultForward;
      let forwardTo =
        typeof routeConfig === "string" ? routeConfig : routeConfig.forward;

      // Special handling for ChittyID system emails
      if (recipientLocal.startsWith("chittyid-")) {
        forwardTo = domainConfig.defaultForward;
        await handleChittyIdEmail(env, message, chittyId);
      }

      // Add enhanced headers
      message.headers.set("X-Cloudflare-Worker", "chittyos-email-router");
      message.headers.set("X-ChittyID", chittyId);
      message.headers.set("X-Routed-Domain", recipientDomain);
      message.headers.set("X-Original-To", message.to);
      message.headers.set("X-Processing-Time", `${Date.now() - startTime}ms`);

      if (isPriority) {
        message.headers.set("X-Priority", "High");
        message.headers.set("Importance", "high");
      }

      // Execute route-specific features
      if (typeof routeConfig === "object") {
        // Create support ticket
        if (routeConfig.createTicket) {
          await createSupportTicket(env, message, chittyId);
        }

        // Send webhook notification
        if (routeConfig.webhook) {
          await sendWebhook(routeConfig.webhook, {
            chittyId,
            from: message.from,
            to: message.to,
            subject: message.headers.get("subject"),
            priority: routeConfig.priority || "normal",
          });
        }

        // Evidence capture for legal emails
        if (routeConfig.evidenceCapture) {
          await captureEvidence(env, message, chittyId);
        }

        // Parse API webhooks
        if (routeConfig.parseWebhooks) {
          await parseAPIWebhook(env, message, chittyId);
        }
      }

      // Forward email
      console.log(`[${chittyId}] Forwarding to ${forwardTo}`);
      await message.forward(forwardTo);

      // Analytics and tracking
      await logEmail(env, {
        chittyId,
        action: "forwarded",
        from: message.from,
        to: message.to,
        forwardedTo: forwardTo,
        domain: recipientDomain,
        processingTime: Date.now() - startTime,
        priority: isPriority,
        size: message.raw.length,
      });

      // Send webhook for important domains
      if (domainConfig.webhooks && isPriority) {
        for (const webhook of domainConfig.webhooks) {
          await sendWebhook(webhook, {
            chittyId,
            event: "priority_email",
            from: message.from,
            to: message.to,
            subject: message.headers.get("subject"),
          });
        }
      }

      // Update rate limiting
      await updateRateLimit(env, message.from);
    } catch (error) {
      console.error(`[${chittyId}] Error:`, error);
      await logEmail(env, {
        chittyId,
        action: "error",
        error: error.message,
        from: message.from,
        to: message.to,
      });

      // Fallback forwarding
      try {
        await message.forward("nick@mrniceweird.com");
      } catch (fallbackError) {
        console.error(`[${chittyId}] Fallback failed:`, fallbackError);
      }
    }
  },
};

// Generate ChittyID for email transaction
async function generateChittyId(env, message) {
  try {
    // Call ChittyID service API
    const response = await fetch("https://id.chitty.cc/api/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CHITTY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "email",
        domain: message.to.split("@")[1],
        from: message.from,
        timestamp: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.chittyId;
    }
  } catch (error) {
    console.error("ChittyID generation failed:", error);
  }

  // Fallback ID
  return `EMAIL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// AI-powered spam detection
async function isSpamAI(ai, message) {
  try {
    const subject = message.headers.get("subject") || "";
    const prompt = `Is this email spam? Subject: "${subject}" From: ${message.from}. Reply with only "yes" or "no".`;

    const response = await ai.run("@cf/meta/llama-2-7b-chat-int8", {
      prompt,
      max_tokens: 10,
    });

    return response.response.toLowerCase().includes("yes");
  } catch (error) {
    console.error("AI spam check failed:", error);
    // Fall back to basic spam check
    return await isSpamBasic(message);
  }
}

// Basic spam detection
async function isSpamBasic(message) {
  const spamKeywords = [
    "viagra",
    "casino",
    "lottery",
    "inheritance",
    "prince",
    "bitcoin mining",
    "forex",
    "click here",
    "act now",
    "limited time",
  ];

  const subject = (message.headers.get("subject") || "").toLowerCase();
  const from = message.from.toLowerCase();

  // Check keywords
  for (const keyword of spamKeywords) {
    if (subject.includes(keyword)) return true;
  }

  // Check patterns
  if (
    from.match(/\d{5,}@/) ||
    from.includes("..") ||
    subject.match(/^re: \d+$/i)
  ) {
    return true;
  }

  return false;
}

// Log email to KV storage
async function logEmail(env, data) {
  if (!env.EMAIL_ANALYTICS) return;

  try {
    const key = `email:${data.chittyId}:${Date.now()}`;
    await env.EMAIL_ANALYTICS.put(key, JSON.stringify(data), {
      expirationTtl: 86400 * 30, // 30 days
      metadata: {
        domain: data.domain,
        action: data.action,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to log email:", error);
  }
}

// Send webhook notification
async function sendWebhook(url, data) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("Webhook failed:", error);
  }
}

// Create support ticket
async function createSupportTicket(env, message, chittyId) {
  try {
    const ticketData = {
      chittyId,
      from: message.from,
      to: message.to,
      subject: message.headers.get("subject"),
      body: await message.text(),
      priority: "normal",
      status: "open",
    };

    // Store in KV or send to ticketing system
    if (env.SUPPORT_TICKETS) {
      await env.SUPPORT_TICKETS.put(
        `ticket:${chittyId}`,
        JSON.stringify(ticketData),
      );
    }
  } catch (error) {
    console.error("Failed to create ticket:", error);
  }
}

// Capture evidence for legal emails
async function captureEvidence(env, message, chittyId) {
  try {
    const evidence = {
      chittyId,
      type: "email",
      from: message.from,
      to: message.to,
      subject: message.headers.get("subject"),
      headers: Object.fromEntries(message.headers),
      timestamp: new Date().toISOString(),
      hash: await crypto.subtle.digest("SHA-256", message.raw),
    };

    // Send to evidence system
    await fetch("https://evidence.chitty.cc/api/capture", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CHITTY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(evidence),
    });
  } catch (error) {
    console.error("Evidence capture failed:", error);
  }
}

// Parse API webhook emails
async function parseAPIWebhook(env, message, chittyId) {
  try {
    const body = await message.text();

    // Look for JSON in email body
    const jsonMatch = body.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const webhookData = JSON.parse(jsonMatch[0]);

      // Store parsed webhook
      if (env.WEBHOOKS) {
        await env.WEBHOOKS.put(
          `webhook:${chittyId}`,
          JSON.stringify({
            chittyId,
            from: message.from,
            data: webhookData,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }
  } catch (error) {
    console.error("Webhook parsing failed:", error);
  }
}

// Handle ChittyID system emails
async function handleChittyIdEmail(env, message, chittyId) {
  try {
    // Special processing for ChittyID system emails
    const subject = message.headers.get("subject") || "";

    if (subject.includes("validation") || subject.includes("verification")) {
      // Auto-process validation requests
      await fetch("https://id.chitty.cc/api/validate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CHITTY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chittyId,
          emailFrom: message.from,
          action: "email_validation",
        }),
      });
    }
  } catch (error) {
    console.error("ChittyID handling failed:", error);
  }
}

// Update rate limiting
async function updateRateLimit(env, sender) {
  if (!env.RATE_LIMITS) return;

  try {
    const key = `rate:${sender}`;
    const existing = await env.RATE_LIMITS.get(key);

    let data = existing
      ? JSON.parse(existing)
      : { count: 0, window: Date.now() };

    // Reset if window expired (1 hour)
    if (Date.now() - data.window > 3600000) {
      data = { count: 1, window: Date.now() };
    } else {
      data.count++;
    }

    await env.RATE_LIMITS.put(key, JSON.stringify(data), {
      expirationTtl: 3600, // 1 hour
    });
  } catch (error) {
    console.error("Rate limit update failed:", error);
  }
}
