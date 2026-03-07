import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

type AppLayoutProps = {
  busy: boolean;
  children: ReactNode;
  feedback: string;
  onLogout: () => Promise<void>;
  onRefresh: () => Promise<void>;
};

export function AppLayout({ busy, children, feedback, onLogout, onRefresh }: AppLayoutProps) {
  return (
        <div className="flex h-screen w-full bg-muted/10">
            {/* Desktop Sidebar */}
            <Sidebar busy={busy} className="hidden lg:flex" onLogout={onLogout} />


            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Mobile Header */}
                <header className="flex items-center justify-between border-b bg-background p-4 lg:hidden">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold text-xs">P</div>
                        <span className="font-bold text-sm">bco</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button disabled={busy} onClick={() => void onLogout()} variant="outline">
                            logout
                        </Button>
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-64">
                                <Sidebar busy={busy} className="w-full border-none" onLogout={onLogout} />
                            </SheetContent>
                        </Sheet>
                    </div>
                </header>

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
