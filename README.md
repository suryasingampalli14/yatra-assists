# Yatra Assist – website + WhatsApp "Hi" bot

```
yatra-assist/
├── public/
│   ├── index.html
│   ├── css/styles.css
│   └── js/script.js
├── server.js          ← sends the WhatsApp message (keeps your token secret)
├── package.json
└── .env.example
```

## Run it
```bash
npm install
cp .env.example .env     # then fill in the two WhatsApp values
npm start                # http://localhost:3000
```

## How it works
1. Visitor fills the form (incl. their WhatsApp number) → `script.js` POSTs to `/api/enquiry`.
2. `server.js` validates the number and calls Meta's **WhatsApp Cloud API** from the "Yatra Assist" business number.
3. The visitor receives the message on WhatsApp.

The call must be made from a server: the access token is a secret and Meta's API can't be called safely from browser JS.

## One-time WhatsApp setup (Meta)
1. https://developers.facebook.com → Create App → type **Business** → add the **WhatsApp** product.
2. In **WhatsApp → API Setup** copy the **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
3. Create a **System User** token (Business Settings → Users → System users) with `whatsapp_business_messaging` permission → `WHATSAPP_TOKEN`. (The 24-hour temporary token on API Setup is fine for testing only.)
4. Register/verify the Yatra Assist number and set its display name to **Yatra Assist**.

### Why a template, and how to send exactly "Hi"
WhatsApp only allows free-text messages inside 24 hours of the *customer* messaging you. Because your bot messages first, it must use a **pre-approved template**.
- Testing: `hello_world` (default) is pre-approved. In test mode you can only message numbers added to the allow-list in API Setup.
- Production: WhatsApp Manager → Message templates → create a **Utility** template, e.g. name `yatra_welcome`, language English, body:
  `Hi {{1}}, thanks for your enquiry with Yatra Assist!` (Meta often rejects a body that is only "Hi"; a short friendly line gets approved quickly.)
  Then set `WHATSAPP_TEMPLATE=yatra_welcome`. If you use a `{{1}}` variable, add a `components` block with the visitor's name in `buildPayload()` in `server.js`.

## Notes
- Replace the text logo and gradient image placeholders with your real logo/photos (`--img` on cards; hero photo hint is in `styles.css`).
- Add real policy pages for Privacy / Terms / Refund links in the footer.
- Collect consent (the form already states they'll be contacted on WhatsApp) — Meta requires opt-in.
- For production add `express-rate-limit`, HTTPS, and store enquiries (DB / Google Sheet / email) instead of `console.log`.

## Deploy on Vercel
`api/enquiry.js` is the serverless version of the API and `public/` is served as the site (`server.js` is only for running locally).
1. Push this folder to a GitHub repo (`.env` and `node_modules` are git-ignored).
2. vercel.com → Add New → Project → import the repo → Framework Preset: **Other** → Deploy.
3. Project → Settings → Environment Variables: add `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_TEMPLATE`, `WHATSAPP_TEMPLATE_LANG`.
4. Deployments → Redeploy (env vars apply only to new deployments).
