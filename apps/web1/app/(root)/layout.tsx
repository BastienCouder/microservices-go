import { Sidebar } from "@/components/sidebar/sidebar";
import { MobileFloatingNav } from "@/components/sidebar/mobile-floating-nav";

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
                <MobileFloatingNav />

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
