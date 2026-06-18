import { toast } from "sonner";

type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastId = string | number;

export function getErrorToastTitle(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }
  return error instanceof Error && error.message.trim() !== ""
    ? error.message
    : fallback;
}

export function pushSuccessToast(title: string, description?: string): ToastId {
  return toast.success(title, { description });
}

export function pushInfoToast(title: string, description?: string, action?: ToastAction): ToastId {
  return toast.info(title, { description, action });
}

export function pushLoadingToast(
  title: string,
  description?: string,
  action?: ToastAction,
  id?: ToastId,
): ToastId {
  return toast.loading(title, {
    id,
    description,
    action,
    duration: Number.POSITIVE_INFINITY,
  });
}

export function pushWarningToast(title: string, description?: string): ToastId {
  return toast.warning(title, { description });
}

export function pushErrorToast(
  error: unknown,
  fallback: string,
  description?: string,
): ToastId {
  return toast.error(getErrorToastTitle(error, fallback), { description });
}

export function dismissToast(id: string | number | null | undefined): void {
  if (id == null) return;
  toast.dismiss(id);
}
