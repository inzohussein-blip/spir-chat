// Feature flags. Client-safe (no server-only imports) so both server and
// client components can read them.
//
// CSAT (post-resolution satisfaction surveys) is built and working but turned
// off for now — flip this to true to re-enable the inbox action and the
// Reports metrics without touching any of the CSAT code.
export const CSAT_ENABLED = false;
