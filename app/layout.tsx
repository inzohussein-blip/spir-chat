import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { LOCALE_DIR } from "@/lib/i18n/config";
import { I18nProvider } from "@/components/i18n-provider";
import { SITE_URL } from "@/lib/site";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "SpirChat - Live chat and chatbots for website and social",
    template: "%s | SpirChat",
  },
  description:
    "One inbox for website live chat plus DMs and comments across Instagram, Facebook, WhatsApp, Telegram, X, Bluesky, and Reddit. Automate with a visual flow builder and AI. Open source, built on Supabase.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "SpirChat - Live chat and chatbots for website and social",
    description:
      "One inbox for website live chat plus DMs and comments across every major platform. Visual flow builder, AI replies, human takeover. Open source, built on Supabase.",
    url: SITE_URL,
    siteName: "SpirChat",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SpirChat - Live chat and chatbots for website and social",
    description:
      "One inbox for website live chat plus social DMs. Visual flow builder, AI, human takeover. Open source, built on Supabase.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <html lang={locale} dir={LOCALE_DIR[locale]} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark"||(!localStorage.getItem("theme")&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className={inter.className}>
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
