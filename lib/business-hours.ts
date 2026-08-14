// Business hours + auto-reply helpers (feature 14).
//
// A workspace stores a single business_hours jsonb blob. We evaluate "are we
// open right now?" in the workspace's timezone using Intl (no external tz
// library) so the offline auto-reply fires at the right local time.

export interface DayHours {
  open: boolean;
  from: string; // "HH:MM" 24h
  to: string; // "HH:MM" 24h
}

export interface BusinessHours {
  enabled: boolean;
  timezone: string;
  /** Index 0=Sunday .. 6=Saturday. */
  days: DayHours[];
  replyOffline: string | null;
  replyOnline: string | null;
}

const DEFAULT_TZ = "Asia/Baghdad";

function defaultDays(): DayHours[] {
  // Mon–Fri 09:00–17:00 open, weekend closed (Fri/Sat common in the region,
  // but we keep Sun–Thu style neutral defaults the user can edit).
  return Array.from({ length: 7 }, (_, i) => ({
    open: i >= 1 && i <= 5,
    from: "09:00",
    to: "17:00",
  }));
}

function isValidTime(v: unknown): v is string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** Safely parse a workspace's business_hours jsonb into a typed object. */
export function parseBusinessHours(raw: unknown): BusinessHours {
  const o =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const base = defaultDays();
  const rawDays = Array.isArray(o.days) ? o.days : [];
  const days = base.map((def, i) => {
    const d =
      rawDays[i] && typeof rawDays[i] === "object"
        ? (rawDays[i] as Record<string, unknown>)
        : {};
    return {
      open: d.open === true,
      from: isValidTime(d.from) ? (d.from as string) : def.from,
      to: isValidTime(d.to) ? (d.to as string) : def.to,
    };
  });
  return {
    enabled: o.enabled === true,
    timezone: typeof o.timezone === "string" && o.timezone ? o.timezone : DEFAULT_TZ,
    days,
    replyOffline:
      typeof o.replyOffline === "string" && o.replyOffline.trim()
        ? o.replyOffline.trim().slice(0, 500)
        : null,
    replyOnline:
      typeof o.replyOnline === "string" && o.replyOnline.trim()
        ? o.replyOnline.trim().slice(0, 500)
        : null,
  };
}

/** Minutes since midnight for a "HH:MM" string. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * The weekday (0=Sun..6=Sat) and minutes-since-midnight for `date` rendered in
 * `timeZone`. Falls back to the host clock if the timezone is invalid.
 */
function localParts(date: Date, timeZone: string): { day: number; minutes: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const map: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return { day: map[wd] ?? 0, minutes: hour * 60 + minute };
  } catch {
    return { day: date.getDay(), minutes: date.getHours() * 60 + date.getMinutes() };
  }
}

/**
 * Is the workspace open at `date`? When business hours are disabled we treat it
 * as always open (so no auto-reply fires). Overnight ranges (to < from) wrap
 * past midnight.
 */
export function isOpenAt(config: BusinessHours, date: Date = new Date()): boolean {
  if (!config.enabled) return true;
  const { day, minutes } = localParts(date, config.timezone);
  const today = config.days[day];
  if (!today || !today.open) return false;
  const from = toMinutes(today.from);
  const to = toMinutes(today.to);
  // Zero-length window (from === to) means the day isn't really open.
  if (to === from) return false;
  if (to < from) {
    // Overnight window, e.g. 22:00–06:00.
    return minutes >= from || minutes < to;
  }
  return minutes >= from && minutes < to;
}
