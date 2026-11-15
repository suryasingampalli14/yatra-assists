/**
 * YATRA ASSIST – backend
 * Serves the website and sends a WhatsApp message ("Hi") from the
 * "Yatra Assist" WhatsApp Business number via Meta's WhatsApp Cloud API.
 *
 * Needs Node 18+ (built-in fetch).
 */
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const {
  PORT = 3000,
  WHATSAPP_TOKEN,            // permanent System User access token
  WHATSAPP_PHONE_NUMBER_ID,  // Phone number ID of the Yatra Assist business number
  WHATSAPP_TEMPLATE = "hello_world", // approved template name
  WHATSAPP_TEMPLATE_LANG = "en_US",  // must match the template's language code
  GRAPH_VERSION = "v21.0",
  ALLOWED_ORIGIN = "*",
} = process.env;

const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(cors({ origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN.split(",") }));
app.use(express.static(path.join(__dirname, "public")));

/* --- tiny in-memory rate limit: 5 requests / 10 min per IP (use Redis/express-rate-limit in production) --- */
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now(), win = 10 * 60 * 1000, max = 5;
  const arr = (hits.get(req.ip) || []).filter((t) => now - t < win);
  if (arr.length >= max) return res.status(429).json({ error: "Too many requests. Please try again in a few minutes." });
  arr.push(now); hits.set(req.ip, arr);
  next();
}

/* --- build the WhatsApp payload --- */
function buildPayload(to) {
  // Business-initiated messages MUST use an approved template.
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name: WHATSAPP_TEMPLATE, language: { code: WHATSAPP_TEMPLATE_LANG } },
  };
  return payload;
}

app.post("/api/enquiry", rateLimit, async (req, res) => {
  try {
    const { mobile, service, details } = req.body || {};

    // E.164 digits, India only: 91 + 10 digits starting 6-9
    if (!/^91[6-9]\d{9}$/.test(String(mobile))) {
      return res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number." });
    }
    if (!details || !details.fullName) {
      return res.status(400).json({ error: "Missing enquiry details." });
    }
    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.error("WhatsApp credentials are not configured (.env).");
      return res.status(500).json({ error: "Messaging is not configured on the server yet." });
    }

    // Log the enquiry so the team has it (swap for a DB / Google Sheet / email in production)
    console.log("[enquiry]", new Date().toISOString(), service, mobile, JSON.stringify(details));

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(mobile)),
    });
    const body = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.error("[whatsapp error]", r.status, JSON.stringify(body));
      const code = body?.error?.code;
      const msg =
        code === 131030 ? "This number isn't on the WhatsApp test allow-list yet." :
        code === 131026 ? "That number doesn't appear to be on WhatsApp." :
        "We couldn't send the WhatsApp message. Please check the number and try again.";
      return res.status(502).json({ error: msg });
    }

    return res.json({ ok: true, messageId: body?.messages?.[0]?.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Yatra Assist running → http://localhost:${PORT}`));
