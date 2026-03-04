"use client";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Bell, Play, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
    { label: "Monitoring", href: "/dashboard", active: true },
    { label: "Understanding", href: "#", active: false },
    { label: "Correction", href: "#", active: false },
    { label: "Attribution", href: "#", active: false },
];

export function TopBar() {
    return (
        <header className="h-12 border-b bg-background flex items-center justify-end px-6 sticky top-0 z-50">
          

            {/* Actions */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                    <Bell className="h-5 w-5" />
                </Button>
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                </div>
            </div>
        </header>
    );
}
