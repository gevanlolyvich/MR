import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DropdownProps {
  trigger: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  children: React.ReactNode;
}

/** Dropdown ringan berbasis klik dengan penutupan di luar area. */
export function Dropdown({ trigger, align = "right", className, children }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="block w-full text-left focus-visible:outline-primary-500 rounded"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-1.5 min-w-[11rem] rounded border border-border bg-white shadow-dropdown py-1 animate-scale-in",
            align === "right" ? "right-0" : "left-0",
          )}
          style={{ maxWidth: "calc(100vw - 24px)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  onClick,
  danger,
  icon,
  children,
}: {
  onClick?: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
        "hover:bg-slate-50 focus-visible:bg-slate-50",
        danger ? "text-danger" : "text-content-primary",
      )}
    >
      {icon && <span className="shrink-0 text-content-secondary">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function DropdownDivider() {
  return <div className="my-1 h-px bg-border" role="separator" />;
}
