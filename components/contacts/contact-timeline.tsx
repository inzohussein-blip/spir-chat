import { UserPlus, MessageSquare, Megaphone, ListOrdered, Star, Activity } from "lucide-react";

export type TimelineKind = "created" | "conversation" | "campaign" | "sequence" | "csat";

export interface TimelineEvent {
  at: string;
  kind: TimelineKind;
  title: string;
  detail?: string;
}

const ICONS: Record<TimelineKind, typeof Activity> = {
  created: UserPlus,
  conversation: MessageSquare,
  campaign: Megaphone,
  sequence: ListOrdered,
  csat: Star,
};

const TONES: Record<TimelineKind, string> = {
  created: "text-violet-600 bg-violet-100 dark:bg-violet-950/40",
  conversation: "text-blue-600 bg-blue-100 dark:bg-blue-950/40",
  campaign: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40",
  sequence: "text-amber-600 bg-amber-100 dark:bg-amber-950/40",
  csat: "text-pink-600 bg-pink-100 dark:bg-pink-950/40",
};

function fmt(at: string): string {
  return new Date(at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContactTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
        <Activity className="h-3.5 w-3.5" />
        Activity
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground/60">No activity yet</p>
      ) : (
        <ol className="relative space-y-4 ps-6">
          <span className="absolute inset-y-1 start-[11px] w-px bg-border" aria-hidden />
          {events.map((e, i) => {
            const Icon = ICONS[e.kind];
            return (
              <li key={i} className="relative">
                <span
                  className={`absolute -start-6 flex h-6 w-6 items-center justify-center rounded-full ${TONES[e.kind]}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{e.title}</p>
                  {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">{fmt(e.at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
