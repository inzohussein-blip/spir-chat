# SpirChat — working notes for Claude

Live chat + chatbot platform for the Arabic market (Tidio / ManyChat / Chatwoot class).
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 (RTL, logical props) ·
Supabase (Auth + Postgres + Realtime + RLS) · Vercel · Meta WhatsApp Cloud API.

## Talking to the user
- Reply in **Arabic**; keep technical terms in English. Be concise.
- "اكمل" / "تابع" means: pick the next highest-value, lowest-risk improvement yourself and ship it end to end.
- Report verification results after every change.

## Verify before every commit
```bash
npx tsc --noEmit
npm run build
npx vitest run
```

## Code conventions
- **UI numbers are Latin digits**: always `toLocale*("en-US")`.
- **i18n**: `lib/i18n/dictionaries.ts`. `en` is the source; `ar` is typed as `Dictionary`, so it must match the shape exactly or `tsc` fails.
- **Provider secrets** stored in the DB are encrypted with `encryptToken` / `decryptToken` from `lib/meta/oauth.ts` (AES-256-GCM).
- **Message bubbles**: customer shows the platform icon; agent uses the primary color.

## Database changes (always all of these)
1. New migration: `supabase/migrations/000NN_name.sql` (next number in sequence).
2. Update `lib/types/database.ts` (Row / Insert / Update).
3. Append the same SQL to the end of `supabase/schema.sql`.
4. Apply it to the live Supabase project **spirchat** (`yxwnrrgnufmetderlcio`) and confirm.

- Never touch the **spirmargin** Supabase project; it's a separate product.
- A `SECURITY DEFINER` function called over RPC must check `is_workspace_member(...)` itself (it bypasses RLS),
  and internal-only functions must not be executable by `anon` / `authenticated` (see `00076`, `00077`).

## Project map (read this first — it replaces exploring the tree)

### Top level
| Path | What |
|---|---|
| `app/` | Next.js App Router: pages, API routes, public surfaces |
| `components/` | Client/server UI shared across pages (inbox, flow builder, settings…) |
| `lib/` | All business logic. `lib/actions/*` = server actions (`"use server"`) called by pages |
| `supabase/migrations/` | Ordered SQL (`00001`→`00078`); `supabase/schema.sql` = all of them concatenated |
| `public/widget.js` | Embeddable website-chat loader; `public/sw.js` = Web Push service worker |
| `services/telegram-gateway/` | Separate Node service (GramJS) for Telegram outreach; not deployed with the app |
| `scripts/smoke-test.mjs` | End-to-end smoke test: creates a test flow and runs it through the webhook |
| `vercel.json` | Crons (daily — Vercel Hobby limit; see README for per-minute options) |
| `README.md` · `SETUP.md` · `PRE-LAUNCH.md` · `PRODUCT.md` | Overview (Arabic) · go-live guide · launch checklist · product positioning |

### Request lifecycle & auth
- `middleware.ts` → `lib/supabase/middleware.ts`: refreshes the Supabase session; redirects `/dashboard*` to `/login` when signed out. `/api/*` and `/auth/callback` always pass through.
- **Two Supabase clients** (`lib/supabase/server.ts`):
  - `createClient()` — the user's session, **RLS applies**. Default for pages and server actions.
  - `createServiceClient()` — service-role key, **bypasses RLS**. Only for webhooks, cron, the public widget/API, and cross-user writes (e.g. `lib/actions/team.ts`, `lib/audit-server.ts`). Always scope by `workspace_id` yourself.
  - `lib/supabase/client.ts` — browser client (Realtime in the inbox).
- **Workspace resolution**: `getWorkspace()` in `lib/workspace.ts` → `{ user, workspace, role, supabase }`. Reads the `spirchat_workspace_id` cookie, prefers an active membership, redirects to `/suspended` when every membership is closed. Every dashboard page/action starts with it.
- **RLS**: nearly every table uses `is_workspace_member(workspace_id)` (requires `is_active`, see `00078`).
- `app/auth/callback/route.ts` — OAuth/email callback; sends new users with a default-named workspace to `/onboarding`.

