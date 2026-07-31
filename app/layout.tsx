import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "SpirChat - Live chat and chatbots for website and social",
    template: "%s | SpirChat",
  },
  description:
    "One inbox for website live chat plus DMs and comments across Instagram, Facebook, WhatsApp, Telegram, X, Bluesky, and Reddit. Automate with a visual flow builder and AI. Open source, built on Supabase.",
  metadataBase: new URL("https://spirchat.com"),
  openGraph: {
    title: "SpirChat - Live chat and chatbots for website and social",
    description:
      "One inbox for website live chat plus DMs and comments across every major platform. Visual flow builder, AI replies, human takeover. Open source, built on Supabase.",
    url: "https://spirchat.com",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark"||(!localStorage.getItem("theme")&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
