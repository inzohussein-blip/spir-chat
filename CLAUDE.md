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

## Git
- No pull requests unless explicitly asked.
- Never commit handoff notes, secrets, tokens or `.env` files. Secrets live in Vercel / Supabase settings; `.env.example` lists the names.
