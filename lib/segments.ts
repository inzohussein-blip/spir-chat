// Audience segment rules — a small typed rule engine for contact filtering,
// adapted in spirit from Parcelvoy's rules (MIT). Rules are ANDed together.

export type SegmentField =
  | "display_name"
  | "email"
  | "phone"
  | "is_subscribed"
  | "last_interaction_at"
  | "created_at";

export type SegmentOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "is_set"
  | "is_not_set"
  | "is_true"
  | "is_false"
  | "before"
  | "after"
  | "in_last_days";

export interface SegmentRule {
  field: SegmentField;
  operator: SegmentOperator;
  value?: string;
}

export const FIELD_KIND: Record<SegmentField, "string" | "boolean" | "date"> = {
  display_name: "string",
  email: "string",
  phone: "string",
  is_subscribed: "boolean",
  last_interaction_at: "date",
  created_at: "date",
};

export const FIELD_LABELS: Record<SegmentField, string> = {
  display_name: "Name",
  email: "Email",
  phone: "Phone",
  is_subscribed: "Subscribed",
  last_interaction_at: "Last interaction",
  created_at: "Created",
};

/** Operators valid for a field kind. */
export function operatorsFor(field: SegmentField): SegmentOperator[] {
  const kind = FIELD_KIND[field];
  if (kind === "boolean") return ["is_true", "is_false"];
  if (kind === "date") return ["before", "after", "in_last_days", "is_set", "is_not_set"];
  return ["equals", "not_equals", "contains", "is_set", "is_not_set"];
}

/** Safely parse a stored rules jsonb into typed rules. */
export function parseSegmentRules(raw: unknown): SegmentRule[] {
  if (!Array.isArray(raw)) return [];
  const out: SegmentRule[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.field !== "string" || typeof o.operator !== "string") continue;
    if (!(o.field in FIELD_KIND)) continue;
    out.push({
      field: o.field as SegmentField,
      operator: o.operator as SegmentOperator,
      value: typeof o.value === "string" ? o.value : undefined,
    });
  }
  return out;
}

// Contact shape the evaluator/query understands.
export interface SegmentContact {
  display_name: string | null;
  email: string | null;
  phone: string | null;
  is_subscribed: boolean;
  last_interaction_at: string | null;
  created_at: string;
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** Evaluate a single rule against a contact (client-side preview / tests). */
export function ruleMatches(contact: SegmentContact, rule: SegmentRule): boolean {
  const raw = contact[rule.field];
  const v = rule.value ?? "";
  switch (rule.operator) {
    case "is_set":
      return raw != null && raw !== "";
    case "is_not_set":
      return raw == null || raw === "";
    case "is_true":
      return raw === true;
    case "is_false":
      return raw === false || raw == null;
    case "equals":
      return String(raw ?? "").toLowerCase() === v.toLowerCase();
    case "not_equals":
      return String(raw ?? "").toLowerCase() !== v.toLowerCase();
    case "contains":
      return String(raw ?? "").toLowerCase().includes(v.toLowerCase());
    case "before":
      return typeof raw === "string" && new Date(raw) < new Date(v);
    case "after":
      return typeof raw === "string" && new Date(raw) > new Date(v);
    case "in_last_days": {
      const n = Number(v);
      return typeof raw === "string" && !isNaN(n) && new Date(raw) >= new Date(daysAgoIso(n));
    }
    default:
      return false;
  }
}

/** True when a contact matches every rule (empty = matches all). */
export function matchesSegment(contact: SegmentContact, rules: SegmentRule[]): boolean {
  return rules.every((r) => ruleMatches(contact, r));
}

/** One PostgREST filter derived from a rule, for server-side targeting. */
export interface SegmentFilter {
  method: "eq" | "neq" | "ilike" | "is" | "not" | "lt" | "gt" | "gte";
  column: SegmentField;
  value: unknown;
  /** For `not` (used as .not(column, op, value)). */
  notOp?: string;
}

// Minimal shape of the Supabase filter builder methods we chain.
interface FilterableQuery {
  eq(c: string, v: unknown): this;
  neq(c: string, v: unknown): this;
  ilike(c: string, v: string): this;
  is(c: string, v: unknown): this;
  not(c: string, op: string, v: unknown): this;
  lt(c: string, v: unknown): this;
  gt(c: string, v: unknown): this;
  gte(c: string, v: unknown): this;
}

/** Apply a segment's rules to a Supabase contacts query (ANDed). */
export function applySegment<Q extends FilterableQuery>(query: Q, rules: SegmentRule[]): Q {
  let q = query;
  for (const f of segmentFilters(rules)) {
    if (f.method === "not") q = q.not(f.column, f.notOp ?? "is", f.value);
    else if (f.method === "ilike") q = q.ilike(f.column, String(f.value));
    else q = q[f.method](f.column, f.value);
  }
  return q;
}

/** Translate rules into filters applied to a Supabase contacts query. */
export function segmentFilters(rules: SegmentRule[]): SegmentFilter[] {
  const filters: SegmentFilter[] = [];
  for (const rule of rules) {
    const c = rule.field;
    const v = rule.value ?? "";
    switch (rule.operator) {
      case "equals":
        filters.push({ method: "ilike", column: c, value: v });
        break;
      case "not_equals":
        filters.push({ method: "not", column: c, notOp: "ilike", value: v });
        break;
      case "contains":
        filters.push({ method: "ilike", column: c, value: `%${v}%` });
        break;
      case "is_set":
        filters.push({ method: "not", column: c, notOp: "is", value: null });
        break;
      case "is_not_set":
        filters.push({ method: "is", column: c, value: null });
        break;
      case "is_true":
        filters.push({ method: "eq", column: c, value: true });
        break;
      case "is_false":
        filters.push({ method: "eq", column: c, value: false });
        break;
      case "before":
        filters.push({ method: "lt", column: c, value: v });
        break;
      case "after":
        filters.push({ method: "gt", column: c, value: v });
        break;
      case "in_last_days": {
        const n = Number(v);
        if (!isNaN(n)) filters.push({ method: "gte", column: c, value: daysAgoIso(n) });
        break;
      }
    }
  }
  return filters;
}
