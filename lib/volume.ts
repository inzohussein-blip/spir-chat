// Time-bucketing for conversation-volume analytics. Pure + testable.

const DAY = 24 * 60 * 60 * 1000;

export interface DayBucket {
  /** Start-of-day timestamp (ms). */
  day: number;
  count: number;
}

/**
 * Count timestamps into the last `days` calendar days (local time), oldest
 * first, always returning `days` buckets (zero-filled).
 */
export function dailyBuckets(isoDates: string[], days: number): DayBucket[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const buckets: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    buckets.push({ day: startOfToday.getTime() - i * DAY, count: 0 });
  }
  const firstDay = buckets[0].day;
  for (const iso of isoDates) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) continue;
    d.setHours(0, 0, 0, 0);
    const idx = Math.round((d.getTime() - firstDay) / DAY);
    if (idx >= 0 && idx < days) buckets[idx].count += 1;
  }
  return buckets;
}

/** Count timestamps by hour of day (0..23), local time. */
export function hourlyBuckets(isoDates: string[]): number[] {
  const hours = new Array(24).fill(0);
  for (const iso of isoDates) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) continue;
    hours[d.getHours()] += 1;
  }
  return hours;
}
