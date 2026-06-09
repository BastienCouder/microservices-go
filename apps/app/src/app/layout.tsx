import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { MobileFloatingNav } from "@/components/sidebar/mobile-floating-nav";

type AppLayoutProps = {
  apiBaseURL: string;
  busy: boolean;
  children: ReactNode;
  feedback: string;
  onLogout: () => Promise<void>;
  onRefresh: () => Promise<void>;
};

export function AppLayout({ apiBaseURL, busy, children, feedback, onLogout, onRefresh }: AppLayoutProps) {
  return (
        <div className="flex h-screen w-full">
            {/* Desktop Sidebar */}
            <Sidebar apiBaseURL={apiBaseURL} busy={busy} className="hidden lg:flex" onLogout={onLogout} />


            <div className="flex flex-col flex-1 overflow-hidden">
                <MobileFloatingNav busy={busy} onLogout={onLogout} />

                <main className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-muted lg:overflow-hidden">
                    {children}
                </main>

                {/* <div className="hidden md:block">
                    <Footer />
                </div> */}
            </div>
        </div>
  );
}
