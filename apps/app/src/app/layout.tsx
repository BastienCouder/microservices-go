import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Sidebar } from "@/components/sidebar/sidebar";
import { MobileFloatingNav } from "@/components/sidebar/mobile-floating-nav";

type AppLayoutProps = {
  apiBaseURL: string;
  busy: boolean;
  children: ReactNode;
  feedback: string;
  userId?: string | number | null;
  onLogout: () => Promise<void>;
  onRefresh: () => Promise<void>;
};

export function AppLayout({ apiBaseURL, busy, children, feedback, userId, onLogout, onRefresh }: AppLayoutProps) {
  return (
        <div className="flex h-screen w-full">
            {/* Desktop Sidebar */}
            <Sidebar apiBaseURL={apiBaseURL} busy={busy} className="hidden lg:flex" userId={userId} onLogout={onLogout} />


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

export function AdminLayout({
  busy,
  children,
  onLogout,
}: Pick<AppLayoutProps, "busy" | "children" | "onLogout">) {
  return (
    <div className="flex h-screen w-full bg-slate-100">
      <AdminSidebar busy={busy} onLogout={onLogout} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-slate-100">
          {children}
        </main>
      </div>
    </div>
  );
}
