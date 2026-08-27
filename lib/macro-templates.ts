// Ready-made macro presets. Each uses only channel-agnostic actions
// (send_message / set_status) so it works in any workspace without
// referencing workspace-specific label or agent ids. Messages use merge
// variables, so they personalize on run.
import type { MacroAction } from "@/lib/macros";

export interface MacroTemplate {
  id: string;
  name: string;
  description: string;
  actions: MacroAction[];
}

export const MACRO_TEMPLATES: MacroTemplate[] = [
  {
    id: "welcome",
    name: "Welcome & greet",
    description: "Warm greeting to open a new conversation.",
    actions: [
      {
        type: "send_message",
        value: "Hi {{first_name|there}}! Thanks for reaching out — how can we help you today?",
      },
    ],
  },
  {
    id: "resolve-thanks",
    name: "Resolve with thanks",
    description: "Send a thank-you and mark the conversation resolved.",
    actions: [
      {
        type: "send_message",
        value: "Glad we could help, {{first_name|there}}! I'll close this out — reach out anytime.",
      },
      { type: "set_status", value: "closed" },
    ],
  },
  {
    id: "ask-to-hold",
    name: "Ask to hold",
    description: "Let the contact know you're looking into it and snooze.",
    actions: [
      {
        type: "send_message",
        value: "Thanks for your patience, {{first_name|there}} — I'm looking into this and will get back to you shortly.",
      },
      { type: "set_status", value: "snoozed" },
    ],
  },
  {
    id: "follow-up",
    name: "Follow up",
    description: "Check back in on an open conversation.",
    actions: [
      {
        type: "send_message",
        value: "Hi {{first_name|there}}, just following up — is there anything else I can help you with?",
      },
    ],
  },
  {
    id: "out-of-hours",
    name: "Out of hours",
    description: "Reply after hours and snooze until you're back.",
    actions: [
      {
        type: "send_message",
        value: "Thanks for your message, {{first_name|there}}! We're away right now but will reply as soon as we're back online.",
      },
      { type: "set_status", value: "snoozed" },
    ],
  },
];
