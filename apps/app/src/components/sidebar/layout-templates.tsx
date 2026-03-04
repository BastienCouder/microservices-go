"use client";

import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Footer } from "@/components/sidebar/footer";
import { TopBar } from "@/components/sidebar/top-bar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function DesktopSidebarTemplate() {
  return <Sidebar className="hidden md:flex" />;
}

export function MobileHeaderTemplate() {
  return (
    <header className="md:hidden flex items-center justify-between p-4 border-b bg-background">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold text-xs">
          P
        </div>
        <span className="font-bold text-sm">bco</span>
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar className="w-full border-none" />
        </SheetContent>
      </Sheet>
    </header>
  );
}

export function ContentTemplate({ children }: { children: ReactNode }) {
  return <main className="flex-1 overflow-y-auto xl:overflow-hidden relative flex flex-col">{children}</main>;
}

export function TopBarTemplate() {
  return <TopBar />;
}

export function FooterTemplate() {
  return (
    <div className="hidden md:block">
      <Footer />
    </div>
  );
}
