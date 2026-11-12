"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error" | "info" | "warn";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const show = useCallback((message: string, variant: ToastVariant = "info") => {
    idRef.current += 1;
    const id = idRef.current;
    setItems(prev => [...prev, { id, message, variant }]);
    window.setTimeout(() => dismiss(id), variant === "error" ? 6000 : 4000);
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(() => ({
    show,
    success: msg => show(msg, "success"),
    error: msg => show(msg, "error"),
    info: msg => show(msg, "info"),
    warn: msg => show(msg, "warn"),
  }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {items.map(item => (
          <div key={item.id} className={`toast toast-${item.variant}`} role="status">
            <span className="toast-icon" aria-hidden="true">{iconFor(item.variant)}</span>
            <span className="toast-body">{item.message}</span>
            <button type="button" className="toast-dismiss" onClick={() => dismiss(item.id)} aria-label="Dismiss notification">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: (msg: string) => { if (typeof window !== "undefined") window.console.warn("Toast:", msg); },
      success: (msg: string) => { if (typeof window !== "undefined") window.console.log("Toast success:", msg); },
      error: (msg: string) => { if (typeof window !== "undefined") window.console.error("Toast error:", msg); },
      info: (msg: string) => { if (typeof window !== "undefined") window.console.info("Toast:", msg); },
      warn: (msg: string) => { if (typeof window !== "undefined") window.console.warn("Toast:", msg); },
    } as ToastContextValue;
  }
  return ctx;
}

function iconFor(variant: ToastVariant) {
  if (variant === "success") return "✓";
  if (variant === "error") return "✕";
  if (variant === "warn") return "!";
  return "i";
}

// Convenience global accessor (optional usage from non-React code paths)
let bridge: ToastContextValue | null = null;
export function installToastBridge(ctx: ToastContextValue) { bridge = ctx; }
export function toast(message: string, variant: ToastVariant = "info") {
  if (bridge) bridge.show(message, variant);
  else if (typeof window !== "undefined") window.console.log(`[toast:${variant}]`, message);
}

export function ToastBridgeInstaller() {
  const ctx = useToast();
  useEffect(() => { installToastBridge(ctx); }, [ctx]);
  return null;
}
