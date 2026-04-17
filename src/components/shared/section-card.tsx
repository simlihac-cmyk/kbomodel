import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type SectionCardProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function SectionCard({
  title,
  subtitle,
  actions,
  className,
  children,
}: SectionCardProps) {
  return (
    <section className={cn("panel", className)}>
      <div className="panel-header">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
