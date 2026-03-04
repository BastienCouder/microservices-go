"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Building2, ChevronsLeft, ChevronsRight, LayoutDashboard, LineChart, Sparkles, Target, Zap } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIntlayer } from "react-intlayer";
import { MONITORING_ITEMS, ORGANIZATION_ITEMS, ORGS } from "./sidebar-constants";
import { SidebarOrganizationSwitcher } from "./sidebar-organization-switcher";
import { SidebarNavItem, SidebarSectionHeader } from "./sidebar-nav-item";

export function Sidebar({ className, activePath }: { className?: string; activePath?: string }) {
  const content = useIntlayer("sidebar");
  const pathname = usePathname();
  const currentPath = activePath || pathname;
  const canonicalCurrentPath = currentPath;
  const [collapsed, setCollapsed] = useState(false);
  const [activeOrg, setActiveOrg] = useState("bco");
  const [orgOpen, setOrgOpen] = useState(false);
  const navLabels = {
    prompts: content.prompts,
    pages: content.pages,
    brands: content.brands,
    models: content.models,
    organizations: content.organizations,
    team: content.team,
    settings: content.settings,
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "sticky top-0 flex h-screen flex-col border-r border-border bg-background transition-[width,min-width] duration-200 ease-in-out",
          collapsed ? "w-[60px] min-w-[60px]" : "w-[190px] min-w-[190px]",
          className,
        )}
      >
        <div className={cn("h-12 flex items-center px-3", collapsed ? "justify-center" : "gap-2")}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">logo</span>
          </div>
          {!collapsed ? <span className="text-[15px] font-semibold tracking-tight text-foreground">bco</span> : null}
        </div>

        <Separator />

        <SidebarOrganizationSwitcher
          collapsed={collapsed}
          orgs={ORGS}
          activeOrg={activeOrg}
          setActiveOrg={setActiveOrg}
          orgOpen={orgOpen}
          setOrgOpen={setOrgOpen}
        />

        <Separator />

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-1">
            <SidebarNavItem
              href="/dashboard"
              icon={LayoutDashboard}
              label={content.dashboard}
              active={canonicalCurrentPath === "/dashboard"}
              collapsed={collapsed}
            />
          </div>

          <div className="mb-1 mt-4">
            <SidebarSectionHeader iconSrc="/monitoring.svg" label={content.monitoring} collapsed={collapsed} />
            <div className="relative mt-1 space-y-0.5">
              {!collapsed ? <div className="absolute bottom-1 left-[11px] top-1 w-[2px] rounded-full bg-border" /> : null}
              {MONITORING_ITEMS.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={navLabels[item.labelKey]}
                  active={canonicalCurrentPath === item.href}
                  indent={!collapsed}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>

          <div className="mb-1">
            <SidebarNavItem
              href="/perception"
              icon={LineChart}
              label={content.perception}
              active={canonicalCurrentPath === "/perception"}
              collapsed={collapsed}
            />
          </div>
          <div className="mb-1">
            <SidebarNavItem
              href="/optimize/actions"
              icon={Zap}
              label={`${content.optimize} Actions`}
              active={canonicalCurrentPath === "/optimize/actions"}
              collapsed={collapsed}
            />
          </div>
          <div className="mb-1">
            <SidebarNavItem
              href="/optimize/content-optimizer"
              icon={Sparkles}
              label="Content Optimizer"
              active={canonicalCurrentPath === "/optimize/content-optimizer"}
              collapsed={collapsed}
            />
          </div>
          <div className="mb-1">
            <SidebarNavItem
              href="/impact"
              icon={Target}
              label={content.impact}
              active={canonicalCurrentPath === "/impact"}
              collapsed={collapsed}
            />
          </div>

          <div className="mb-1 mt-4">
            <SidebarSectionHeader icon={Building2} label={content.organizations} collapsed={collapsed} />
            <div className="relative mt-1 space-y-0.5">
              {!collapsed ? <div className="absolute bottom-1 left-[11px] top-1 w-[2px] rounded-full bg-border" /> : null}
              {ORGANIZATION_ITEMS.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={navLabels[item.labelKey]}
                  active={canonicalCurrentPath === item.href}
                  indent={!collapsed}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-border p-2">
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              collapsed && "justify-center",
            )}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                <span>{content.collapse}</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
