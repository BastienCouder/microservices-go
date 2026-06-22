"use client";

import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import {
  buildScopedHref,
  readProjectTokenFromSearch,
  readSelectedProjectID,
} from "@/shared/selection";
import { cn } from "@/shared/utils";
import {
  BRAND_CONTEXT_ITEMS,
  MONITORING_ITEMS,
  OPTIMIZATION_ITEMS,
  SETTINGS_ITEMS,
  SIDEBAR_LABELS,
} from "./sidebar-constants";

function formatMobileLabel(label: string): string {
  return label.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <div className="leading-none">
        <div className="text-[1.7rem] font-black tracking-[-0.06em] text-foreground">
          <img src="/logo.svg" alt="Logo" className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

type MobileFloatingNavProps = {
  busy?: boolean;
  onLogout?: () => Promise<void>;
};

type MobileNavigationItem = {
  href: string;
  label: string;
  promptTab?: "prompts" | "responses";
};

export function MobileFloatingNav({ busy = false, onLogout }: MobileFloatingNavProps) {
  const content = useI18nScope("sidebar");
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const activeProjectToken =
    readProjectTokenFromSearch(location.search) || readSelectedProjectID();
  const activeTab = new URLSearchParams(
    location.search.startsWith("?") ? location.search.slice(1) : location.search,
  ).get("tab");

  const navigationItems = useMemo<MobileNavigationItem[]>(
    () => [
      ...MONITORING_ITEMS.map<MobileNavigationItem>((item) => ({
        href: buildScopedHref(item.href, {
          project: activeProjectToken,
          tab:
            item.labelKey === "responses"
              ? "responses"
              : item.labelKey === "prompts"
                ? "prompts"
                : null,
        }),
        label: formatMobileLabel(content[item.labelKey] || SIDEBAR_LABELS[item.labelKey]),
        promptTab:
          item.labelKey === "responses"
            ? "responses"
            : item.labelKey === "prompts"
              ? "prompts"
              : undefined,
      })),
      {
        href: buildScopedHref("/perception", { project: activeProjectToken }),
        label: content.perception,
      },
      ...OPTIMIZATION_ITEMS.map<MobileNavigationItem>((item) => ({
        href: buildScopedHref(item.href, { project: activeProjectToken }),
        label: formatMobileLabel(content[item.labelKey] || SIDEBAR_LABELS[item.labelKey]),
      })),
      {
        href: buildScopedHref("/traffic", { project: activeProjectToken }),
        label: content.traffic,
      },
      ...BRAND_CONTEXT_ITEMS.map<MobileNavigationItem>((item) => ({
        href: buildScopedHref(item.href, { project: activeProjectToken }),
        label: formatMobileLabel(content[item.labelKey] || SIDEBAR_LABELS[item.labelKey]),
      })),
      ...SETTINGS_ITEMS.map<MobileNavigationItem>((item) => ({
        href: buildScopedHref(item.href, {
          project: activeProjectToken,
        }),
        label: formatMobileLabel(content[item.labelKey] || SIDEBAR_LABELS[item.labelKey]),
      })),
    ],
    [activeProjectToken, content],
  );

  return (
    <>
      <header className="relative inset-x-0 top-0 z-50 lg:hidden">
        <div className="bg-background">
          <div className="flex items-center justify-between px-5 py-4">
            <BrandLockup />

            <div className="flex items-center gap-2">
              <div id="mobile-header-actions-slot" className="contents" />

              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-full border border-white/60 bg-white/20 text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl"
                    aria-label={content.openNavigation}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>

                <SheetContent
                  side="top"
                  showCloseButton={false}
                  className="inset-auto left-3 right-3 top-3 bottom-3 h-auto rounded-[30px] border border-white/70 bg-[rgba(255,255,255,0.76)] p-0 shadow-[0_32px_90px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
                >
                  <SheetTitle className="sr-only">{content.mobileNavigationTitle}</SheetTitle>
                  <SheetDescription className="sr-only">{content.mobileNavigationDescription}</SheetDescription>

                  <div className="flex min-h-[calc(100dvh-1.5rem)] flex-col px-5 pb-5 pt-5">
                    <div className="flex items-start justify-between gap-4">
                      <BrandLockup />
                      <SheetClose asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-full bg-transparent text-foreground/75 hover:bg-white/45 hover:text-foreground"
                          aria-label={content.closeNavigation}
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </SheetClose>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-10">
                      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-2">
                        {navigationItems.map((item) => {
                          const pathname = item.href.split("?", 1)[0];
                          const active =
                            location.pathname === pathname &&
                            (pathname !== "/prompts" ||
                              (item.promptTab ?? "prompts") === (activeTab || "prompts"));

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
                        {content.logout}
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
