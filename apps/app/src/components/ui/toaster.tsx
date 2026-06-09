"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      closeButton
      position="bottom-right"
      toastOptions={{
        duration: 3800,
        classNames: {
          toast:
            "border border-border bg-background text-foreground shadow-lg rounded-xl",
          title: "text-sm font-medium text-foreground",
          description: "text-sm text-muted-foreground",
          closeButton:
            "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
          actionButton:
            "bg-foreground text-background hover:bg-foreground/90",
          cancelButton:
            "border border-border bg-background text-foreground hover:bg-muted",
          success: "border-emerald-500/30",
          error: "border-destructive/40",
          warning: "border-amber-500/40",
          info: "border-sky-500/35",
        },
      }}
    />
  );
}
