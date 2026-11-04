import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

export function Modal({ open, onClose, title, description, children, footer, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed z-[60] inset-0 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-navy/50 animate-fade" onClick={onClose} aria-hidden="true" />
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        <div
          className={cn(
            "relative w-full bg-white rounded-t-lg sm:rounded-card shadow-dropdown animate-scale-in max-h-[90vh] flex flex-col",
            sizes[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 px-4 sm:px-5 pt-4 pb-3 border-b border-border">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-content-primary">{title}</h2>
              {description && <p className="text-xs text-content-secondary mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Tutup"
              className="shrink-0 rounded p-1 text-content-muted hover:bg-slate-100 hover:text-content-primary"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="px-4 sm:px-5 py-4 overflow-y-auto">{children}</div>
          {footer && (
            <div className="px-4 sm:px-5 py-3 border-t border-border bg-slate-50 rounded-b-card flex flex-wrap justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Konfirmasi",
  confirmVariant = "danger",
  loading,
}: Omit<ModalProps, "children" | "footer" | "size"> & {
  onConfirm: () => void;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "primary";
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="h-8 px-3 text-xs rounded border border-border bg-white text-content-primary hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "h-8 px-3 text-xs rounded font-medium text-white disabled:opacity-60",
              confirmVariant === "danger" ? "bg-danger hover:bg-danger/90" : "bg-primary-500 hover:bg-primary-600",
            )}
          >
            {loading ? "Memproses..." : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-content-secondary">{message}</p>
    </Modal>
  );
}
