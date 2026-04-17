import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="rounded-[2rem] border border-line/70 bg-white/85 px-4 py-5 shadow-panel sm:px-6 sm:py-7">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{eyebrow}</p> : null}
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {description ? <p className="mt-3 text-sm leading-6 text-muted lg:text-base">{description}</p> : null}
        </div>
        {actions ? <div className="w-full shrink-0 lg:w-auto">{actions}</div> : null}
      </div>
    </div>
  );
}
