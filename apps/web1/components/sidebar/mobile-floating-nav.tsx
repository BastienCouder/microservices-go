"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useIntlayer } from "react-intlayer";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
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

export function MobileFloatingNav() {
  const pathname = usePathname();
  const content = useIntlayer("sidebar");

  const navigationItems = [
    { href: "/dashboard", label: content.dashboard },
    ...MONITORING_ITEMS.map((item) => ({
      href: item.href,
      label: content[item.labelKey],
    })),
    { href: "/perception", label: content.perception },
    { href: "/optimize/actions", label: `${content.optimize} Actions` },
    { href: "/optimize/content-optimizer", label: "Content Optimizer" },
    { href: "/impact", label: content.impact },
    ...ORGANIZATION_ITEMS.map((item) => ({
      href: item.href,
      label: content[item.labelKey],
    })),
  ];

  return (
    <header className="md:hidden px-3 pb-1 pt-3">
      <div className="rounded-[28px] border border-white/65 bg-background/70 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-4">
          <BrandLockup />

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full border border-white/65 bg-white/35 text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>

            <SheetContent
              side="top"
              overlayClassName="bg-[rgba(229,232,239,0.64)] backdrop-blur-xl"
              closeClassName="top-5 right-5 rounded-full bg-transparent p-0 text-foreground/80 hover:bg-transparent hover:text-foreground data-[state=open]:bg-transparent"
              className="left-3 right-3 top-3 bottom-3 h-auto rounded-[30px] border border-white/70 bg-[rgba(255,255,255,0.74)] p-0 shadow-[0_32px_90px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
            >
              <SheetTitle className="sr-only">Navigation mobile</SheetTitle>
              <SheetDescription className="sr-only">Acces rapide aux sections principales.</SheetDescription>

              <div className="flex h-full min-h-[calc(100dvh-1.5rem)] flex-col px-5 pb-5 pt-5">
                <div className="pr-12">
                  <BrandLockup />
                </div>

                <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-10">
                  <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-2">
                    {navigationItems.map((item) => {
                      const active = pathname === item.href;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "w-full rounded-full px-5 py-4 text-center text-[1.15rem] font-semibold tracking-[-0.02em] transition-all duration-200",
                            active
                              ? "bg-primary text-primary-foreground shadow-[0_18px_40px_rgba(50,72,149,0.24)]"
                              : "text-foreground/78 hover:bg-white/70 hover:text-foreground",
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </nav>

                <div className="pt-3">
                  <Link
                    href="/dashboard"
                    className="flex h-14 items-center justify-center rounded-[20px] border border-white/80 bg-white/70 text-base font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl transition-colors hover:bg-white"
                  >
                    Open dashboard
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
