import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CircleAlert, CircleCheck, CircleMinus } from "lucide-react";
import { cn } from "@/lib/utils";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

const levelConfig: Record<
  RiskLevel,
  { label: string; className: string; dot: string; icon: LucideIcon }
> = {
  LOW: {
    label: "Low",
    className: "bg-success-50 text-success border border-success/25",
    dot: "text-success",
    icon: CircleCheck,
  },
  MEDIUM: {
    label: "Medium",
    className: "bg-warning-50 text-warning border border-warning/30",
    dot: "text-warning",
    icon: CircleAlert,
  },
  HIGH: {
    label: "High",
    className: "bg-danger-50 text-danger border border-danger/25",
    dot: "text-danger",
    icon: AlertTriangle,
  },
  VERY_HIGH: {
    label: "Very High",
    className: "bg-danger-100 text-[#7E1D22] border border-danger/40",
    dot: "text-risk-very-high",
    icon: AlertTriangle,
  },
};

export function RiskLevelBadge({
  level,
  className,
  withScore,
}: {
  level: RiskLevel | null | undefined;
  className?: string;
  withScore?: number | null;
}) {
  if (!level)
    return (
      <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-medium bg-slate-100 text-content-secondary border border-border", className)}>
        <CircleMinus className="h-3 w-3" aria-hidden="true" />
        Belum dinilai
      </span>
    );
  const cfg = levelConfig[level];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-medium whitespace-nowrap",
        cfg.className,
        className,
      )}
    >
      <Icon className={cn("h-3 w-3", cfg.dot)} aria-hidden="true" />
      {cfg.label}
      {withScore != null && <span className="opacity-75">· {withScore}</span>}
    </span>
  );
}

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-100 text-content-secondary border border-border" },
  SUBMITTED: { label: "Diajukan", className: "bg-primary-50 text-primary-700 border border-primary-200" },
  RETURNED: { label: "Direvisi", className: "bg-warning-50 text-warning border border-warning/30" },
  PENDING_VALIDATION: { label: "Menunggu Validasi MR", className: "bg-warning-50 text-[#8A6210] border border-warning/30" },
  REJECTED: { label: "Ditolak", className: "bg-danger-50 text-danger border border-danger/25" },
  ACTIVE: { label: "Aktif", className: "bg-primary-50 text-primary-700 border border-primary-200" },
  PENDING_VERIFICATION: { label: "Menunggu Verifikasi", className: "bg-warning-50 text-[#8A6210] border border-warning/30" },
  CLOSED: { label: "Ditutup", className: "bg-success-50 text-success border border-success/25" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = statusConfig[status] ?? {
    label: status,
    className: "bg-slate-100 text-content-secondary border border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-2xs font-medium whitespace-nowrap",
        cfg.className,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
}) {
  const map = {
    default: "bg-slate-100 text-content-secondary border-border",
    primary: "bg-primary-50 text-primary-700 border-primary-200",
    success: "bg-success-50 text-success border-success/25",
    warning: "bg-warning-50 text-[#8A6210] border-warning/30",
    danger: "bg-danger-50 text-danger border-danger/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-2xs font-medium border whitespace-nowrap",
        map[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
