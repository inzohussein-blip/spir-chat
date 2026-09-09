# SpirChat Telegram Gateway (GramJS)

A small standalone service that lets SpirChat's **Direct campaigns** send Telegram
messages to phone numbers or `@usernames`. It runs a **real Telegram user account**
via [GramJS](https://gram.js.org/) (MTProto) — the official Bot API cannot start
conversations with users who haven't messaged the bot first, so a user account is
required.

> ⚠️ **Use responsibly and lawfully.** Only message people who expect to hear from
> you. Unsolicited bulk outreach violates Telegram's Terms of Service and risks the
> account being limited or banned. You are responsible for consent and local law.

## 1. Get API credentials

Sign in at <https://my.telegram.org> → **API development tools** → create an app.
Note the `api_id` and `api_hash`.

## 2. Install & log in

```bash
cd services/telegram-gateway
npm install
TELEGRAM_API_ID=123456 TELEGRAM_API_HASH=xxxxx npm run login
```

Enter the phone number, the login code, and 2FA password if set. Copy the printed
**session string**.

## 3. Run the gateway

Set env and start:

```bash
export TELEGRAM_API_ID=123456
export TELEGRAM_API_HASH=xxxxx
export TELEGRAM_SESSION="<session string from step 2>"
export GATEWAY_TOKEN="<a long random secret>"
export PORT=8080
npm start
```

Deploy it anywhere that runs Node (a small VM, Railway, Fly.io, Render…). Put it
behind HTTPS.

## 4. Point SpirChat at it

In SpirChat's own environment (Vercel project env vars):

```
TELEGRAM_GATEWAY_URL   = https://your-gateway.example.com
TELEGRAM_GATEWAY_TOKEN = <same value as GATEWAY_TOKEN>
```

Once both are set, **Telegram** appears as a configured channel on
`/dashboard/outreach`. SpirChat POSTs `{ to, message }` to `POST /send` with a
`Bearer` token; `to` is either `@username` or `+E.164` phone.

## API

- `GET /health` → `{ ok: true }`
- `POST /send` (Bearer `GATEWAY_TOKEN`) body `{ "to": "@handle" | "+9647…", "message": "…" }`
  → `200 { ok: true }` or `4xx/502 { error }`.

## Notes

- Sending to a **phone number** imports it as a temporary contact to resolve the
  account; numbers with no Telegram account return `no_telegram_account_for_number`.
- Keep the session string secret — it is full access to the account.
- Add your own rate limiting / delays between messages; Telegram enforces flood
  limits and will throttle bursts.
