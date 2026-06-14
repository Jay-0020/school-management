export type ToastKind = "success" | "error" | "info";
export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let listeners: Listener[] = [];
let seq = 0;

function emit() {
  for (const l of listeners) l(items);
}

function push(kind: ToastKind, message: string) {
  const id = ++seq;
  items = [...items, { id, kind, message }];
  emit();
  setTimeout(() => dismiss(id), 4200);
}

export function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(l: Listener) {
  listeners.push(l);
  l(items);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

export const toast = {
  success: (m: string) => push("success", m),
  error: (m: string) => push("error", m),
  info: (m: string) => push("info", m),
};
