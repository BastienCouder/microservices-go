"use client";

import { Activity } from "lucide-react";

export function Footer() {
    return (
        <footer className="h-8 border-t bg-muted/20 flex items-center justify-between px-6 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                    <span className="font-semibold text-foreground">Plan Pro</span>
                    <span>(120/500 prompts used)</span>
                </div>
                <div className="w-px h-3 bg-border" />
                <div className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-green-500" />
                    <span>Last run: 12 min ago</span>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <a href="#" className="hover:text-primary transition-colors">API Documentation</a>
                <a href="#" className="hover:text-primary transition-colors">Export CSV</a>
                <span>v1.2.0</span>
            </div>
        </footer>
    );
}
