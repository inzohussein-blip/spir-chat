// SpirChat Telegram gateway — a tiny HTTP service backed by a GramJS user
// account (MTProto). The Bot API can't start conversations with arbitrary
// users; a user account can. SpirChat's direct-campaigns provider POSTs here.
//
// Env:
//   TELEGRAM_API_ID, TELEGRAM_API_HASH  — from https://my.telegram.org
//   TELEGRAM_SESSION                     — from `npm run login`
//   GATEWAY_TOKEN                        — shared secret; must equal SpirChat's
//                                          TELEGRAM_GATEWAY_TOKEN
//   PORT                                 — default 8080
//
// SpirChat side (its own env):
//   TELEGRAM_GATEWAY_URL   = https://your-gateway.example.com
//   TELEGRAM_GATEWAY_TOKEN = <same value as GATEWAY_TOKEN>
//
// ⚠️ Use responsibly and lawfully: only message people who expect to hear from
// you. Unsolicited bulk messaging violates Telegram's ToS and can get the
// account banned.
const express = require("express");
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const session = process.env.TELEGRAM_SESSION || "";
const token = process.env.GATEWAY_TOKEN;
const port = Number(process.env.PORT) || 8080;

if (!apiId || !apiHash || !session || !token) {
  console.error("Missing TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESSION / GATEWAY_TOKEN.");
  process.exit(1);
}

const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
  connectionRetries: 5,
});

// Resolve a recipient ("@username" or "+phone") to a Telegram entity and send.
async function sendTo(to, message) {
  if (to.startsWith("@")) {
    await client.sendMessage(to, { message });
    return;
  }
  // Phone: import as a temporary contact to obtain an access hash, then send.
  const phone = to.replace(/[^\d+]/g, "");
  const res = await client.invoke(
    new Api.contacts.ImportContacts({
      contacts: [
        new Api.InputPhoneContact({
          clientId: BigInt(Math.floor(Math.random() * 1e15)),
          phone,
          firstName: "Lead",
          lastName: "",
        }),
      ],
    })
  );
  const user = res.users && res.users[0];
  if (!user) throw new Error("no_telegram_account_for_number");
  await client.sendMessage(user, { message });
}

const app = express();
app.use(express.json({ limit: "256kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/send", async (req, res) => {
  const auth = req.get("authorization") || "";
  if (auth !== `Bearer ${token}`) return res.status(401).json({ error: "unauthorized" });

  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ error: "to and message are required" });

  try {
    await sendTo(String(to), String(message));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: (e && e.message) || "send_failed" });
  }
});

(async () => {
  await client.connect();
  app.listen(port, () => console.log(`Telegram gateway listening on :${port}`));
})();
