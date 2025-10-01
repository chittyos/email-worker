/**
 * AI-Enhanced Email Worker for ChittyOS
 * Uses Cloudflare Workers AI for intelligent email processing
 */

export default {
  async email(message, env, ctx) {
    const startTime = Date.now();

    // Extract email components
    const [recipientLocal, recipientDomain] = message.to
      .toLowerCase()
      .split("@");
    const subject = message.headers.get("subject") || "";
    const from = message.from.toLowerCase();

    // Generate transaction ID
    const transactionId = `AI-EMAIL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[${transactionId}] AI Email Worker processing:`, {
      from,
      to: message.to,
      domain: recipientDomain,
      subject: subject.substring(0, 50),
    });

    try {
      // Get email body for AI analysis
      const emailBody = await message.text();

      // Run AI analysis in parallel
      const [classification, sentiment, intent, urgency, entities] =
        await Promise.all([
          classifyEmail(env.AI, subject, emailBody),
          analyzeSentiment(env.AI, emailBody),
          detectIntent(env.AI, subject, emailBody),
          checkUrgency(env.AI, subject, emailBody),
          extractEntities(env.AI, emailBody),
        ]);

      console.log(`[${transactionId}] AI Analysis:`, {
        classification,
        sentiment,
        intent,
        urgency,
        entities: entities?.slice(0, 3), // Log first 3 entities
      });

      // Smart routing based on AI analysis
      let forwardTo = await determineSmartRouting(
        recipientLocal,
        recipientDomain,
        classification,
        intent,
        urgency,
        sentiment,
      );

      // Check if auto-response is needed
      if (shouldAutoRespond(classification, intent, recipientLocal)) {
        await sendAutoResponse(
          env,
          message,
          classification,
          intent,
          transactionId,
        );
      }

      // Check for action items
      const actionItems = await extractActionItems(env.AI, emailBody);
      if (actionItems.length > 0) {
        await createTasks(env, actionItems, from, subject, transactionId);
      }

      // Special handling based on classification
      switch (classification) {
        case "invoice":
        case "receipt":
          await handleFinancialEmail(env, message, entities, transactionId);
          break;

        case "legal":
        case "contract":
          await handleLegalEmail(env, message, urgency, transactionId);
          forwardTo = "mgmt@aribia.llc"; // Override for legal
          break;

        case "support":
        case "complaint":
          await createSupportTicket(
            env,
            message,
            sentiment,
            intent,
            transactionId,
          );
          break;

        case "meeting":
        case "calendar":
          await handleCalendarEmail(env, message, entities, transactionId);
          break;

        case "newsletter":
        case "marketing":
          if (recipientLocal !== "sharon" && recipientLocal !== "nick") {
            // Archive marketing emails for non-personal addresses
            await archiveEmail(env, message, transactionId);
            return; // Don't forward
          }
          break;

        case "spam":
          console.log(`[${transactionId}] AI detected spam, rejecting`);
          await message.setReject("Message classified as spam by AI");
          return;
      }

      // Add AI-enhanced headers
      message.headers.set("X-Cloudflare-Worker", "chittyos-email-ai");
      message.headers.set("X-Transaction-ID", transactionId);
      message.headers.set("X-AI-Classification", classification);
      message.headers.set("X-AI-Sentiment", sentiment);
      message.headers.set("X-AI-Intent", intent);
      message.headers.set("X-AI-Urgency", urgency);
      message.headers.set("X-Processing-Time", `${Date.now() - startTime}ms`);

      // Set priority based on urgency
      if (urgency === "high" || urgency === "critical") {
        message.headers.set("X-Priority", "High");
        message.headers.set("Importance", "high");

        // Send urgent notification
        await sendUrgentNotification(env, {
          from,
          to: message.to,
          subject,
          urgency,
          classification,
          transactionId,
        });
      }

      // Forward the email
      console.log(
        `[${transactionId}] Forwarding to ${forwardTo} (${classification}/${urgency})`,
      );
      await message.forward(forwardTo);

      // Store AI insights
      if (env.EMAIL_ANALYTICS) {
        await storeAIInsights(env, {
          transactionId,
          from,
          to: message.to,
          domain: recipientDomain,
          classification,
          sentiment,
          intent,
          urgency,
          entities,
          actionItems,
          forwardedTo: forwardTo,
          processingTime: Date.now() - startTime,
        });
      }

      // Learn from this email for future routing
      if (env.AI_LEARNING) {
        await updateLearningModel(env, {
          from,
          domain: recipientDomain,
          classification,
          routedTo: forwardTo,
          successful: true,
        });
      }
    } catch (error) {
      console.error(`[${transactionId}] Error:`, error);
      // Fallback to standard routing
      await standardRouting(message);
    }
  },
};

