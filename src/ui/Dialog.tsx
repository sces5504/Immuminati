import { useEffect, useRef, type ReactNode } from "react";
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={wide ? "dialog-wide" : ""}
      aria-label={title}
    >
      <header className="dialog-header">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="關閉視窗">
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
