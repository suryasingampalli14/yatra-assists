// Vercel serverless function: POST /api/enquiry
// Env vars (set in Vercel dashboard): WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
// WHATSAPP_TEMPLATE (default hello_world), WHATSAPP_TEMPLATE_LANG (default en_US)
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    WHATSAPP_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_TEMPLATE = "hello_world",
    WHATSAPP_TEMPLATE_LANG = "en_US",
    GRAPH_VERSION = "v21.0",
  } = process.env;

  try {
    const { mobile, service, details } = req.body || {};

    if (!/^91[6-9]\d{9}$/.test(String(mobile))) {
      return res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number." });
    }
    if (!details || !details.fullName) {
      return res.status(400).json({ error: "Missing enquiry details." });
    }
    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.error("WhatsApp env vars missing");
      return res.status(500).json({ error: "Messaging is not configured on the server yet." });
    }

    // Visible in Vercel → Project → Logs
    console.log("[enquiry]", new Date().toISOString(), service, mobile, JSON.stringify(details));

    const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: mobile,
        type: "template",
        template: { name: WHATSAPP_TEMPLATE, language: { code: WHATSAPP_TEMPLATE_LANG } },
      }),
    });
    const body = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.error("[whatsapp error]", r.status, JSON.stringify(body));
      const code = body && body.error && body.error.code;
      const msg =
        code === 131030 ? "This number isn't on the WhatsApp test allow-list yet." :
        code === 131026 ? "That number doesn't appear to be on WhatsApp." :
        "We couldn't send the WhatsApp message. Please check the number and try again.";
      return res.status(502).json({ error: msg });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
