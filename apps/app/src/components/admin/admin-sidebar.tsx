import { memo } from "react";
import { Bot, Building2, LogOut, ScrollText, Shield } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { adminRoutePaths } from "@/shared/admin-routing";
import { cn } from "@/shared/utils";

type AdminSidebarProps = {
  busy?: boolean;
  className?: string;
  onLogout?: () => Promise<void>;
};

const ADMIN_ITEMS = [
  {
    href: adminRoutePaths.organizations,
    icon: Building2,
    labelKey: "adminOrganizations",
  },
  {
    href: adminRoutePaths.pricing,
    icon: ScrollText,
    labelKey: "adminPricing",
  },
  {
    href: adminRoutePaths.models,
    icon: Bot,
    labelKey: "adminModels",
  },
] as const;

function AdminSidebarComponent({
  busy = false,
  className,
  onLogout,
}: AdminSidebarProps) {
  const content = useI18nScope("sidebar");
  const location = useLocation();
  const search = location.search;

  return (
    <>
      <aside
        className={cn(
          "hidden h-screen w-[240px] min-w-[240px] shrink-0 border-r border-border bg-slate-950 text-slate-50 lg:flex lg:flex-col",
          className,
        )}
      >
        <div className="border-b border-slate-800 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-800 text-sky-300">
              <Shield className="size-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Admin
              </p>
              <p className="text-sm font-semibold text-white">Control space</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-5">
          {ADMIN_ITEMS.map((item) => {
            const active = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={`${item.href}${search}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-sky-400/15 text-white"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{content[item.labelKey]}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onLogout}
            disabled={busy}
            className="w-full justify-between rounded-xl bg-slate-900 px-3 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <LogOut className="size-4" />
              <span>{content.logout}</span>
            </span>
          </Button>
        </div>
      </aside>

      <div className="border-b border-border bg-slate-950 px-3 py-3 text-slate-50 lg:hidden">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="size-4 text-sky-300" />
          <span className="text-sm font-semibold">Admin</span>
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {ADMIN_ITEMS.map((item) => {
            const active = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={`${item.href}${search}`}
                className={cn(
                  "inline-flex min-w-fit items-center gap-2 rounded-full border px-3 py-2 text-sm",
                  active
                    ? "border-sky-400/40 bg-sky-400/15 text-white"
                    : "border-slate-700 bg-slate-900 text-slate-200",
                )}
              >
                <Icon className="size-4" />
                <span>{content[item.labelKey]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

export const AdminSidebar = memo(AdminSidebarComponent);
AdminSidebar.displayName = "AdminSidebar";
