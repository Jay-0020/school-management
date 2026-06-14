import { useEffect, useState } from "react";
import { dismiss, subscribeToasts, type ToastItem } from "../lib/toast";
import { IconAlert, IconCheck, IconClose } from "./icons";

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setItems), []);

  return (
    <div className="toast-viewport">
      {items.map((t) => (
        <div className={`toast toast-${t.kind}`} key={t.id} role="status">
          <span className="toast-icon">
            {t.kind === "success" ? <IconCheck /> : <IconAlert />}
          </span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-x" onClick={() => dismiss(t.id)}>
            <IconClose />
          </button>
        </div>
      ))}
    </div>
  );
}
