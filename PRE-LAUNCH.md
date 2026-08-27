# SpirChat — pre-launch checklist

Work top to bottom. Everything degrades gracefully when optional pieces are
missing, so you can launch the core (website live chat + inbox) first and turn
on the rest later.

## 1. Database

- [ ] Run the schema. Fresh project: paste `supabase/schema.sql` in the SQL
      Editor once. Existing project: run new migrations in order.
- [ ] Migrations added over the advanced-feature work: `00024`–`00038`.
      Confirm the latest present with:
      `select max(version) from supabase_migrations.schema_migrations;`
      (or just re-run `schema.sql` on a fresh project).
- [ ] Create the public Storage bucket **`chat-attachments`** (Storage → New
      bucket → Public). Without it, chat text still works; the paperclip button
      returns "Upload failed".

## 2. Core environment (required)

Set on Vercel (Project → Settings → Environment Variables), then redeploy:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (secret)
- [ ] `CRON_SECRET` (any long random string)
- [ ] `NEXT_PUBLIC_APP_URL` (your public URL — drives the widget snippet, OG
      tags, sitemap, tracked-link and report URLs)
- [ ] Supabase Auth → URL Configuration: `Site URL` + `Redirect URLs` = your
      public URL (`<url>/**`).

## 3. Optional capabilities (turn on per feature)

Each is a no-op until configured.

- [ ] **AI classification / replies** — `AI_GATEWAY_API_KEY` (or a per-workspace
      AI key in Settings).
- [ ] **Web Push** — `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (`npx web-push generate-vapid-keys`).
- [ ] **Email campaigns** — `RESEND_API_KEY`, `CAMPAIGN_FROM_EMAIL`.
- [ ] **SMS / WhatsApp campaigns** — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
      `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM`.
- [ ] **Store integrations** — entered in-app on the Integrations page
      (Shopify token / WooCommerce keys), not env.
- [ ] **Direct Meta / Instagram** — `META_APP_ID`, `META_APP_SECRET`,
      `META_WEBHOOK_VERIFY_TOKEN`, optional `META_TOKEN_KEY` (64 hex chars).
      Then in the Meta app: OAuth redirect `<url>/api/meta/callback`, webhook
      `<url>/api/webhooks/meta` (same verify token) subscribed to `comments`
      and `messages`.

## 4. Scheduled jobs (vercel.json)

Crons are daily on Vercel Hobby. Confirm they exist:

- [ ] `/api/cron/jobs` — delayed flow steps
- [ ] `/api/cron/sequences` — sequences
- [ ] `/api/cron/meta` — Meta token refresh + DM retry drain + dm_jobs purge

For faster processing (Meta retries, delayed steps), upgrade to Vercel Pro and
tighten the schedules, or hit the endpoints every minute from an external
scheduler / Supabase `pg_cron` using `CRON_SECRET`.

## 5. Security review

- [ ] RLS is on for every table (the migrations enable it). Spot-check in
      Supabase → Authentication → Policies.
- [ ] Public routes are intentionally public and safe: `/widget/*`,
      `/api/widget/*`, `/r/[slug]`, `/reports/[slug]`, `/help/*`,
      `/api/webhooks/*`, `/api/public/v1/*` (API-key auth). Secrets
      (`meta_credentials`, tokens) are service-role-only.
- [ ] Run `/security-review` on the branch before shipping.

## 6. Smoke test (after deploy)

- [ ] Sign up → create a workspace.
- [ ] Website widget: create one on the Website page, paste the snippet on a
      test page, send a message, reply from the inbox, attach an image.
- [ ] Tracked link: create one, open `/r/<slug>`, confirm the click shows up.
- [ ] (If Meta) Connect Instagram, create an automation, comment the keyword on
      a post, confirm the DM arrives and appears in the inbox + Growth log.
- [ ] (If configured) Send a test email/SMS campaign to yourself.

## 7. Housekeeping

- [ ] Remove any test workspaces/data.
- [ ] Set a real `CAMPAIGN_FROM_EMAIL` on a verified domain (Resend).
- [ ] Confirm the daily crons are firing (Vercel → Deployments → Cron logs).
