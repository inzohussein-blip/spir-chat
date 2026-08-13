import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Standard page-header title block: a gradient icon chip next to the title and
 * an optional subtitle. Drop it in where a page previously rendered a bare
 * `<h1>` + `<p>`; any action buttons stay as siblings in the header row.
 */
export function PageTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
