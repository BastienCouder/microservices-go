import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

export type ToastVariant = "success" | "error";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  variant: ToastVariant;
};

type ToastStoreState = {
  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, "id">) => string;
  dismissToast: (id: string) => void;
};

function buildToastId(sequence: number): string {
  return `toast-${sequence}`;
}

export function createToastStore() {
  let sequence = 0;

  return createStore<ToastStoreState>((set) => ({
    toasts: [],
    pushToast: (toast) => {
      sequence += 1;
      const id = buildToastId(sequence);
      set((state) => ({
        toasts: [...state.toasts, { ...toast, id }],
      }));
      return id;
    },
    dismissToast: (id) =>
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      })),
  }));
}

const toastStore = createToastStore();

export function useToastStore<T>(selector: (state: ToastStoreState) => T): T {
  return useStore(toastStore, selector);
}

export function pushToast(toast: Omit<ToastItem, "id">): string {
  return toastStore.getState().pushToast(toast);
}

export function dismissToast(id: string) {
  toastStore.getState().dismissToast(id);
}
