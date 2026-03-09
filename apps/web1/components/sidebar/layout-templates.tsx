"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Footer } from "@/components/sidebar/footer";
import { MobileFloatingNav } from "@/components/sidebar/mobile-floating-nav";
import { TopBar } from "@/components/sidebar/top-bar";

export function DesktopSidebarTemplate() {
  return <Sidebar className="hidden md:flex" />;
}

export function MobileHeaderTemplate() {
  return <MobileFloatingNav />;
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
