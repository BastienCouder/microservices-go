import { Sidebar } from "@/components/sidebar/sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen w-full bg-muted/10">
            {/* Desktop Sidebar */}
            <Sidebar className="hidden md:flex" />


            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden flex items-center justify-between p-4 border-b bg-background">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold text-xs">P</div>
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

                <main className="relative flex flex-1 flex-col overflow-hidden">
                    {children}
                </main>

                {/* <div className="hidden md:block">
                    <Footer />
                </div> */}
            </div>
        </div>
    );
}
