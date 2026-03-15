"use client";

import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  buildScopedHref,
  readOrganizationIdFromSearch,
  readProjectIdFromSearch,
  readSelectedOrganizationID,
  readSelectedProjectID,
} from "@/shared/selection";
import { cn } from "@/shared/utils";
import { MONITORING_ITEMS, ORGANIZATION_ITEMS } from "./sidebar-constants";

function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-10 w-10 shrink-0">
        <span className="absolute left-0 top-3 block h-6 w-4 rounded-[8px] bg-foreground" />
        <span className="absolute left-3 top-0 block h-4 w-5 rounded-[7px] bg-foreground" />
      </div>
      <div className="leading-none">
        <div className="text-[1.7rem] font-black tracking-[-0.06em] text-foreground">bco</div>
      </div>
    </div>
  );
}

type MobileFloatingNavProps = {
  busy?: boolean;
  onLogout?: () => Promise<void>;
};

export function MobileFloatingNav({ busy = false, onLogout }: MobileFloatingNavProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const activeProjectId = readProjectIdFromSearch(location.search) || readSelectedProjectID();
  const activeOrganizationId = readOrganizationIdFromSearch(location.search) || readSelectedOrganizationID();

  const navigationItems = useMemo(
    () => [
      { href: buildScopedHref("/monitoring", { projectId: activeProjectId }), label: "Monitoring" },
      ...MONITORING_ITEMS.map((item) => ({
        href: buildScopedHref(item.href, { projectId: activeProjectId }),
        label: item.labelKey.charAt(0).toUpperCase() + item.labelKey.slice(1),
      })),
      { href: buildScopedHref("/perception", { projectId: activeProjectId }), label: "Perception" },
      { href: buildScopedHref("/optimize/actions", { projectId: activeProjectId }), label: "Optimize actions" },
      { href: buildScopedHref("/optimize/content-optimizer", { projectId: activeProjectId }), label: "Content optimizer" },
      { href: buildScopedHref("/impact", { projectId: activeProjectId }), label: "Impact" },
      ...ORGANIZATION_ITEMS.map((item) => ({
        href: buildScopedHref(item.href, {
          org: activeOrganizationId,
          projectId: activeProjectId,
        }),
        label: item.labelKey.charAt(0).toUpperCase() + item.labelKey.slice(1),
      })),
    ],
    [activeOrganizationId, activeProjectId],
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-3 pb-1 pt-3 lg:hidden">
        <div className="rounded-[28px] border border-white/55 bg-background/42 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <div className="flex items-center justify-between px-5 py-4">
            <BrandLockup />

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-full border border-white/60 bg-white/20 text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl"
                  aria-label="Open navigation"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>

              <SheetContent
                side="top"
                showCloseButton={false}
                className="inset-auto left-3 right-3 top-3 bottom-3 h-auto rounded-[30px] border border-white/70 bg-[rgba(255,255,255,0.76)] p-0 shadow-[0_32px_90px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
              >
                <SheetTitle className="sr-only">Navigation mobile</SheetTitle>
                <SheetDescription className="sr-only">Acces rapide aux sections principales de l application.</SheetDescription>

                <div className="flex min-h-[calc(100dvh-1.5rem)] flex-col px-5 pb-5 pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <BrandLockup />
                    <SheetClose asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full bg-transparent text-foreground/75 hover:bg-white/45 hover:text-foreground"
                        aria-label="Close navigation"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </SheetClose>
                  </div>

                  <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-10">
                    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-2">
                      {navigationItems.map((item) => {
                        const active = location.pathname === item.href;

                        return (
                          <SheetClose asChild key={item.href}>
                            <Link
                              to={item.href}
                              className={cn(
                                "w-full rounded-full px-5 py-4 text-center text-[1.15rem] font-semibold tracking-[-0.02em] transition-all duration-200",
                                active
                                  ? "bg-primary text-primary-foreground shadow-[0_18px_40px_rgba(50,72,149,0.24)]"
                                  : "text-foreground/80 hover:bg-white/72 hover:text-foreground",
                              )}
                            >
                              {item.label}
                            </Link>
                          </SheetClose>
                        );
                      })}
                    </div>
                  </nav>

                  <div className="pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      className="h-14 w-full rounded-[20px] border-white/80 bg-white/70 text-base font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl hover:bg-white"
                      onClick={() => void onLogout?.()}
                    >
                      Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  );
}