// Classify email type using AI
async function classifyEmail(ai, subject, body) {
  if (!ai) return "general";

  try {
    const prompt = `Classify this email into ONE category:
    Categories: invoice, receipt, contract, legal, support, complaint, meeting, calendar,
    newsletter, marketing, personal, business, api-notification, security-alert, spam, general

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
      "spam",
      "general",
    ].includes(category)
      ? category
      : "general";
  } catch (error) {
    console.error("Classification failed:", error);
    return "general";
  }
}

// Analyze email sentiment
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
    console.error("Sentiment analysis failed:", error);
    return "neutral";
  }
}

// Detect user intent
async function detectIntent(ai, subject, body) {
  if (!ai) return "information";

  try {
    const prompt = `What is the sender's intent in this email?
    Subject: ${subject}
    Body: ${body.substring(0, 400)}

    Reply with only: request-action, provide-information, complaint, inquiry,
    confirmation, cancellation, payment, schedule-meeting, or other`;

    const response = await ai.run("@cf/meta/llama-2-7b-chat-int8", {
      prompt,
      max_tokens: 20,
    });

    const intent = response.response.toLowerCase().trim();
    return intent;
  } catch (error) {
    console.error("Intent detection failed:", error);
    return "information";
  }
}

// Check urgency level
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
    console.error("Urgency check failed:", error);
    return hasUrgentKeyword ? "high" : "normal";
  }
}

// Extract entities (dates, amounts, names, etc.)
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
    console.error("Entity extraction failed:", error);
    return [];
  }
}

// Extract action items from email
async function extractActionItems(ai, body) {
  if (!ai) return [];

  try {
    const prompt = `Extract action items or tasks from this email:
    "${body.substring(0, 600)}"

    List any specific tasks or actions requested (max 3, one per line).
    Format: clear, short action items only`;

    const response = await ai.run("@cf/meta/llama-2-7b-chat-int8", {
      prompt,
      max_tokens: 100,
    });

    const actions = response.response
      .split("\n")
      .filter((line) => line.trim().length > 5)
      .slice(0, 3);

    return actions;
  } catch (error) {
    console.error("Action extraction failed:", error);
    return [];
  }
}

// Determine smart routing based on AI analysis
async function determineSmartRouting(
  recipientLocal,
  recipientDomain,
  classification,
  intent,
  urgency,
  sentiment,
) {
  const MGMT_FORWARD = "mgmt@aribia.llc";
  const NICK_FORWARD = "nick@jeanarlene.com";
  const SHARON_FORWARD = "sharon@itcanbellc.com";
  const DEFAULT_FORWARD = "no-reply@itcan.llc";

  // Personal routing takes precedence
  if (recipientLocal === "nick") return NICK_FORWARD;
  if (recipientLocal === "sharon") return SHARON_FORWARD;

  // Urgent items to management
  if (urgency === "critical" || urgency === "high") {
    return MGMT_FORWARD;
  }

  // Classification-based routing
  switch (classification) {
    case "legal":
    case "contract":
    case "invoice":
    case "security-alert":
      return MGMT_FORWARD;

    case "support":
    case "complaint":
      return sentiment === "angry" ? MGMT_FORWARD : DEFAULT_FORWARD;

    case "api-notification":
    case "newsletter":
    case "marketing":
      return DEFAULT_FORWARD;

    default:
      // Standard routing rules
      const mgmtAddresses = [
        "admin",
        "support",
        "legal",
        "security",
        "abuse",
        "postmaster",
        "mgmt",
        "management",
        "web",
      ];
      if (mgmtAddresses.includes(recipientLocal)) {
        return MGMT_FORWARD;
      }
      return DEFAULT_FORWARD;
  }
}

// Check if auto-response should be sent
function shouldAutoRespond(classification, intent, recipientLocal) {
  // Auto-respond to certain types
  const autoRespondTypes = ["support", "inquiry", "meeting"];
  const autoRespondIntents = ["inquiry", "schedule-meeting", "request-action"];

  // Don't auto-respond to no-reply addresses
  if (recipientLocal.includes("reply")) return false;

  return (
    autoRespondTypes.includes(classification) ||
    autoRespondIntents.includes(intent)
  );
}

// Send auto-response
async function sendAutoResponse(
  env,
  message,
  classification,
  intent,
  transactionId,
) {
  // This would integrate with an email sending service
  console.log(
    `[${transactionId}] Would send auto-response for ${classification}/${intent}`,
  );

  // Store auto-response request for processing
  if (env.AUTO_RESPONSES) {
    await env.AUTO_RESPONSES.put(
      `response:${transactionId}`,
      JSON.stringify({
        from: message.from,
        subject: message.headers.get("subject"),
        classification,
        intent,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

// Create tasks from action items
async function createTasks(env, actionItems, from, subject, transactionId) {
  if (!env.TASKS || actionItems.length === 0) return;

  for (const action of actionItems) {
    await env.TASKS.put(
      `task:${transactionId}:${Date.now()}`,
      JSON.stringify({
        action,
        from,
        subject,
        created: new Date().toISOString(),
        status: "pending",
      }),
    );
  }

  console.log(`[${transactionId}] Created ${actionItems.length} tasks`);
}

// Handle financial emails
async function handleFinancialEmail(env, message, entities, transactionId) {
  // Extract amounts and dates
  const amounts = entities.filter(
    (e) => e.type === "amount" || e.value.includes("$"),
  );
  const dates = entities.filter((e) => e.type === "date");

  console.log(`[${transactionId}] Financial email:`, { amounts, dates });

  // Store for accounting
  if (env.FINANCIAL_EMAILS) {
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
  }
}

// Handle legal emails
async function handleLegalEmail(env, message, urgency, transactionId) {
  console.log(`[${transactionId}] Legal email with urgency: ${urgency}`);

  // Store with high priority
  if (env.LEGAL_EMAILS) {
    await env.LEGAL_EMAILS.put(
      `legal:${transactionId}`,
      JSON.stringify({
        from: message.from,
        subject: message.headers.get("subject"),
        urgency,
        timestamp: new Date().toISOString(),
        requiresAction: urgency === "high" || urgency === "critical",
      }),
    );
  }
}

// Create support ticket
async function createSupportTicket(
  env,
  message,
  sentiment,
  intent,
  transactionId,
) {
  if (!env.SUPPORT_TICKETS) return;

  await env.SUPPORT_TICKETS.put(
    `ticket:${transactionId}`,
    JSON.stringify({
      from: message.from,
      subject: message.headers.get("subject"),
      sentiment,
      intent,
      priority: sentiment === "angry" ? "high" : "normal",
      status: "open",
      created: new Date().toISOString(),
    }),
  );

  console.log(`[${transactionId}] Support ticket created (${sentiment})`);
}

// Handle calendar/meeting emails
async function handleCalendarEmail(env, message, entities, transactionId) {
  const dates = entities.filter((e) => e.type === "date" || e.type === "time");

  if (dates.length > 0 && env.CALENDAR_EVENTS) {
    await env.CALENDAR_EVENTS.put(
      `event:${transactionId}`,
      JSON.stringify({
        from: message.from,
        subject: message.headers.get("subject"),
        dates,
        timestamp: new Date().toISOString(),
      }),
    );

    console.log(`[${transactionId}] Calendar event detected:`, dates);
  }
}

// Archive email
async function archiveEmail(env, message, transactionId) {
  if (!env.EMAIL_ARCHIVE) return;

  await env.EMAIL_ARCHIVE.put(
    `archive:${transactionId}`,
    JSON.stringify({
      from: message.from,
      to: message.to,
      subject: message.headers.get("subject"),
      archived: new Date().toISOString(),
      reason: "auto-archive",
    }),
  );

  console.log(`[${transactionId}] Email archived`);
}

// Send urgent notification
async function sendUrgentNotification(env, data) {
  if (!env.WEBHOOK_URL) return;

  try {
    await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Urgency": data.urgency,
      },
      body: JSON.stringify({
        ...data,
        alert: "URGENT_EMAIL",
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("Failed to send urgent notification:", error);
  }
}

// Store AI insights for analytics
async function storeAIInsights(env, insights) {
  try {
    const key = `ai:${insights.domain}:${insights.transactionId}`;
    await env.EMAIL_ANALYTICS.put(key, JSON.stringify(insights), {
      expirationTtl: 86400 * 90, // Keep for 90 days
      metadata: {
        classification: insights.classification,
        urgency: insights.urgency,
        domain: insights.domain,
      },
    });
  } catch (error) {
    console.error("Failed to store AI insights:", error);
  }
}

// Update learning model
async function updateLearningModel(env, data) {
  // This would update a learning model for better future routing
  try {
    const key = `learning:${data.from}:${data.classification}`;
    const existing = await env.AI_LEARNING.get(key);

    let stats = existing ? JSON.parse(existing) : { count: 0, routes: {} };
    stats.count++;
    stats.routes[data.routedTo] = (stats.routes[data.routedTo] || 0) + 1;

    await env.AI_LEARNING.put(key, JSON.stringify(stats));
  } catch (error) {
    console.error("Failed to update learning model:", error);
  }
}

// Fallback to standard routing
async function standardRouting(message) {
  const [recipientLocal] = message.to.toLowerCase().split("@");

  const specialRoutes = {
    nick: "nick@jeanarlene.com",
    sharon: "sharon@itcanbellc.com",
    admin: "mgmt@aribia.llc",
    support: "mgmt@aribia.llc",
    legal: "mgmt@aribia.llc",
    security: "mgmt@aribia.llc",
  };

  const forwardTo = specialRoutes[recipientLocal] || "no-reply@itcan.llc";
  await message.forward(forwardTo);
}