### Channels: where messages come in and go out
| Channel | Inbound | Messages stored in | Outbound |
|---|---|---|---|
| Instagram / Facebook / Telegram / X / Bluesky / Reddit (via **Zernio**, formerly "Late") | `app/api/webhooks/late/route.ts` → `matchTrigger` → `executeFlow` | **Zernio API** (fetched live by `GET /api/v1/messages`) — only conversation rows are local | `POST /api/v1/messages`, `lib/flow-engine/platform-adapter.ts` |
| Instagram direct (Meta Graph: comment→DM, follow gate) | `app/api/webhooks/meta/route.ts` → `lib/meta/process-comment.ts` | `comment_logs`, retry queue `dm_jobs` | `lib/meta/client.ts`; connect via `app/api/meta/connect` + `callback` |
| WhatsApp (official Meta Cloud API) | `app/api/webhooks/whatsapp/route.ts` (text + delivery/read receipts) | Supabase `messages` | `lib/whatsapp-cloud.ts` (`sendCloudText`, `sendCloudTemplate`) |
| Website widget | `app/api/widget/[channelId]/*` (public, CORS; `messages`, `session`, `presence`, `form`, `upload`, `config`) | Supabase `messages` | Agent replies from the inbox |

- `lib/outbound.ts` `sendConversationMessage()` — send plain text on whatever channel a conversation lives on.
- Inbound side effects: `lib/routing.ts` (auto-assign), `lib/auto-label.ts`, `lib/auto-reply.ts` (business hours), `lib/ai/classify.ts`, `lib/ai/answer.ts` (Help Center AI replies), `lib/push.ts`, `dispatchWebhook` in `lib/api-keys.ts`.
- Zernio: `lib/zernio-client.ts`, `lib/zernio-webhook.ts` (auto-register webhook), `lib/inbox-sync.ts` (backfill). DB columns named `late_*` belong to Zernio.

