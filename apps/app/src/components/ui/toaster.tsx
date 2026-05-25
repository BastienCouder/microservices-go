"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      closeButton
      richColors
      position="top-center"
      toastOptions={{ duration: 3800 }}
    />
  );
}
