import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type Tone = "default" | "success" | "warning" | "danger" | "primary";

export interface StatItem {
  label: string;
  value: number | string | null;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: string;
}

const tones: Record<Tone, string> = {
  default: "text-content-primary",
  primary: "text-primary-600",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function StatCard({ item }: { item: StatItem }) {
  const Icon = item.icon;
  return (
    <div className="rounded-card border border-border bg-white p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <p className="text-2xs font-medium uppercase tracking-wide text-content-secondary leading-snug">
          {item.label}
        </p>
        {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0", tones[item.tone ?? "default"])} aria-hidden="true" />}
      </div>
      <p className={cn("text-xl font-semibold leading-none", tones[item.tone ?? "default"], item.value == null && "text-content-muted")}>
        {item.value ?? "n/a"}
      </p>
      {item.hint && <p className="text-2xs text-content-secondary leading-snug">{item.hint}</p>}
    </div>
  );
}

export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {items.map((it, i) => (
        <StatCard key={i} item={it} />
      ))}
    </div>
  );
}

/** Panel kecil dengan list label:jumlah */
export function BreakdownList({
  title,
  rows,
  colorOf,
  className,
}: {
  title: string;
  rows: { name: string; total: number; color?: string }[];
  colorOf?: (row: { name: string }) => string | undefined;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <Card className={className}>
      <CardHeader title={title} />
      <CardBody className="space-y-2.5">
        {rows.length === 0 && <p className="text-xs text-content-secondary">Tidak ada data</p>}
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-content-primary truncate">{r.name}</span>
              <span className="font-medium text-content-secondary shrink-0">{r.total}</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded"
                style={{ width: `${(r.total / max) * 100}%`, backgroundColor: r.color ?? colorOf?.(r) ?? "#2160D8" }}
                aria-hidden="true"
              />
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
