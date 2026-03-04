"use client";

import { Bell, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function TopBar() {
  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-end border-b bg-background px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Bell className="h-5 w-5" />
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}
