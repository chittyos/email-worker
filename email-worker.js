/**
 * Universal Email Worker for ChittyOS with Workers AI
 * Automatically handles any domain configured in Cloudflare Email Routing
 * Enhanced with AI-powered classification, sentiment analysis, and smart routing
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
      "chicagofurnishedcondos.com": { priority: false },
      "itcanbellc.com": { priority: true },
      "aribia.llc": { priority: true },
      "aribia.co": { priority: false },
      "apt-arlene.llc": { priority: false },
      "jeanarlene.com": { priority: false },
      "nickyb.me": { priority: true },
      "chittycorp.com": { priority: true },
      // Additional domains will use default config
    };

    try {
      // Rate limiting check
      if (await checkRateLimit(env, message.from)) {
        console.log(`[${transactionId}] Rate limited: ${message.from}`);
        await message.setReject("Rate limit exceeded - please try again later");
        return;
      }

      // Quick spam check (before AI)
      if (await isSpamQuick(message)) {
        console.log(
          `[${transactionId}] Quick spam check failed from ${message.from}`,
        );
        await message.setReject("Message classified as spam");
        return;
      }

      // AI-Enhanced Processing (if available)
      let aiInsights = null;
      if (env.AI) {
        try {
          const emailBody = await message.text();
          const subject = message.headers.get("subject") || "";

          aiInsights = await Promise.all([
            classifyEmail(env.AI, subject, emailBody),
            analyzeSentiment(env.AI, emailBody),
            checkUrgency(env.AI, subject, emailBody),
            extractEntities(env.AI, emailBody),
          ]).then(([classification, sentiment, urgency, entities]) => ({
            classification,
            sentiment,
            urgency,
            entities,
          }));

          console.log(`[${transactionId}] AI Analysis:`, {
            classification: aiInsights.classification,
            sentiment: aiInsights.sentiment,
            urgency: aiInsights.urgency,
            entityCount: aiInsights.entities.length,
          });

          // Reject if AI detects spam
          if (aiInsights.classification === "spam") {
            console.log(`[${transactionId}] AI detected spam, rejecting`);
            await message.setReject("Message classified as spam by AI");
            return;
          }
        } catch (aiError) {
          console.error(
            `[${transactionId}] AI processing failed, continuing without AI:`,
            aiError,
          );
        }
      }

      // Get domain config (use defaults if unknown)
      const domainConfig = KNOWN_DOMAINS[recipientDomain] || {
        priority: false,
      };

      // Determine forwarding address with AI-enhanced routing
      let forwardTo = DEFAULT_FORWARD;

      // Special routing for specific local parts
      const MGMT_FORWARD = "mgmt@aribia.llc";
      const NICK_FORWARD = "nick@jeanarlene.com";
      const SHARON_FORWARD = "sharon@itcanbellc.com";

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
        web: MGMT_FORWARD,

        // Personal routing
        nick: NICK_FORWARD,
        sharon: SHARON_FORWARD,

        // Developer/API emails
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

      // Check for evidence/litigation intake emails
      if (["evidence", "litigation", "intake"].includes(recipientLocal)) {
        if (env.EVIDENCE_ROUTER_URL) {
          // Send to evidence processing worker
          await sendToEvidenceRouter(
            env,
            message,
            aiInsights,
            transactionId,
            "litigation",
          );
          console.log(
            `[${transactionId}] Sent to litigation intake: ${recipientLocal}@${recipientDomain}`,
          );
          return;
        } else {
          console.log(
            `[${transactionId}] Evidence router not configured, forwarding to management`,
          );
          forwardTo = MGMT_FORWARD;
        }
      } else if (
        [
          "finance",
          "accounting",
          "invoice",
          "invoices",
          "billing",
          "bill",
          "pay",
          "payment",
        ].includes(recipientLocal)
      ) {
        if (env.FINANCE_ROUTER_URL) {
          // Send to finance workstream
          await sendToEvidenceRouter(
            env,
            message,
            aiInsights,
            transactionId,
            "finance",
          );
          console.log(
            `[${transactionId}] Sent to finance workstream: ${recipientLocal}@${recipientDomain}`,
          );
          return;
        } else {
          console.log(
            `[${transactionId}] Finance router not configured, forwarding to management`,
          );
          forwardTo = MGMT_FORWARD;
        }
      } else if (
        [
          "compliance",
          "governance",
          "risk",
          "audit",
          "regulatory",
          "ethics",
          "policy",
          "grc",
        ].includes(recipientLocal)
      ) {
        if (env.COMPLIANCE_ROUTER_URL) {
          // Send to compliance/governance workstream
          await sendToEvidenceRouter(
            env,
            message,
            aiInsights,
            transactionId,
            "compliance",
          );
          console.log(
            `[${transactionId}] Sent to compliance workstream: ${recipientLocal}@${recipientDomain}`,
          );
          return;
        } else {
          console.log(
            `[${transactionId}] Compliance router not configured, forwarding to management`,
          );
          forwardTo = MGMT_FORWARD;
        }
      } else if (specialRoutes[recipientLocal] !== undefined) {
        // Use special route if defined
        if (specialRoutes[recipientLocal] === null) {
          console.log(
            `[${transactionId}] Discarding email to ${recipientLocal}@${recipientDomain}`,
          );
          return;
        }
        forwardTo = specialRoutes[recipientLocal];
      }

      // AI-Enhanced Smart Routing
      if (aiInsights) {
        // Override routing based on AI classification
        if (
          aiInsights.classification === "legal" ||
          aiInsights.classification === "contract"
        ) {
          // Legal matters go to litigation workstream
          if (env.EVIDENCE_ROUTER_URL) {
            await sendToEvidenceRouter(
              env,
              message,
              aiInsights,
              transactionId,
              "litigation",
            );
            console.log(
              `[${transactionId}] AI detected legal/contract, sent to litigation workstream`,
            );
            return;
          } else {
            forwardTo = MGMT_FORWARD;
            console.log(
              `[${transactionId}] AI routing: legal/contract -> management`,
            );
          }
        } else if (
          aiInsights.classification === "complaint" &&
          aiInsights.sentiment === "angry"
        ) {
          forwardTo = MGMT_FORWARD;
          console.log(
            `[${transactionId}] AI routing: angry complaint -> management`,
          );
        } else if (
          aiInsights.urgency === "critical" ||
          aiInsights.urgency === "high"
        ) {
          // Route urgent emails to management unless personal
          if (!["nick", "sharon"].includes(recipientLocal)) {
            forwardTo = MGMT_FORWARD;
            console.log(
              `[${transactionId}] AI routing: ${aiInsights.urgency} urgency -> management`,
            );
          }
        }

        // Store AI insights for analytics
        if (env.EMAIL_ANALYTICS) {
          await storeAIInsights(env, {
            transactionId,
            from: message.from,
            to: message.to,
            domain: recipientDomain,
            ...aiInsights,
            forwardedTo: forwardTo,
            processingTime: Date.now() - startTime,
          });
        }

        // Handle special classifications - route to finance workstream
        if (
          aiInsights.classification === "invoice" ||
          aiInsights.classification === "receipt"
        ) {
          if (env.FINANCE_ROUTER_URL) {
            await sendToEvidenceRouter(
              env,
              message,
              aiInsights,
              transactionId,
              "finance",
            );
            console.log(
              `[${transactionId}] AI detected financial email, sent to finance workstream`,
            );
            return; // Don't forward, already routed
          } else {
            await handleFinancialEmail(
              env,
              message,
              aiInsights.entities,
              transactionId,
            );
          }
        }

        // Handle compliance/governance classifications
        if (
          ["compliance", "audit", "regulatory", "governance"].includes(
            aiInsights.classification,
          )
        ) {
          if (env.COMPLIANCE_ROUTER_URL) {
            await sendToEvidenceRouter(
              env,
              message,
              aiInsights,
              transactionId,
              "compliance",
            );
            console.log(
              `[${transactionId}] AI detected ${aiInsights.classification} email, sent to compliance workstream`,
            );
            return; // Don't forward, already routed
          }
        }
      }

      // Check for priority
      const isPriority =
        domainConfig.priority ||
        ["legal", "security", "abuse"].includes(recipientLocal) ||
        checkPrioritySender(message.from) ||
        (aiInsights &&
          (aiInsights.urgency === "high" || aiInsights.urgency === "critical"));

      // Add tracking headers
      message.headers.set("X-Cloudflare-Worker", "chittyos-email-universal-ai");
      message.headers.set("X-Transaction-ID", transactionId);
      message.headers.set("X-Original-To", message.to);
      message.headers.set("X-Routed-Domain", recipientDomain);
      message.headers.set("X-Processing-Time", `${Date.now() - startTime}ms`);

      // Add AI headers if available
      if (aiInsights) {
        message.headers.set("X-AI-Classification", aiInsights.classification);
        message.headers.set("X-AI-Sentiment", aiInsights.sentiment);
        message.headers.set("X-AI-Urgency", aiInsights.urgency);
        if (aiInsights.entities.length > 0) {
          message.headers.set(
            "X-AI-Entities",
            aiInsights.entities.length.toString(),
          );
        }
      }

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
        await message.forward("no-reply@itcan.llc");
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

// Quick spam detection (before AI)
async function isSpamQuick(message) {
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

// ============= AI FUNCTIONS =============

// Classify email type using Workers AI
async function classifyEmail(ai, subject, body) {
  if (!ai) return "general";

  try {
    const prompt = `Classify this email into ONE category:
Categories: invoice, receipt, contract, legal, support, complaint, meeting, calendar,
newsletter, marketing, personal, business, api-notification, security-alert, compliance,
audit, regulatory, governance, spam, general

Subject: ${subject}
Body (first 500 chars): ${body.substring(0, 500)}

Reply with only the category name.`;

    const response = await ai.run("@cf/meta/llama-2-7b-chat-int8", {
      prompt,
      max_tokens: 10,
    });

    const category = response.response.toLowerCase().trim();
    return [
      "invoice",
      "receipt",
      "contract",
      "legal",
      "support",
      "complaint",
      "meeting",
      "calendar",
      "newsletter",
      "marketing",
      "personal",
      "business",
      "api-notification",
      "security-alert",
      "compliance",
      "audit",
      "regulatory",
      "governance",
      "spam",
      "general",
    ].includes(category)
      ? category
      : "general";
  } catch (error) {
    console.error("AI classification failed:", error);
    return "general";
  }
}

// Analyze email sentiment using Workers AI
async function analyzeSentiment(ai, body) {
  if (!ai) return "neutral";

  try {
    const prompt = `Analyze the sentiment of this email:
"${body.substring(0, 500)}"

Reply with only: positive, negative, neutral, urgent, or angry`;

    const response = await ai.run("@cf/meta/llama-2-7b-chat-int8", {
      prompt,
      max_tokens: 10,
    });

    const sentiment = response.response.toLowerCase().trim();
    return ["positive", "negative", "neutral", "urgent", "angry"].includes(
      sentiment,
    )
      ? sentiment
      : "neutral";
  } catch (error) {
    console.error("AI sentiment analysis failed:", error);
    return "neutral";
  }
}

// Check urgency level using Workers AI
async function checkUrgency(ai, subject, body) {
  if (!ai) return "normal";

  // Quick keyword check first
  const urgentKeywords = [
    "urgent",
    "asap",
    "emergency",
    "critical",
    "immediately",
    "deadline",
    "expire",
    "final notice",
    "action required",
  ];
  const combinedText = (subject + " " + body).toLowerCase();

  const hasUrgentKeyword = urgentKeywords.some((keyword) =>
    combinedText.includes(keyword),
  );

  if (!hasUrgentKeyword) return "normal";

  try {
    const prompt = `Rate the urgency of this email:
Subject: ${subject}
Body: ${body.substring(0, 300)}

Reply with only: critical, high, normal, or low`;

    const response = await ai.run("@cf/meta/llama-2-7b-chat-int8", {
      prompt,
      max_tokens: 10,
    });

    const urgency = response.response.toLowerCase().trim();
    return ["critical", "high", "normal", "low"].includes(urgency)
      ? urgency
      : "normal";
  } catch (error) {
    console.error("AI urgency check failed:", error);
    return hasUrgentKeyword ? "high" : "normal";
  }
}

// Extract entities (dates, amounts, names, etc.) using Workers AI
async function extractEntities(ai, body) {
  if (!ai) return [];

  try {
    const prompt = `Extract important entities from this email:
"${body.substring(0, 500)}"

List any: dates, dollar amounts, company names, product names, or important numbers.
Format: entity_type:value (one per line, max 5)`;

    const response = await ai.run("@cf/meta/llama-2-7b-chat-int8", {
      prompt,
      max_tokens: 100,
    });

    const entities = response.response
      .split("\n")
      .filter((line) => line.includes(":"))
      .map((line) => {
        const [type, value] = line.split(":");
        return { type: type.trim(), value: value.trim() };
      })
      .slice(0, 5);

    return entities;
  } catch (error) {
    console.error("AI entity extraction failed:", error);
    return [];
  }
}

// Store AI insights for analytics
async function storeAIInsights(env, insights) {
  try {
    const key = `ai:${insights.domain}:${insights.transactionId}`;
    await env.EMAIL_ANALYTICS.put(
      key,
      JSON.stringify({
        ...insights,
        timestamp: new Date().toISOString(),
      }),
      {
        expirationTtl: 86400 * 90, // Keep for 90 days
        metadata: {
          classification: insights.classification,
          urgency: insights.urgency,
          domain: insights.domain,
        },
      },
    );
  } catch (error) {
    console.error("Failed to store AI insights:", error);
  }
}

// Handle financial emails (invoices, receipts)
async function handleFinancialEmail(env, message, entities, transactionId) {
  if (!env.FINANCIAL_EMAILS) return;

  const amounts = entities.filter(
    (e) => e.type === "amount" || e.value.includes("$"),
  );
  const dates = entities.filter((e) => e.type === "date");

  console.log(`[${transactionId}] Financial email:`, { amounts, dates });

  try {
    await env.FINANCIAL_EMAILS.put(
      `financial:${transactionId}`,
      JSON.stringify({
        from: message.from,
        subject: message.headers.get("subject"),
        amounts,
        dates,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Failed to store financial email:", error);
  }
}

// Send email to workstream router (evidence/litigation or finance)
async function sendToEvidenceRouter(
  env,
  message,
  aiInsights,
  transactionId,
  workstream = "litigation",
) {
  try {
    const emailData = {
      transactionId,
      from: message.from,
      to: message.to,
      subject: message.headers.get("subject"),
      timestamp: new Date().toISOString(),
      workstream, // "litigation" or "finance"
      aiInsights: aiInsights || {},
      rawEmail: await message.raw(),
    };

    // Determine router URL based on workstream
    const routerUrl =
      workstream === "finance"
        ? env.FINANCE_ROUTER_URL || env.EVIDENCE_ROUTER_URL
        : env.EVIDENCE_ROUTER_URL;

    if (!routerUrl) {
      throw new Error(`No router URL configured for ${workstream} workstream`);
    }

    // Send to router worker
    const response = await fetch(routerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Transaction-ID": transactionId,
        "X-ChittyOS-Event": `${workstream}-intake`,
        "X-Workstream": workstream,
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      throw new Error(
        `${workstream} router returned ${response.status}: ${await response.text()}`,
      );
    }

    console.log(`[${transactionId}] Successfully sent to ${workstream} router`);
  } catch (error) {
    console.error(
      `[${transactionId}] Failed to send to ${workstream} router:`,
      error,
    );
    // Fallback: forward to management
    await message.forward("mgmt@aribia.llc");
  }
}
