import type { ReactNode } from "react";

interface Props {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  onConfirm,
  onCancel,
  danger = false,
}: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="modal-box" dir="rtl">
        <h2 className="modal-title" id="confirm-modal-title">{title}</h2>
        <div className="modal-body">{message}</div>
        <div className="modal-actions">
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
