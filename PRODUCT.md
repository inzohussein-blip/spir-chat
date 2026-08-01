# SpirChat — Product & Differentiation

SpirChat started from the open-source [ZernFlow](https://github.com/zernio-dev/zernflow)
codebase (MIT) and is evolving into its own product. This document tracks how
SpirChat differentiates from its origin and from incumbents like **ManyChat**
and **LiveChat**.

## Positioning

> **One inbox for every conversation** — website live chat *and* social DMs —
> with a visual flow builder, AI, and human takeover. Open source, built on
> Supabase, deployable on Vercel.

ZernFlow targets social messaging automation (a ManyChat alternative). SpirChat
widens the scope to also cover **website live chat** (a LiveChat / Intercom
alternative), unifying both in a single inbox and automation engine.

## Differentiation roadmap

### Shipped
- **Brand identity** — SpirChat logo, gradient visual language (violet → cyan),
  and website-first positioning distinct from ZernFlow.
- **Supabase project** provisioned with the full schema (24 tables, RLS) and a
  security-hardening migration (`00016`) beyond the upstream migrations.
- **Website live-chat widget** — the core LiveChat-style capability ZernFlow
  lacks. An embeddable `/widget.js` loader drops a chat bubble onto any site; a
  `website` channel type (migration `00017`) routes visitor conversations into
  the same unified inbox. Website threads are served entirely from Supabase
  (public, CORS-enabled `/api/widget/*` endpoints, no Zernio), and agents reply
  from the normal inbox. Manage widgets and copy the embed snippet at
  **Dashboard → Website**.
- **Arabic / RTL + i18n foundation** — cookie-based locale with a server
  dictionary + a client provider, `<html lang dir>` flipping to RTL, and a
  language switcher. Arabic is shipped for the public surfaces (landing, login,
  register), the dashboard navigation, every dashboard section header
  (flows, inbox, contacts, broadcasts, analytics, channels, settings, growth,
  sequences, templates, website) plus the inbox empty state, and the embeddable
  widget (its language follows the visitor's browser or a `data-spirchat-lang`
  attribute). Remaining dashboard views inherit RTL layout and their deeper
  body strings are translated incrementally against the same dictionary.

- **Saved replies (canned responses)** — borrowed from Chatwoot. Agents store
  reusable replies keyed by a short code (migration `00018`, managed at
  **Dashboard → Saved replies**) and insert them into the inbox composer via a
  picker button or by typing `/shortcode`.

- **Inbox performance** — per-conversation message cache with in-flight dedup,
  hover/focus prefetch on conversation rows, and preload of the top conversation,
  so opening a thread is instant and repeat opens don't refetch.

### Borrowed / planned from other open-source projects

SpirChat cherry-picks proven features from adjacent open-source tools:

- **From Chatwoot:** saved replies (shipped) and a per-widget pre-chat form +
  greeting that captures the visitor's name/email before chatting (shipped,
  migration `00019`); next — private/internal notes on conversations and CSAT
  ratings.
- **From ChatbotX:** an AI knowledge base (RAG) for the AI-response node.

### Next (high-impact, in priority order)
1. **Finish deep per-view strings** (forms, buttons, table columns, dialogs)
   against the i18n dictionary — the section headers and chrome are already done.
2. **Team collaboration in the inbox** — internal notes, mentions, and
   assignment SLAs.
3. **Analytics dashboard** — conversation volume, response times, flow
   conversion, per channel.

## Architecture (unchanged foundation)

| Layer | Tool |
|-------|------|
| Framework | Next.js 16 (App Router) |
| Database + Auth + Realtime | Supabase |
| Flow builder | React Flow (`@xyflow/react`) |
| AI | Vercel AI SDK |
| Social messaging | Zernio API |
| Hosting | Vercel |

## Attribution

SpirChat is built on ZernFlow by getlate-dev, MIT licensed. The original
copyright is preserved in [`LICENSE`](./LICENSE). See [`README.md`](./README.md)
for setup.
