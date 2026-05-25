"use client";

import { Link } from "react-router-dom";

import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/shared/utils";

type SidebarNavItemProps = {
  href: string;
  label: string;
  active: boolean;
  indent?: boolean;
  collapsed?: boolean;
  className?: string;
  onClick?: () => void;
};

type SidebarSectionHeaderProps = {
  label: string;
  collapsed: boolean;
};
const itemClassName = ({
  active,
  collapsed,
  indent,
  className,
}: Pick<SidebarNavItemProps, "active" | "collapsed" | "indent" | "className">) =>
  cn(
    "relative text-sm  rounded-[5px] transition-colors duration-150",
    collapsed
      ? "flex items-center justify-center p-2"
      : "flex items-center py-1.5",
    indent ? "flex-1 px-2" : "pl-3 pr-2",
    active
      ? "bg-white/14 font-medium text-white"
      : "font-medium text-white/78 hover:bg-white/10 hover:text-white",
    className,
  );

function ActiveMarker({
  collapsed,
  indent,
}: Pick<SidebarNavItemProps, "collapsed" | "indent">) {
  return (
    <span
      className={cn(
        "absolute bg-background",
        indent && !collapsed
          ? "left-[10px] top-0 bottom-0 z-10 w-[3px] rounded-full"
          : "left-0 top-1 bottom-1 w-[3px] rounded-r-full",
      )}
    />
  );
}

export function SidebarSectionHeader({
  label,
  collapsed,
}: SidebarSectionHeaderProps) {
  return collapsed ? (
    <Separator className="my-2" />
  ) : (
    <div className="flex items-center px-2 py-1">
      <span className="text-xs font-semibold text-foreground">{label}</span>
    </div>
  );
}

export function SidebarNavItem({
  href,
  label,
  active,
  indent = false,
  collapsed = false,
  className,
  onClick,
}: SidebarNavItemProps) {
  const link = (
    <Link
      to={href}
      onClick={onClick}
      className={itemClassName({ active, collapsed, indent, className })}
    >
      {/* {active && <ActiveMarker collapsed={collapsed} indent={indent} />} */}
      {collapsed ? <span>{label.slice(0, 1)}</span> : label}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  if (indent) {
    return (
      <div className="relative flex items-center">
        <div className="w-[22px] shrink-0" />
        {link}
      </div>
    );
  }

  return link;
}