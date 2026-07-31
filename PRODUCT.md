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

### Next (high-impact, in priority order)
1. **Website live-chat widget** — an embeddable `<script>` widget + a `website`
   channel type, so businesses can drop live chat onto their own site. This is
   the core LiveChat-style capability ZernFlow lacks. Routes into the same
   unified inbox and flow engine.
2. **Arabic / RTL localization** — first-class RTL layout and Arabic UI for the
   MENA market (deliberately deferred for now, planned).
3. **Team collaboration in the inbox** — internal notes, mentions, and
   assignment SLAs.
4. **Analytics dashboard** — conversation volume, response times, flow
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
