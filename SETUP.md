# SpirChat — setup & go-live

Everything the app needs is driven by environment variables, so switching the
Supabase project or adding a custom domain never requires code changes.

## 1. Point at a Supabase project

Works the same for a brand-new project or when switching to a different one.

1. **Create the schema.** In the Supabase dashboard → **SQL Editor**, paste the
   entire contents of [`supabase/schema.sql`](./supabase/schema.sql) and run it
   once. That creates every table, RLS policy, function, and trigger (migrations
   `00001`–`00021` consolidated), including the website widget, saved replies,
   internal notes, and conversation labels.
   - Only for a *fresh* project. Don't run it twice on the same project.
   - If you prefer, run the individual files in `supabase/migrations/` in order
     instead — same result.

2. **Get the keys.** Supabase → Settings → **API**:
   - Project URL
   - `anon` / publishable key (public)
   - `service_role` key (secret)

3. **Set the environment variables** on Vercel (Project → Settings →
   Environment Variables), then **Redeploy**:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # secret — never commit
   CRON_SECRET=<any long random string>
   NEXT_PUBLIC_APP_URL=<your public URL>          # see §3
   ```

4. **Auth URLs.** Supabase → Authentication → **URL Configuration**:
   - `Site URL` = your public URL (see §3)
   - Add to `Redirect URLs`: `<your public URL>/**`

5. **Create the attachments bucket** (for images/files in chat). Supabase →
   **Storage** → **New bucket**:
   - Name: `chat-attachments`
   - **Public bucket: ON** (so uploaded images/files are viewable by link)
   - Leave the rest default and create it.

   Uploads always go through the server using the `service_role` key, so the
   bucket needs no extra INSERT policies — only the public read that a public
   bucket already grants. If you skip this, chat text still works; the paperclip
   button just returns an "Upload failed" until the bucket exists.

That's all a project switch needs — no code edits.

## 2. Free tier notes

Running on the free Vercel + Supabase plans is fully supported:

- **Cron runs once per day** on Vercel Hobby (`vercel.json`). Delayed flow steps
  and sequences are processed daily. To make them run every minute, upgrade to
  Vercel Pro and change both schedules in `vercel.json` back to `* * * * *`, or
  hit `/api/cron/jobs` and `/api/cron/sequences` every minute from an external
  scheduler with the `CRON_SECRET` (see the README).
- **Supabase free projects pause after ~1 week of inactivity** and resume on the
  next request. Fine for low-traffic use; upgrade to Pro to keep it always-on
  with daily backups.

## 3. Add a custom domain (later)

1. **Vercel** → Project → Settings → **Domains** → add your domain. Vercel shows
   the DNS records to create at your registrar:
   - subdomain (`app.yourdomain.com`): `CNAME` → `cname.vercel-dns.com`
   - apex (`yourdomain.com`): `A` → `76.76.21.21`
   SSL is issued automatically after the DNS verifies.

2. Set `NEXT_PUBLIC_APP_URL=https://yourdomain.com` on Vercel and **Redeploy**.
   The widget embed snippet, metadata/OG tags, `sitemap.xml`, and `robots.txt`
   all follow this value automatically (see `lib/site.ts`).

3. Update the Supabase **Auth URLs** (§1 step 4) to the new domain, otherwise
   login and email confirmation break on it.

The website chat widget keeps working on any customer site regardless of your
domain — its API sends `Access-Control-Allow-Origin: *`.
