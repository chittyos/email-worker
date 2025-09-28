/**
 * Cloudflare Multi-Domain Email Worker
 * Smart routing for all ChittyOS domains to Google Workspace
 */

export default {
  async email(message, env, ctx) {
    // Multi-domain routing configuration
    const DOMAIN_CONFIG = {
      "nevershitty.com": {
        googleWorkspace: true,
        defaultForward: "admin@nevershitty.com",
        routes: {
          admin: "admin@nevershitty.com",
          support: "support@nevershitty.com",
          info: "info@nevershitty.com",
        },
      },
      "chitty.cc": {
        googleWorkspace: true,
        defaultForward: "nick@mrniceweird.com",
        routes: {
          admin: "nick@mrniceweird.com",
          support: "nick@mrniceweird.com",
          api: "nick@mrniceweird.com",
          id: "nick@mrniceweird.com",
          schema: "nick@mrniceweird.com",
          gateway: "nick@mrniceweird.com",
        },
      },
      "chittychat.com": {
        googleWorkspace: true,
        defaultForward: "admin@chittychat.com",
        routes: {
          admin: "admin@chittychat.com",
          support: "support@chittychat.com",
          hello: "hello@chittychat.com",
          legal: "legal@chittychat.com",
        },
      },
      "chittyos.com": {
        googleWorkspace: true,
        defaultForward: "admin@chittyos.com",
        routes: {
          admin: "admin@chittyos.com",
          dev: "dev@chittyos.com",
          security: "security@chittyos.com",
          api: "api@chittyos.com",
        },
      },
      "mrniceweird.com": {
        googleWorkspace: true,
        defaultForward: "nick@mrniceweird.com",
        routes: {
          nick: "nick@mrniceweird.com",
          admin: "nick@mrniceweird.com",
          hello: "nick@mrniceweird.com",
        },
      },
      "chittyrouter.com": {
        googleWorkspace: true,
        defaultForward: "admin@chittyrouter.com",
        routes: {
          admin: "admin@chittyrouter.com",
          router: "router@chittyrouter.com",
        },
      },
      // Add more domains as needed - supporting all 73 domains
    };

    try {
      // Extract domain and local part from recipient
      const [recipientLocal, recipientDomain] = message.to
        .toLowerCase()
        .split("@");

      // Log incoming email
      console.log(`[${recipientDomain}] Email received:`, {
        from: message.from,
        to: message.to,
        subject: message.headers.get("subject"),
        timestamp: new Date().toISOString(),
      });

      // Get domain configuration
      const domainConfig = DOMAIN_CONFIG[recipientDomain];

      if (!domainConfig) {
        console.log(`Unknown domain: ${recipientDomain}, rejecting email`);
        await message.setReject("Domain not configured for email routing");
        return;
      }

      // Check for spam/blocklist
      if (await isSpam(message, recipientDomain)) {
        console.log(`Spam detected, rejecting email from ${message.from}`);
        await message.setReject("Spam detected");
        return;
      }

      // Custom routing logic for no-reply addresses
      if (
        recipientLocal.includes("no-reply") ||
        recipientLocal.includes("noreply")
      ) {
        console.log(`No-reply address, discarding email to ${message.to}`);
        return;
      }

      // Determine forwarding address based on domain config
      let forwardTo =
        domainConfig.routes[recipientLocal] || domainConfig.defaultForward;

      // Special handling for specific patterns
      if (recipientLocal.startsWith("chittyid-")) {
        // ChittyID system emails go to admin
        forwardTo = domainConfig.defaultForward;
      }

      // Add headers for tracking
      message.headers.set("X-Cloudflare-Worker", "multi-domain-email-router");
      message.headers.set("X-Routed-Domain", recipientDomain);
      message.headers.set("X-Original-To", message.to);
      message.headers.set("X-Forwarded-For", message.from);
      message.headers.set("X-Forwarded-Date", new Date().toISOString());

      // Forward to appropriate destination
      console.log(
        `[${recipientDomain}] Forwarding email from ${message.from} to ${forwardTo}`,
      );

      if (domainConfig.googleWorkspace) {
        // For Google Workspace domains, forward directly
        await message.forward(forwardTo);
      } else {
        // For other configurations, use custom logic
        await message.forward(forwardTo);
      }

      // Optional: Store email metadata for analytics
      if (env.EMAIL_ANALYTICS) {
        await storeEmailMetadata(env.EMAIL_ANALYTICS, {
          from: message.from,
          to: message.to,
          domain: recipientDomain,
          forwardedTo: forwardTo,
          subject: message.headers.get("subject"),
          timestamp: new Date().toISOString(),
          size: message.raw.length,
        });
      }
    } catch (error) {
      console.error("Email processing error:", error);
      // Fallback: try to forward to a default address
      try {
        await message.forward("nick@mrniceweird.com");
      } catch (fallbackError) {
        console.error("Fallback forwarding failed:", fallbackError);
      }
    }
  },
};

/**
 * Check if email is spam
 */
async function isSpam(message, domain) {
  const spamKeywords = [
    "viagra",
    "casino",
    "lottery",
    "inheritance",
    "prince",
    "bitcoin mining",
    "forex",
  ];
  const subject = (message.headers.get("subject") || "").toLowerCase();
  const from = message.from.toLowerCase();

  // Check subject for spam keywords
  for (const keyword of spamKeywords) {
    if (subject.includes(keyword)) {
      return true;
    }
  }

  // Check for suspicious sender patterns (exclude known domains)
  const trustedDomains = [
    "nevershitty.com",
    "chitty.cc",
    "chittychat.com",
    "chittyos.com",
    "mrniceweird.com",
    "chittyrouter.com",
    "google.com",
    "gmail.com",
  ];
  const senderDomain = from.split("@")[1];

  if (from.includes("no-reply@") && !trustedDomains.includes(senderDomain)) {
    return true;
  }

  // Check for common spam patterns
  if (
    from.match(/\d{5,}@/) || // Many numbers in email
    from.includes("..") || // Double dots
    subject.match(/^re: \d+$/i)
  ) {
    // Fake replies with just numbers
    return true;
  }

  return false;
}

/**
 * Store email metadata for analytics (optional)
 */
async function storeEmailMetadata(db, metadata) {
  try {
    const key = `email:${metadata.domain}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    await db.put(key, JSON.stringify(metadata), {
      expirationTtl: 86400 * 30, // Keep for 30 days
    });
  } catch (error) {
    console.error("Failed to store email metadata:", error);
  }
}
