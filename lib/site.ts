// Canonical public site URL. Set NEXT_PUBLIC_APP_URL to your custom domain in
// Vercel (e.g. https://app.yourdomain.com) and everything below follows it:
// metadata/OG, sitemap, robots, and the widget embed snippet.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://spirchat.com"
).replace(/\/$/, "");
