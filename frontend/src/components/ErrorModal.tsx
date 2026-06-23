interface Props {
  title?: string;
  message: string;
  onClose: () => void;
}

export function ErrorModal({ title = "تعذّر الحفظ", message, onClose }: Props) {
  return (
    <div className="modal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="error-modal-title">
      <div className="modal-box" dir="rtl">
        <h2 className="modal-title" id="error-modal-title">{title}</h2>
        <div className="modal-body">
          <div
            role="alert"
            style={{
              background: "rgba(192, 57, 43, 0.06)",
              border: "1px solid rgba(192, 57, 43, 0.22)",
              borderRadius: "var(--radius)",
              padding: "var(--space-4)",
              display: "flex",
              gap: "var(--space-3)",
              alignItems: "flex-start",
            }}
          >
            <span
              aria-hidden="true"
              style={{ fontSize: 22, color: "var(--color-danger)", flexShrink: 0, lineHeight: 1.3 }}
            >
              ⚠
            </span>
            <p style={{ margin: 0, fontSize: "var(--font-size-body)", color: "var(--color-text)", lineHeight: "var(--line-height-body)" }}>
              {message}
            </p>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
            حسناً، فهمت
          </button>
        </div>
      </div>
    </div>
  );
}