### Feature → files
| Feature | Page (`app/(dashboard)/dashboard/…`) | Logic / actions | Components |
|---|---|---|---|
| Home dashboard (7-day activity, team, channel health) | `home/page.tsx` | — | — |
| **Inbox** (realtime, presence, bulk, unread in tab title) | `inbox/page.tsx`, `inbox-view.tsx` | `lib/actions/conversations.ts`, `notes.ts`, `macros.ts`, `canned.ts`, `search.ts`, `inbox-views.ts`, `ai-compose.ts`, `presence.ts`; `lib/priority.ts`, `lib/mentions.ts`, `lib/transcript.ts` | `components/inbox/conversation-list.tsx` (Realtime, presence, bulk select), `message-thread.tsx`, `contact-panel.tsx`, `label-picker.tsx`, `tag-editor.tsx` |
| Contacts CRM (tags, custom fields, notes, merge, GDPR erase, CSV) | `contacts/`, `contacts/[contactId]/` | `lib/actions/contacts.ts`, `contact-notes.ts`, `custom-fields.ts`; `lib/csv.ts` | `components/contacts/*` |
| Saved replies / Macros | `saved-replies/`, `macros/` | `lib/actions/canned.ts`, `macros.ts`; `lib/canned.ts`, `lib/macros.ts`, `lib/*-templates.ts` | — |
| **Flow builder** + engine | `flows/`, `flows/[flowId]/`, `flows/templates/` | `lib/flow-engine/engine.ts` (`executeFlow`, `resumeSession`), `trigger-matcher.ts`, `platform-adapter.ts`, `nodes/ai-response.ts`, `simulator.ts`, `types.ts`; API `app/api/v1/flows/*` (versions, publish, restore) | `components/flow-builder/*` (canvas, nodes, panels) |
| ↳ Flow node types | — | `switch` in `lib/flow-engine/engine.ts`: sendMessage, aiResponse, condition, delay, smartDelay, addTag, removeTag, setCustomField, httpRequest, goToFlow, humanTakeover, enrollSequence, subscribe, unsubscribe, abSplit, commentReply, privateReply. New node = engine case + `types.ts` + `components/flow-builder/nodes/` + `panels/` + `simulator.ts` | — |
| Sequences (drip) | `sequences/`, `sequences/[sequenceId]/` | `lib/actions/sequences.ts`, `lib/sequence-processor.ts`; DB trigger `enroll_on_tag` | `components/sequences/*` |
| IG automations (comment→DM) | `ig-automations/` | `lib/actions/meta-automations.ts`, `lib/comment-processor.ts`, `lib/meta/*` | — |
| Broadcasts (social) | `broadcasts/` | `app/api/v1/broadcasts/*`, cron job `send_broadcast` | — |
| Campaigns (email/SMS/WhatsApp to contacts, A/B, schedule) | `campaigns/`, `campaigns/[campaignId]/` | `lib/actions/campaigns.ts`, `lib/campaigns/send.ts`, `lib/campaigns/providers.ts`, `lib/campaign-templates.ts`, `lib/merge.ts` | — |
| **Outreach** (direct campaigns to pasted numbers/emails, WA templates) | `outreach/` | `lib/actions/outreach.ts`, `outreach-templates.ts`; `lib/outreach.ts` (parse), `lib/outreach-process.ts` (send/drain) | `components/outreach/campaign-preview.tsx` |
| Campaign providers (Resend/Twilio/Telegram per workspace) | Settings | `lib/actions/campaign-providers.ts`, `resolveWorkspaceProviders` in `lib/campaigns/providers.ts` (workspace → env fallback) | `components/settings/providers-section.tsx` |
| Segments | `segments/` | `lib/actions/segments.ts`, `lib/segments.ts` (rule engine) | `components/segment-builder.tsx` |
| Growth tools (conversation-starter links per platform) | `growth/growth-view.tsx` | — | — |
| Tracked links (click analytics) | `links/` | `lib/actions/tracking.ts`, `lib/tracking.ts`; public redirect `app/r/[slug]/route.ts` | — |
| Conversational forms | `forms/` | `lib/actions/forms.ts`, `lib/forms.ts`; widget `app/api/widget/[channelId]/form` | — |
| Help Center (KB) | `help-center/` → public `app/help/[slug]/…` | `lib/actions/kb.ts`, `lib/ai/answer.ts` | — |
| Website widget | `widgets/` → public `app/widget/[channelId]/` | `lib/actions/widgets.ts`, `lib/widget.ts`, `lib/widget-server.ts`, `lib/attachments.ts`, `lib/rich-content.ts`, `lib/followup.ts` | `components/widget/widget-chat.tsx` |
| Analytics / Reports (charts, CSAT, agent stats, public share) | `analytics/`, `reports/` → public `app/reports/[slug]/` | `lib/agent-stats.ts`, `lib/volume.ts`, `lib/actions/reports.ts`, `lib/reports/weekly.ts` | — |
| CSAT | public `app/csat/[token]/` | `lib/actions/csat.ts`, `lib/csat.ts` | — |
| Channels (connect Zernio accounts) | `channels/`, `channels/callback/` | `app/api/v1/channels/*` | `components/platform-icon.tsx` |
| **WhatsApp** (status, requirements, webhook, templates, live token health) | `whatsapp/` | `lib/actions/whatsapp-connect.ts` (`checkWhatsAppHealth`), `lib/whatsapp-cloud.ts` | `components/settings/whatsapp-section.tsx`, `embedded-signup-button.tsx` |
| Integrations (Shopify/WooCommerce orders) | `integrations/` | `lib/actions/integrations.ts`, `lib/integrations/orders.ts`, `app/api/v1/orders` | — |
| Developers (API keys, outgoing webhooks) | `developers/` | `lib/actions/developers.ts`, `lib/api-keys.ts`; public API `app/api/public/v1/*` | — |
| Settings | `settings/page.tsx`, `settings-view.tsx` | `lib/actions/workspace.ts` and the section actions | `components/settings/*-section.tsx`: Account, AiReplies, AuditLog, BusinessHours, Followup, LabelRules, Providers, Routing, WeeklyReport, WhatsApp |
| Team (invite, roles, open/close member) | `settings/team/` → `app/invite/[inviteId]/`, `app/(auth)/suspended/` | `lib/actions/team.ts` (`setMemberActive`, `reactivateSelf`) | `components/settings/team-view.tsx` |
| Auth | `app/(auth)/login, register, forgot-password, reset, onboarding, suspended` | `app/auth/callback/route.ts` | `components/auth/oauth-buttons.tsx` |
| Audit log | Settings | `lib/audit.ts` (types), `lib/audit-server.ts` (`recordAudit`, service role) | `audit-log-section.tsx` |
| Web Push | — | `lib/push.ts`, `app/api/push/subscribe`, `public/sw.js` | `components/push-toggle.tsx` |
| i18n / RTL | — | `lib/i18n/` (`dictionaries.ts`, `server.ts`, `actions.ts`, `config.ts`) | `components/i18n-provider.tsx`, `language-switcher.tsx` |
| Shell / navigation | `app/(dashboard)/layout.tsx` | — | `components/sidebar.tsx` (nav items), `topbar.tsx`, `workspace-switcher.tsx`, `presence-heartbeat.tsx` |

