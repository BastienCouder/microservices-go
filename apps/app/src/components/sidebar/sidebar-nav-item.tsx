"use client";

import { type ComponentType } from "react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/shared/utils";
import { Link } from "react-router-dom";

type SidebarNavItemProps = {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  indent?: boolean;
  collapsed?: boolean;
};

export function SidebarSectionHeader({
  icon: Icon,
  iconSrc,
  label,
  collapsed,
}: {
  icon?: ComponentType<{ className?: string }>;
  iconSrc?: string;
  label: string;
  collapsed: boolean;
}) {
  if (collapsed) return <Separator className="my-2" />;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      {iconSrc ? (
        <span
          aria-hidden="true"
          className="h-[18px] w-[18px] bg-primary"
          style={{
            maskImage: `url(${iconSrc})`,
            WebkitMaskImage: `url(${iconSrc})`,
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
            maskSize: "contain",
            WebkitMaskSize: "contain",
          }}
        />
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      ) : null}
      <span className="text-xs font-semibold text-foreground">{label}</span>
    </div>
  );
}

export function SidebarNavItem({ href, icon: Icon, label, active, indent, collapsed }: SidebarNavItemProps) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={href}
            className={cn(
              "relative flex items-center justify-center rounded-md p-2 transition-colors",
              active ? "bg-primary/8 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {active && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary" />}
            <Icon className={cn("h-4 w-4", active && "text-primary")} />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  if (indent) {
    return (
      <div className="relative flex items-center">
        {active && <span className="absolute left-[10px] top-0 bottom-0 z-10 w-[3px] rounded-full bg-primary" />}
        <div className="w-[22px] shrink-0" />
        <Link
          to={href}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-sm transition-colors",
            active ? "bg-primary/8 font-medium text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          {label}
        </Link>
      </div>
    );
  }

  return (
    <Link
      to={href}
      className={cn(
        "group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active ? "bg-primary/8 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {active && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary" />}
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      {label}
    </Link>
  );
}
