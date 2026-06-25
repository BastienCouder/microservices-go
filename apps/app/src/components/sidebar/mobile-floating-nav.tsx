"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { Sidebar } from "./sidebar";

function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <div className="leading-none">
        <div className="text-[1.7rem] font-black tracking-[-0.06em] text-foreground">
          <img src="/logo.svg" alt="Logo" className="h-10 w-auto max-w-[140px] object-contain" />
        </div>
      </div>
    </div>
  );
}

type MobileFloatingNavProps = {
  apiBaseURL?: string;
  busy?: boolean;
  userId?: string | number | null;
  onLogout?: () => Promise<void>;
};

export function MobileFloatingNav({
  apiBaseURL = "",
  busy = false,
  userId = null,
  onLogout,
}: MobileFloatingNavProps) {
  const content = useI18nScope("sidebar");
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky inset-x-0 top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur lg:hidden">
        <div className="bg-transparent">
          <div className="flex items-center justify-between px-5 py-4">
            <BrandLockup />

            <div className="flex items-center gap-2">
              <div id="mobile-header-actions-slot" className="contents" />

              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full border border-border/60 bg-background text-foreground hover:bg-muted/70"
                    aria-label={content.openNavigation}
                  >
                    {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </Button>
                </SheetTrigger>

                <SheetContent
                  side="left"
                  showCloseButton={false}
                  className="data-closed:duration-300 data-open:duration-300 data-[side=left]:data-closed:slide-out-to-left-full data-[side=left]:data-open:slide-in-from-left-full h-dvh w-[86vw] max-w-[320px] border-r-0 bg-transparent p-0 text-background shadow-[0_24px_80px_rgba(15,23,42,0.35)] ease-out sm:w-[320px]"
                >
                  <SheetTitle className="sr-only">{content.mobileNavigationTitle}</SheetTitle>
                  <SheetDescription className="sr-only">{content.mobileNavigationDescription}</SheetDescription>

                  <div className="relative h-full">
                    <Sidebar
                      apiBaseURL={apiBaseURL}
                      busy={busy}
                      userId={userId}
                      onLogout={onLogout}
                      onNavigate={() => setOpen(false)}
                      variant="mobile"
                      className="h-full w-full"
                    />
                    <div className="absolute right-3 top-3">
                      <SheetClose asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-full bg-background/10 text-background/80 hover:bg-background/20 hover:text-background"
                          aria-label={content.closeNavigation}
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </SheetClose>
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
