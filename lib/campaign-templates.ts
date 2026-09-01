// Campaign templates — ready-made presets that prefill the campaign composer.
// Pure data + a small helper so the picker and its tests share one source.
// Concept mirrors Tidio/ManyChat "start from a template" flows.

export type CampaignChannel = "email" | "sms" | "whatsapp";

export interface CampaignTemplate {
  id: string;
  /** Short label shown on the picker card. */
  name: string;
  /** One-line description of when to use it. */
  description: string;
  /** Emoji shown on the card so the grid scans quickly. */
  icon: string;
  channel: CampaignChannel;
  /** Suggested campaign name to prefill. */
  campaignName: string;
  /** Email subject; ignored for SMS/WhatsApp. */
  subject: string;
  body: string;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "welcome",
    name: "Welcome",
    description: "Greet a new subscriber and set expectations.",
    icon: "👋",
    channel: "email",
    campaignName: "Welcome email",
    subject: "Welcome to the family, {{first_name|there}}!",
    body: "Hi {{first_name|there}},\n\nThanks for joining us — we're thrilled to have you. Keep an eye on your inbox for tips, offers, and updates.\n\nIf you ever need anything, just reply to this message.\n\nTalk soon,\nThe team",
  },
  {
    id: "sale",
    name: "Sale / Promo",
    description: "Announce a limited-time discount.",
    icon: "🏷️",
    channel: "email",
    campaignName: "Sale announcement",
    subject: "{{first_name|Hey}}, a treat for you 🎉",
    body: "Hi {{first_name|there}},\n\nFor a limited time, everything is on sale. Don't miss out — the offer ends soon.\n\nShop now: {link}\n\nSee you there!",
  },
  {
    id: "winback",
    name: "Win-back",
    description: "Re-engage contacts who've gone quiet.",
    icon: "💌",
    channel: "email",
    campaignName: "Win-back",
    subject: "We miss you, {{first_name|friend}}",
    body: "Hi {{first_name|there}},\n\nIt's been a while! We'd love to see you back. Here's a little something to welcome you: {link}\n\nHope to hear from you soon.",
  },
  {
    id: "announcement",
    name: "Announcement",
    description: "Share news or a new feature.",
    icon: "📣",
    channel: "email",
    campaignName: "Announcement",
    subject: "Something new from us",
    body: "Hi {{first_name|there}},\n\nWe've got news to share — we just launched something we think you'll love. Take a look: {link}\n\nAs always, thanks for being with us.",
  },
  {
    id: "sms_reminder",
    name: "SMS reminder",
    description: "Short text nudge — appointment or deadline.",
    icon: "⏰",
    channel: "sms",
    campaignName: "SMS reminder",
    subject: "",
    body: "Hi {{first_name|there}}, this is a friendly reminder from us. Reply STOP to opt out.",
  },
  {
    id: "whatsapp_offer",
    name: "WhatsApp offer",
    description: "Quick WhatsApp broadcast with a link.",
    icon: "💬",
    channel: "whatsapp",
    campaignName: "WhatsApp offer",
    subject: "",
    body: "Hi {{first_name|there}}! 🎁 A special offer just for you — check it out here: {link}",
  },
];

/** Look up a template by id (undefined when unknown). */
export function getCampaignTemplate(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}
