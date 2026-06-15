import { memo } from "react";
import { LogOut } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { SidebarLanguageSwitcher } from "@/components/sidebar/sidebar-language-switcher";
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
    labelKey: "adminOrganizations",
  },
  {
    href: adminRoutePaths.pricing,
    labelKey: "adminPricing",
  },
  {
    href: adminRoutePaths.models,
    labelKey: "adminModels",
  },
] as const;

function AdminBrandLockup() {
  return (
    <span className="ml-2 truncate text-sm font-semibold text-background">
      <img src="/logo_white.svg" alt="Logo" className="h-10" />
    </span>
  );
}

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
          "sticky top-0 hidden h-screen w-[220px] min-w-[220px] shrink-0 border-r border-border bg-primary text-background lg:flex lg:flex-col",
          className,
        )}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-border/40 px-3">
          <AdminBrandLockup />
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-6">
          <div className="px-2 pb-1 text-xs font-bold uppercase tracking-[0.04em] text-white/55">
            Administration
          </div>
          {ADMIN_ITEMS.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={`${item.href}${search}`}
                className={cn(
                  "flex rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-white/14 text-white"
                    : "text-white/78 hover:bg-white/10 hover:text-white",
                )}
              >
                <span>{content[item.labelKey]}</span>
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-background/40 p-2">
          <div className="mb-1">
            <SidebarLanguageSwitcher collapsed={false} />
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={onLogout}
            disabled={busy}
            className="w-full justify-between rounded-md bg-background/10 px-2 py-1.5 text-sm text-background/80 hover:bg-background/20 hover:text-background"
          >
            <span className="flex items-center gap-2">
              <LogOut className="size-4" />
              <span>{content.logout}</span>
            </span>
          </Button>
        </div>
      </aside>

      <div className="border-b border-border/40 bg-primary px-3 py-3 text-background lg:hidden">
        <div className="mb-3 flex items-center">
          <AdminBrandLockup />
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {ADMIN_ITEMS.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={`${item.href}${search}`}
                className={cn(
                  "inline-flex min-w-fit items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors duration-150",
                  active
                    ? "border-background/20 bg-background text-primary"
                    : "border-white/12 bg-background/10 text-white/78 hover:bg-background/16 hover:text-white",
                )}
              >
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
