// Macros — saved action bundles run on a conversation. Concept from Chatwoot.
// Pure helpers here; execution lives in lib/actions/macros.ts.

export type MacroActionType =
  | "add_label"
  | "remove_label"
  | "assign"
  | "send_message"
  | "set_status";

export interface MacroAction {
  type: MacroActionType;
  /** Meaning depends on type: label id, user id (empty = unassign),
   *  message text, or a status ("open" | "closed" | "snoozed"). */
  value: string;
}

export const ACTION_TYPES: MacroActionType[] = [
  "send_message",
  "add_label",
  "remove_label",
  "assign",
  "set_status",
];

export const ACTION_LABELS: Record<MacroActionType, string> = {
  send_message: "Send a message",
  add_label: "Add label",
  remove_label: "Remove label",
  assign: "Assign to",
  set_status: "Set status",
};

export const MACRO_STATUSES = ["open", "closed", "snoozed"] as const;
export type MacroStatus = (typeof MACRO_STATUSES)[number];

/** True when an action requires a free-text / selected value to be meaningful. */
export function actionNeedsValue(type: MacroActionType): boolean {
  // "assign" allows an empty value (unassign), so it never blocks saving.
  return type === "send_message" || type === "add_label" || type === "remove_label" || type === "set_status";
}

/** Safely parse stored actions jsonb into typed actions. */
export function parseMacroActions(raw: unknown): MacroAction[] {
  if (!Array.isArray(raw)) return [];
  const out: MacroAction[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    if (typeof o.type !== "string" || !ACTION_TYPES.includes(o.type as MacroActionType)) continue;
    out.push({
      type: o.type as MacroActionType,
      value: typeof o.value === "string" ? o.value : "",
    });
  }
  return out;
}

/** Drop actions that can't run (missing required value). */
export function validMacroActions(actions: MacroAction[]): MacroAction[] {
  return actions.filter((a) => {
    if (a.type === "set_status") return (MACRO_STATUSES as readonly string[]).includes(a.value);
    if (actionNeedsValue(a.type)) return a.value.trim().length > 0;
    return true;
  });
}
