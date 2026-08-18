// Ready-made Instagram comment→DM automation presets.
// Adapted from OpenReply (MIT): github.com/diwenne/openreply — campaign templates.

export interface AutomationTemplate {
  slug: string;
  title: string;
  category: string;
  summary: string;
  keywords: string[];
  matchType: "contains" | "exact" | "startsWith" | "word";
  dmMessage: string;
  replyText?: string;
  buttonLabel?: string; // suggested button label (destination filled by the user)
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    slug: "dtc-product-link",
    title: "Product link drop",
    category: "Commerce",
    summary: "Turn LINK / SHOP comments into a DM with your product page.",
    keywords: ["LINK", "SHOP", "BUY"],
    matchType: "word",
    dmMessage:
      "Hey {username}, here's the product link you asked for 👇 {link}",
    replyText: "Sent you a DM! 📩",
    buttonLabel: "Shop now",
  },
  {
    slug: "lead-form",
    title: "Lead form",
    category: "Lead gen",
    summary: "Capture leads from HOME / INFO comments with a form link.",
    keywords: ["INFO", "DETAILS", "HOME"],
    matchType: "word",
    dmMessage:
      "Hi {username}! Here's the form to get all the details 👇 {link}",
    replyText: "Check your DMs 💬",
    buttonLabel: "Get details",
  },
  {
    slug: "freebie-download",
    title: "Freebie / download",
    category: "Growth",
    summary: "Deliver a free plan/guide when people comment PLAN or GUIDE.",
    keywords: ["PLAN", "GUIDE", "FREE"],
    matchType: "word",
    dmMessage: "Here you go {username} — your free download 🎁 {link}",
    replyText: "Sent! 🎉",
    buttonLabel: "Download",
  },
  {
    slug: "webinar-signup",
    title: "Webinar / class signup",
    category: "Education",
    summary: "Send a registration link for WEBINAR / CLASS comments.",
    keywords: ["WEBINAR", "CLASS", "LEARN"],
    matchType: "word",
    dmMessage:
      "Hey {username}, here's your free class registration 👇 {link}",
    buttonLabel: "Register",
  },
  {
    slug: "price-list",
    title: "Price list / booking",
    category: "Services",
    summary: "Reply to PRICE / BOOK comments with your menu + booking link.",
    keywords: ["PRICE", "MENU", "BOOK"],
    matchType: "word",
    dmMessage: "Hi {username}! Here's our price list and booking link 👇 {link}",
    buttonLabel: "Book now",
  },
  {
    slug: "event-rsvp",
    title: "Event RSVP",
    category: "Events",
    summary: "Send event details + RSVP for RSVP / TICKET comments.",
    keywords: ["RSVP", "TICKET", "JOIN"],
    matchType: "word",
    dmMessage: "Hey {username}, here are the event details + RSVP 👇 {link}",
    buttonLabel: "RSVP",
  },
  {
    slug: "creator-collab",
    title: "Creator media kit",
    category: "Creators",
    summary: "Reply to COLLAB / RATES comments with your media kit.",
    keywords: ["COLLAB", "RATES", "KIT"],
    matchType: "word",
    dmMessage: "Hi {username}! Here's my media kit and rates 👇 {link}",
    buttonLabel: "View kit",
  },
];

export function getAutomationTemplate(slug: string | null | undefined) {
  if (!slug) return null;
  return AUTOMATION_TEMPLATES.find((t) => t.slug === slug) ?? null;
}
