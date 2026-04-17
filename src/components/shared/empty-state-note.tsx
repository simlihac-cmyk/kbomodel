import { cn } from "@/lib/utils/cn";

type EmptyStateNoteProps = {
  message: string;
  className?: string;
};

export function EmptyStateNote({ message, className }: EmptyStateNoteProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted",
        className,
      )}
    >
      {message}
    </div>
  );
}
