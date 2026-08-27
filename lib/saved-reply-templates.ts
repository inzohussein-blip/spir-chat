// Ready-made saved-reply presets. Messages use merge variables so they
// personalize when inserted/sent.
export interface SavedReplyTemplate {
  id: string;
  short_code: string;
  content: string;
  description: string;
}

export const SAVED_REPLY_TEMPLATES: SavedReplyTemplate[] = [
  {
    id: "greeting",
    short_code: "hi",
    content: "Hi {{first_name|there}}! Thanks for reaching out. How can I help you today?",
    description: "Friendly greeting",
  },
  {
    id: "thanks",
    short_code: "thanks",
    content: "Thank you, {{first_name|there}}! Is there anything else I can help you with?",
    description: "Thank-you / wrap-up",
  },
  {
    id: "hold",
    short_code: "hold",
    content: "Give me one moment while I look into that for you 🙏",
    description: "Ask the contact to hold",
  },
  {
    id: "pricing",
    short_code: "pricing",
    content: "Happy to help with pricing! Could you tell me a bit more about what you're looking for so I can point you to the right plan?",
    description: "Pricing enquiry",
  },
  {
    id: "hours",
    short_code: "hours",
    content: "Thanks for your message! Our team is offline right now but we'll get back to you as soon as we're back online.",
    description: "Away / out of hours",
  },
];
