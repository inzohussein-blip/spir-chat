import { randomBytes } from "node:crypto";
import { SITE_URL } from "@/lib/site";

/** Short, URL-safe token for a public /csat/<token> rating page. */
export function generateCsatToken(): string {
  return randomBytes(9).toString("base64url");
}

/** Public rating URL for a survey token. */
export function buildCsatUrl(token: string, baseUrl: string = SITE_URL): string {
  return `${baseUrl.replace(/\/$/, "")}/csat/${token}`;
}

/** Default survey message posted into the conversation on resolve. */
export function csatMessage(url: string): string {
  return `Thanks for chatting with us! How would you rate your experience? ${url}`;
}

export interface CsatResponse {
  rating: number | null;
  status: string;
}

export interface CsatStats {
  /** Number of surveys that received a rating. */
  responses: number;
  /** Number of surveys sent (pending + responded). */
  sent: number;
  /** Average rating (1-5) over responded surveys, or null when none. */
  average: number | null;
  /** Percentage of ratings that are 4 or 5 (CSAT score), or null when none. */
  satisfactionScore: number | null;
  /** Response rate (responses / sent) as a percentage, or null when none sent. */
  responseRate: number | null;
  /** Count of each rating value 1..5. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

/** Aggregate CSAT metrics from a list of survey rows. Pure + testable. */
export function csatStats(surveys: CsatResponse[]): CsatStats {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let responses = 0;
  let satisfied = 0;
  const sent = surveys.length;

  for (const s of surveys) {
    if (s.rating == null || s.rating < 1 || s.rating > 5) continue;
    const r = Math.round(s.rating) as 1 | 2 | 3 | 4 | 5;
    distribution[r] += 1;
    sum += r;
    responses += 1;
    if (r >= 4) satisfied += 1;
  }

  return {
    responses,
    sent,
    average: responses ? Math.round((sum / responses) * 10) / 10 : null,
    satisfactionScore: responses ? Math.round((satisfied / responses) * 100) : null,
    responseRate: sent ? Math.round((responses / sent) * 100) : null,
    distribution,
  };
}
