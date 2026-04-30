import { pushToast } from "./toast-store";

export function getErrorToastTitle(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function pushSuccessToast(title: string, description?: string): string {
  return pushToast({
    title,
    description,
    variant: "success",
  });
}

export function pushErrorToast(error: unknown, fallback: string): string {
  return pushToast({
    title: getErrorToastTitle(error, fallback),
    variant: "error",
  });
}
