import { toast } from "sonner";

type ToastAction = {
  label: string;
  onClick: () => void;
};

export function getErrorToastTitle(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }
  return error instanceof Error && error.message.trim() !== ""
    ? error.message
    : fallback;
}

function normalizeToastId(id: string | number): string {
  return String(id);
}

export function pushSuccessToast(title: string, description?: string): string {
  return normalizeToastId(toast.success(title, { description }));
}

export function pushInfoToast(title: string, description?: string, action?: ToastAction): string {
  return normalizeToastId(toast.info(title, { description, action }));
}

export function pushLoadingToast(title: string, description?: string, action?: ToastAction): string {
  return normalizeToastId(
    toast.loading(title, {
      description,
      action,
      duration: Number.POSITIVE_INFINITY,
    }),
  );
}

export function pushWarningToast(title: string, description?: string): string {
  return normalizeToastId(toast.warning(title, { description }));
}

export function pushErrorToast(
  error: unknown,
  fallback: string,
  description?: string,
): string {
  return normalizeToastId(
    toast.error(getErrorToastTitle(error, fallback), { description }),
  );
}

export function dismissToast(id: string | number | null | undefined): void {
  if (id == null) return;
  toast.dismiss(id);
}
