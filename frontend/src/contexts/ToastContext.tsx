import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  message?: string;
}

interface ToastApi {
  toast: (variant: ToastVariant, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const icons: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles: Record<ToastVariant, string> = {
  success: "border-success/30 text-success",
  error: "border-danger/30 text-danger",
  warning: "border-warning/40 text-[#8A6210]",
  info: "border-primary-200 text-primary-700",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((s) => s.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (variant: ToastVariant, title: string, message?: string) => {
      const id = Date.now() + Math.random();
      setItems((s) => [...s.slice(-3), { id, variant, title, message }]);
      window.setTimeout(() => remove(id), 5000);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (t, m) => toast("success", t, m),
      error: (t, m) => toast("error", t, m),
      warning: (t, m) => toast("warning", t, m),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed z-[70] top-3 right-3 left-3 sm:left-auto flex flex-col gap-2 w-auto sm:w-96"
        role="region"
        aria-label="Notifikasi"
      >
        {items.map((t) => {
          const Icon = icons[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "flex items-start gap-3 rounded border bg-white px-4 py-3 shadow-dropdown animate-slide-in",
                styles[t.variant],
              )}
            >
              <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-content-primary">{t.title}</p>
                {t.message && <p className="text-xs text-content-secondary mt-0.5">{t.message}</p>}
              </div>
              <button
                onClick={() => remove(t.id)}
                aria-label="Tutup notifikasi"
                className="shrink-0 rounded p-0.5 text-content-muted hover:bg-slate-100 hover:text-content-primary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam ToastProvider");
  return ctx;
}
