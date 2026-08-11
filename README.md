# SpirChat

The open-source ManyChat alternative. Visual flow builder for Instagram, Facebook, Telegram, Twitter/X, Bluesky & Reddit.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/Website-spirchat.com-indigo)](https://spirchat.com)

**Live at [spirchat.com](https://spirchat.com)**

## What is SpirChat?

SpirChat is an open-source alternative to ManyChat. Build visual chatbot flows, manage contacts, send broadcasts, run drip campaigns, and handle live chat conversations across 6 social media platforms.

**Powered by [Zernio](https://zernio.com)** for OAuth, token refresh, rate limiting, and cross-platform messaging.

### Features

- **Visual Flow Builder** - Drag-and-drop chatbot builder with 15+ node types
- **AI Response Node** - AI-powered replies via OpenAI, Anthropic, or Google (Vercel AI SDK)
- **Live Chat Inbox** - Real-time inbox with human takeover and conversation assignment
- **Contact CRM** - Tags, custom fields, segments, and contact management
- **Broadcasting** - Send targeted messages to contact segments
- **Sequences** - Drip campaigns with timed message series and automatic enrollment
- **Team Management** - Invite members, assign roles, manage permissions
- **Multi-Platform** - Instagram, Facebook, Telegram, Twitter/X, Bluesky, Reddit
- **Connect Channels** - OAuth connection flow directly from SpirChat (powered by Zernio)
- **Rich Messaging** - Buttons, quick replies, and carousel cards
- **Comment-to-DM** - Automatically DM users who comment specific keywords
- **Growth Tools** - Conversation starter links for each connected platform
- **A/B Testing** - Split test different message paths
- **Webhooks & HTTP** - Connect to external APIs from your flows

## Quick Start

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Zernio](https://zernio.com) API key (entered in Settings after setup)
- A [Vercel AI Gateway](https://vercel.com/ai-gateway) key (optional, for AI node, entered in Settings or env)

### Setup

1. **Clone the repo**

```bash
git clone https://github.com/inzohussein-blip/spir-chat.git
cd spir-chat
npm install
```

2. **Set up Supabase**

Create a free project at [supabase.com](https://supabase.com). Then, in the
Supabase **SQL Editor**, paste and run [`supabase/schema.sql`](./supabase/schema.sql)
once — it creates the full schema (all migrations consolidated). See
[`SETUP.md`](./SETUP.md) for the complete go-live guide (switching Supabase
projects, custom domains, free-tier notes).

3. **Configure environment**

```bash
cp .env.example .env
```

Fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-cron-secret              # For sequence processor + job scheduler
# AI_GATEWAY_API_KEY=...                  # Optional, for self-hosted (Vercel handles this automatically)
```

After starting the app, go to **Settings** to enter your Zernio API key and (optionally) AI Gateway key.

4. **Run**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and start building flows.

## Background jobs (cron)

Two endpoints drive timed work — `/api/cron/jobs` (delayed flow steps, broadcasts)
and `/api/cron/sequences` (drip-campaign steps). For a responsive product these
should run about once a minute.

Vercel's **Hobby** plan caps cron jobs at **once per day**, so `vercel.json`
ships with daily schedules to keep Hobby deploys building. To restore
minute-level processing, pick one:

- **Vercel Pro** — change both schedules in `vercel.json` back to `* * * * *`.
- **External scheduler** (works on Hobby) — leave Vercel crons daily (or remove
  them) and have a service like [cron-job.org](https://cron-job.org) call each
  endpoint every minute with the shared secret:

  ```
  curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/cron/jobs
  curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/cron/sequences
  ```

## Website widget

Add live chat to any website. In **Dashboard → Website**, create a widget and
copy its snippet:

```html
<script src="https://<your-app>/widget.js" data-spirchat="CHANNEL_ID" async></script>
```

Visitor conversations land in the same inbox as your social channels. Website
threads are stored in Supabase (no Zernio) and served by public, CORS-enabled
`/api/widget/*` endpoints scoped to a channel id and an opaque per-visitor id;
agents reply from the normal inbox.

## Architecture

```
Browser (Flow Builder, Inbox, CRM, Sequences)
        |
   Next.js App Router
        |
   +----+----+----+----+----+
   |    |    |    |    |    |
Webhook Flow CRM  Live  Broadcast Sequence
Recv.  Engine     Chat           Processor
   |    |    |    |    |    |
   +----+----+----+----+----+
        |         |         |
    Supabase   Zernio API AI SDK
  (PG + Auth   (6 platforms) (OpenAI /
  + Realtime)              Anthropic /
                           Google)
```

## Stack

| Layer | Tool |
|-------|------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database + Auth + Realtime | Supabase |
| Flow Builder | React Flow (@xyflow/react) |
| AI | Vercel AI SDK + [AI Gateway](https://vercel.com/ai-gateway) |
| UI | Tailwind CSS 4 |
| Icons | @icons-pack/react-simple-icons |
| Messaging | [Zernio API](https://zernio.com) |

## Flow Node Types

| Node | Description |
|------|-------------|
| Trigger | Keyword, postback, quick reply, welcome, default |
| Send Message | Text, images, buttons, quick replies, carousels |
| AI Response | AI-powered replies with conversation context (OpenAI, Anthropic, Google) |
| Condition | If/else on tags, fields, platform, variables |
| Delay | Wait seconds/minutes/hours/days |
| Add/Remove Tag | Manage contact tags |
| Set Custom Field | Set contact field values with variable interpolation |
| HTTP Request | Call external APIs, store responses |
| Go To Flow | Jump to another flow (with return stack) |
| Human Takeover | Pause automation, alert inbox |
| Enroll in Sequence | Add contact to a drip campaign |
| Subscribe/Unsubscribe | Toggle contact subscription |
| A/B Split | Randomly route contacts for testing |
| Smart Delay | Wait for user response or timeout |
| Comment Reply | Public reply to comments |
| Private Reply | Instagram comment-to-DM |

## Project Structure

```
spir-chat/
├── app/
│   ├── (auth)/             # Login, register pages
│   ├── (dashboard)/        # Flows, inbox, contacts, sequences, settings
│   ├── invite/             # Team invite acceptance page
│   └── api/
│       ├── webhooks/late/   # Webhook receiver
│       ├── cron/jobs/       # Job scheduler
│       ├── cron/sequences/  # Sequence step processor
│       └── v1/              # CRUD API routes
├── components/
│   ├── flow-builder/        # Canvas, nodes, panels
│   ├── inbox/               # Conversation list, thread, contact panel
│   ├── sequences/           # Sequence editor, enrollment list
│   ├── settings/            # Team management
│   └── ui/                  # Shared UI components
├── lib/
│   ├── supabase/            # Server/client/middleware
│   ├── flow-engine/         # Engine, trigger matcher, platform adapter, AI node
│   ├── actions/             # Server actions (team, sequences, workspace)
│   └── types/               # TypeScript types
└── supabase/
    └── migrations/          # SQL schema + RLS policies (00001-00009)
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT

## Credits

SpirChat is built on top of [ZernFlow](https://github.com/zernio-dev/zernflow) by getlate-dev, released under the MIT License. The original copyright notice is preserved in [`LICENSE`](./LICENSE).

<p align="center">
  <a href="https://zernio.com">
    <img src="https://zernio.com/brand/powered-by-zernio.svg" alt="Powered by Zernio" width="180">
  </a>
</p>
