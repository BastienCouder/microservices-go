import { memo } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionTitleProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "secondary";
  showIndicator?: boolean;
};

export const SectionTitle = memo(function SectionTitle({
  children,
  className,
  variant = "default",
  showIndicator = true,
}: SectionTitleProps) {
  const baseClasses = "inline-flex items-center gap-2 font-bold uppercase text-sm";

  const variantClasses = {
    default: "text-primary",
    secondary: "text-muted-foreground",
  };

  return (
    <span className={cn(baseClasses, variantClasses[variant], className)}>
      {showIndicator && (
        <span
          aria-hidden="true"
          className="relative flex h-2.5 w-2.5 items-center justify-center text-primary"
        >
          <span className="absolute inset-0 rotate-45 bg-current opacity-35 animate-ping" />

          <svg
            viewBox="0 0 10 10"
            className="relative h-2.5 w-2.5 fill-current"
            focusable="false"
          >
            <polygon points="5,1 9,5 5,9 1,5" />
          </svg>
        </span>
      )}

      <span>{children}</span>
    </span>
  );
});