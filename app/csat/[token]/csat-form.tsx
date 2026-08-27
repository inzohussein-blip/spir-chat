"use client";

import { useState } from "react";
import { Star, Loader2, CheckCircle } from "lucide-react";
import { submitCsat } from "@/lib/actions/csat";
import { cn } from "@/lib/utils";

const LABELS = ["", "Very bad", "Bad", "Okay", "Good", "Great"];

export function CsatForm({
  token,
  initialRating,
  initialFeedback,
  alreadyResponded,
}: {
  token: string;
  initialRating: number | null;
  initialFeedback: string | null;
  alreadyResponded: boolean;
}) {
  const [rating, setRating] = useState<number>(initialRating ?? 0);
  const [hover, setHover] = useState<number>(0);
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(alreadyResponded);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!rating || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await submitCsat(token, rating, feedback);
    setSubmitting(false);
    if (res.error) return setError(res.error);
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
          <CheckCircle className="h-7 w-7" />
        </div>
        <h2 className="text-base font-semibold">Thanks for your feedback!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your rating helps us improve.
        </p>
      </div>
    );
  }

  const active = hover || rating;

  return (
    <div>
      <p className="mb-4 text-center text-sm font-medium">
        How would you rate your experience?
      </p>
      <div className="flex items-center justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                "h-9 w-9 transition-colors",
                n <= active
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30"
              )}
            />
          </button>
        ))}
      </div>
      <p className="mt-2 h-5 text-center text-sm font-medium text-muted-foreground">
        {LABELS[active] ?? ""}
      </p>

      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={3}
        placeholder="Tell us more (optional)…"
        className="mt-3 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />

      {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}

      <button
        onClick={submit}
        disabled={!rating || submitting}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Submit rating
      </button>
    </div>
  );
}
