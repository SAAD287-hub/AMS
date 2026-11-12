"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Public props ─────────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  /** Controls visibility. When false, the component renders null. */
  open: boolean;
  /** Dialog heading. */
  title: string;
  /** Optional supporting body copy. */
  description?: string;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /**
   * Visual intent of the confirm action. "danger" swaps the filled primary
   * button for the destructive .btn-danger style; "default" keeps .btn-primary.
   */
  variant?: "default" | "danger";
  /** Invoked when the user confirms. May be async; the dialog awaits it. */
  onConfirm: () => void | Promise<void>;
  /** Invoked when the user cancels (Esc, backdrop click, cancel button). */
  onCancel: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  // Autofocus the primary action when the dialog opens so Enter confirms.
  useEffect(() => {
    if (open) {
      // Defer so the element is mounted before focusing.
      const t = window.setTimeout(() => confirmBtnRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (!busy) onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only treat clicks on the backdrop itself (not bubbled from the modal).
      if (e.target === e.currentTarget && !busy) {
        onCancel();
      }
    },
    [busy, onCancel]
  );

  const handleConfirm = useCallback(async () => {
    if (busy) return;
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }, [busy, onConfirm]);

  if (!open) return null;

  const confirmClass =
    "btn btn-md " + (variant === "danger" ? "btn-danger" : "btn-primary");

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-desc" : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="confirm-dialog-title">{title}</h2>
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={() => {
              if (!busy) onCancel();
            }}
          >
            <svg
              aria-hidden="true"
              focusable="false"
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {description ? (
          <div className="modal-body" style={{ padding: "16px 24px" }}>
            <p
              id="confirm-dialog-desc"
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--muted)",
                textWrap: "pretty",
              }}
            >
              {description}
            </p>
          </div>
        ) : null}

        <div className="modal-foot">
          <div className="modal-foot-actions">
            <button
              type="button"
              className="btn btn-md btn-secondary"
              onClick={onCancel}
              disabled={busy}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              ref={confirmBtnRef}
              className={confirmClass}
              onClick={handleConfirm}
              disabled={busy}
              aria-busy={busy || undefined}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