### API surfaces
- `app/api/v1/*` — internal, **session-authenticated** (dashboard only).
- `app/api/public/v1/*` — public REST, **Bearer API key** (`authenticateApiKey`).
- `app/api/widget/[channelId]/*` — public widget endpoints (channel id + opaque visitor id; `authorizeWidgetConversation`).
- `app/api/webhooks/{late,meta,whatsapp}` — inbound providers (signature / verify-token checked). Zernio (`late`) dedupes via `webhook_events`.
- `app/api/cron/*` — protected by `CRON_SECRET`.

### Background jobs (`vercel.json`, daily)
- `/api/cron/jobs` — `scheduled_jobs` queue (`resume_flow`, `send_broadcast`, `scheduled_message`) plus: scheduled campaigns, weekly reports (`lib/reports/weekly.ts`), SLA escalation (`lib/sla.ts`), visitor follow-ups (`lib/followup.ts`), auto-close (`lib/auto-close.ts`), scheduled outreach (`lib/outreach-process.ts`). Enqueue with `lib/scheduler.ts`.
- `/api/cron/sequences` — `lib/sequence-processor.ts`.
- `/api/cron/meta` — refresh Meta tokens, drain `dm_jobs`, purge old jobs.

### Database — where each feature's schema lives
`00001` core tables · `00002` RLS · `00003` RPC counters · `00004` comment automation · `00005` sequences · `00006` invites · `00007-08` AI key/provider · `00010` flow versions · `00012` webhook idempotency · `00014-15` job claims · `00016` security hardening · `00017` website channel · `00018` saved replies · `00019` widget config · `00020` conversation notes · `00021` labels · `00022-23` visitor presence/typing · `00024` business hours · `00025` API keys + webhooks · `00026` push · `00027` help center · `00028` routing/SLA · `00029` rich messages · `00030` forms · `00031` campaigns · `00032` integrations · `00034` tracked links · `00036` Meta credentials + `dm_jobs` · `00037` report shares · `00039` segments · `00040/44` CSAT · `00041` macros · `00042-43` campaign schedule/recipients · `00045/48` tag→sequence trigger · `00046` A/B · `00047` weekly reports · `00049` label rules · `00050` snooze · `00051` SLA escalation · `00052` merge contacts · `00053` inbox views · `00054` AI replies · `00055` agent cap · `00056` visitor follow-up · `00057` erase contact · `00058` audit log · `00059` priority · `00060-61` contact notes/company · `00062-64` agent presence/away/typing · `00065` auto-close · `00066-69, 73` outreach · `00070-71` WhatsApp credentials/templates · `00072` read receipts · `00074` campaign providers · `00075` member open/close · `00076-78` security (RPC guards, internal RPCs, active-member RLS).

### Tests
`lib/*.test.ts` (vitest) — pure helpers only (csv, segments, merge, business-hours, outreach parsing, widget, tracking, comment-processor, meta webhook…). Put new pure logic in `lib/` with a test next to it.

## Git
- No pull requests unless explicitly asked.
- Never commit handoff notes, secrets, tokens or `.env` files. Secrets live in Vercel / Supabase settings; `.env.example` lists the names.
