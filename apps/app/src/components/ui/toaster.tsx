"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import {
  dismissToast,
  type ToastItem,
  useToastStore,
} from "./toast-store";

const DEFAULT_TOAST_DURATION = 3200;
const TOAST_EXIT_DURATION = 280;

export function AppToaster() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed top-4 left-1/2 z-50 flex w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const dismissTimeoutRef = useRef<number | null>(null);
  const enterFrameRef = useRef<number | null>(null);
  const hasDescription = Boolean(toast.description);

  useEffect(() => {
    enterFrameRef.current = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    dismissTimeoutRef.current = window.setTimeout(() => {
      startClose();
    }, toast.duration ?? DEFAULT_TOAST_DURATION);

    return () => {
      if (enterFrameRef.current !== null) {
        window.cancelAnimationFrame(enterFrameRef.current);
      }
      if (dismissTimeoutRef.current !== null) {
        window.clearTimeout(dismissTimeoutRef.current);
      }
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [toast.duration, toast.id]);

  const startClose = () => {
    if (isClosing) {
      return;
    }

    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      dismissToast(toast.id);
    }, TOAST_EXIT_DURATION);
  };

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto rounded-lg border border-border/80 bg-background px-4 py-3 text-foreground shadow-lg ring-2 ring-primary/30 transition-all duration-300 ease-out",
        isClosing
          ? "-translate-y-2 scale-[0.98] opacity-0"
          : isVisible
            ? "translate-y-0 scale-100 opacity-100"
            : "-translate-y-2 scale-[0.98] opacity-0",
      )}
    >
      <div className={cn("flex gap-3", hasDescription ? "items-start" : "items-center")}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-5">{toast.title}</div>
          {toast.description ? (
            <div className="mt-1 text-sm leading-5 text-muted-foreground">
              {toast.description}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            "shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground",
            hasDescription ? "self-start" : "self-center",
          )}
          onClick={startClose}
          aria-label="Fermer la notification"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
