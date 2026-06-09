import { memo } from "react";
import { cn } from "@/lib/utils";

type EmptyStateCardProps = {
  label: string;
  className?: string;
};

export const EmptyStateCard = memo(function EmptyStateCard({ label, className }: EmptyStateCardProps) {
  return (
    <div
      className={cn(
        "flex h-16 items-center justify-center rounded-md border border-dashed border-foreground/20 bg-muted/5 px-3 text-center text-xs leading-relaxed text-muted-foreground md:text-sm",
        className,
      )}
    >
      {label}
    </div>
  );
});
