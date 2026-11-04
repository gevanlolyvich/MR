import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlarmClock,
  ClipboardCheck,
  ClipboardList,
  FileWarning,
  LayoutDashboard,
  ShieldCheck,
  TrendingUp,
  Undo2,
  Building2,
} from "lucide-react";
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  ComposedChart,
  Line,
} from "recharts";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatGrid, BreakdownList, type StatItem } from "./components";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type { RoleName } from "@/contexts/AuthContext";

interface DashboardData {
  scope: { branchId: string } | null;
  totals: {
    risks: number;
    highRisk: number;
    veryHighRisk: number;
    mitigationsRunning: number;
    mitigationsOverdue: number;
    mitigationsPendingVerification: number;
    mitigationsCompleted: number;
  };
  byLevel: { level: string; color: string; total: number }[];
  byStatus: { status: string; label: string; total: number }[];
  byCategory: { name: string; total: number }[];
  byBranch?: { code: string; name: string; total: number; high: number }[];
  avgScores: { inherent: number; residual: number | null };
  trend: { month: string; baru: number; withResidual: number }[];
  tasks: { toReview: number; toValidate: number; toVerify: number; revisionReturned: number; rejected: number };
  recentActivities: { id: string; action: string; description: string | null; actor: string | null; at: string }[];
}

function StatRow({items}:{items:Parameters<typeof StatGrid>[0]["items"]}){return <StatGrid items={items}/>}
void StatRow;

export function DashboardPage() {
  const { user } = useAuth();
  const role: RoleName = user?.role ?? "MR";

  const { data, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard", role, user?.branch?.id ?? null],
    queryFn: async () => {
      const res = await api.get("/dashboard");
      return res.data;
    },
  });

  const title =
    role === "MR"
      ? "Dashboard Manajemen Risiko"
      : role === "RISK_OFFICER"
        ? "Dashboard Risk Officer"
        : "Dashboard Risk Owner";

  if (isLoading) {
    return (
      <>
        <PageHeader title={title} icon={LayoutDashboard} />
        <TableSkeleton rows={6} cols={4} />
      </>
    );
  }
  if (isError || !data) {
    return (
      <>
        <PageHeader title={title} icon={LayoutDashboard} />
        <Card>
          <ErrorState message={error instanceof Error ? error.message : undefined} onRetry={() => refetch()} />
        </Card>
      </>
    );
  }

  const scopeNote = user?.branch ? `Cakupan: ${user.branch.name}` : "Cakupan: seluruh perusahaan";
  const t = data.totals;

  const statItems: StatItem[] =
    role === "MR"
      ? [
          { label: "Total Risiko", value: t.risks, icon: ClipboardList, hint: `${t.highRisk + t.veryHighRisk} High/Very High` },
          { label: "Mitigasi Berjalan", value: t.mitigationsRunning, icon: ShieldCheck, tone: "primary" as const },
          { label: "Mitigasi Overdue", value: t.mitigationsOverdue, icon: AlarmClock, tone: (t.mitigationsOverdue > 0 ? "danger" : "default") },
          { label: "Menunggu Validasi", value: data.tasks.toValidate, icon: FileWarning, tone: "warning" },
        ]
      : role === "RISK_OFFICER"
        ? [
            { label: "Menunggu Review", value: data.tasks.toReview, icon: ClipboardCheck, tone: "warning" },
            { label: "Direvisi ke Owner", value: data.tasks.revisionReturned, icon: Undo2 },
            { label: "Verifikasi Mitigasi", value: t.mitigationsPendingVerification, icon: FileWarning, tone: (t.mitigationsPendingVerification > 0 ? "warning" : "default") },
            { label: "Mitigasi Overdue", value: t.mitigationsOverdue, icon: AlarmClock, tone: (t.mitigationsOverdue > 0 ? "danger" : "default") },
          ]
        : [
            { label: "Total Risiko Cabang", value: t.risks, icon: ClipboardList },
            { label: "High & Very High", value: t.highRisk + t.veryHighRisk, icon: FileWarning, tone: (t.highRisk + t.veryHighRisk > 0 ? "danger" : "default") },
            { label: "Mitigasi Berjalan", value: t.mitigationsRunning, icon: ShieldCheck, tone: "primary" as const },
            { label: "Mitigasi Overdue", value: t.mitigationsOverdue, icon: AlarmClock, tone: (t.mitigationsOverdue > 0 ? "danger" : "default") },
          ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={scopeNote}
        icon={LayoutDashboard}
        actions={
          <Link to="/risks">
            <Button variant="secondary" size="sm">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Buka Risk Register
            </Button>
          </Link>
        }
      />

      {role === "RISK_OFFICER" && data.tasks.toReview > 0 && (
        <div className="rounded-card border border-warning/40 bg-warning-50 px-4 py-2.5 flex items-start gap-2 text-xs text-[#8A6210]">
          <ClipboardCheck className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Ada <strong>{data.tasks.toReview}</strong> risiko menunggu review Anda.{" "}
            <Link to="/approvals" className="underline font-medium">
              Proses sekarang
            </Link>
          </span>
        </div>
      )}
      {role === "MR" && data.tasks.toValidate > 0 && (
        <div className="rounded-card border border-warning/40 bg-warning-50 px-4 py-2.5 flex items-start gap-2 text-xs text-[#8A6210]">
          <FileWarning className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Ada <strong>{data.tasks.toValidate}</strong> risiko menunggu validasi MR.{" "}
            <Link to="/approvals" className="underline font-medium">
              Proses sekarang
            </Link>
          </span>
        </div>
      )}
      {role === "RISK_OWNER" && data.tasks.revisionReturned > 0 && (
        <div className="rounded-card border border-danger/30 bg-danger-50 px-4 py-2.5 flex items-start gap-2 text-xs text-danger">
          <Undo2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Ada <strong>{data.tasks.revisionReturned}</strong> risiko direvisi/direvisi ulang yang harus Anda tanggapi.{" "}
            <Link to="/risks" className="underline font-medium">
              Lihat
            </Link>
          </span>
        </div>
      )}
      {t.mitigationsOverdue > 0 && (
        <div className="rounded-card border border-danger/30 bg-danger-50 px-4 py-2.5 flex items-start gap-2 text-xs text-danger">
          <AlarmClock className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>{t.mitigationsOverdue}</strong> mitigasi melewati target tanggal selesai.
          </span>
        </div>
      )}

      <StatGrid items={statItems} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Tren Risiko Baru (6 bulan)"
            subtitle="Batang = risiko tercatat, garis hijau = yang memiliki residual assessment"
          />
          <CardBody>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.trend} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RTooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} cursor={{ fill: "rgba(33,96,216,0.06)" }} />
                  <Bar dataKey="baru" name="Risiko baru" fill="#2160D8" radius={[3, 3, 0, 0]} maxBarSize={38} />
                  <Line type="monotone" dataKey="withResidual" name="Ada residual" stroke="#159B69" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <BreakdownList
          title="Risiko per Level (Inherent)"
          rows={data.byLevel.map((l) => ({ name: l.level, total: l.total, color: l.color }))}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <BreakdownList title="Risiko per Kategori" rows={data.byCategory.slice(0, 6)} />

        <Card>
          <CardHeader title="Skor Rata-rata" subtitle="Inherent vs residual" />
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between text-xs text-content-secondary">
              <span>Inherent</span>
              <span className="font-semibold text-content-primary text-base">{data.avgScores.inherent}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-content-secondary">
              <span>Residual</span>
              <span className="font-semibold text-success text-base">{data.avgScores.residual ?? "-"}</span>
            </div>
            {data.avgScores.residual != null && data.avgScores.residual < data.avgScores.inherent ? (
              <p className="text-2xs text-success flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 rotate-135" aria-hidden="true" />
                Mitigasi menurunkan skor rata-rata{" "}
                {Math.round((1 - data.avgScores.residual / Math.max(data.avgScores.inherent, 1)) * 100)}%
              </p>
            ) : (
              <p className="text-2xs text-content-muted">Belum ada penilaian residual</p>
            )}
            <div className="pt-2 border-t border-border grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-success-50 py-2">
                <p className="text-lg font-semibold text-success leading-none">{t.mitigationsCompleted}</p>
                <p className="text-2xs text-content-secondary mt-1">Selesai</p>
              </div>
              <div className="rounded bg-primary-50 py-2">
                <p className="text-lg font-semibold text-primary-600 leading-none">{t.mitigationsRunning}</p>
                <p className="text-2xs text-content-secondary mt-1">Berjalan</p>
              </div>
              <div className={cn("rounded py-2", t.mitigationsOverdue > 0 ? "bg-danger-50" : "bg-slate-100")}>
                <p className={cn("text-lg font-semibold leading-none", t.mitigationsOverdue > 0 ? "text-danger" : "text-content-secondary")}>
                  {t.mitigationsOverdue}
                </p>
                <p className="text-2xs text-content-secondary mt-1">Overdue</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {role === "MR" && <BranchTable data={data.byBranch ?? []} />}
      </div>

      <Card>
        <CardHeader title="Aktivitas Terakhir" />
        {data.recentActivities.length === 0 ? (
          <CardBody>
            <EmptyState icon={TrendingUp} title="Belum ada aktivitas" description="Aktivitas sistem akan muncul di sini." />
          </CardBody>
        ) : (
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {data.recentActivities.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="rounded px-1.5 py-0.5 text-2xs font-medium bg-slate-100 border border-border shrink-0">
                    {a.action}
                  </span>
                  <span className="text-xs text-content-primary min-w-0 flex-1 truncate">
                    {a.description ?? a.action}
                  </span>
                  <span className="text-2xs text-content-muted shrink-0">
                    {a.actor ?? "-"} · {fmt(a.at)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        )}
      </Card>
    </div>
  );
}

function BranchTable({ data }: { data: { code: string; name: string; total: number; high: number }[] }) {
  return (
    <Card>
      <CardHeader title="Risiko per Branch" subtitle="High+ = risiko berlevel High/Very High yang masih aktif" />
      {data.length === 0 ? (
        <CardBody>
          <EmptyState icon={Building2} title="Belum ada data branch" />
        </CardBody>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-content-secondary">
                <th className="px-4 py-2 font-medium">Branch</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2 font-medium text-right">High+</th>
              </tr>
            </thead>
            <tbody>
              {data.map((b) => (
                <tr key={b.code} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <span className="font-medium text-content-primary">{b.name}</span>
                    <span className="text-content-muted"> ({b.code})</span>
                  </td>
                  <td className="px-4 py-2 text-right text-content-secondary">{b.total}</td>
                  <td className={cn("px-4 py-2 text-right font-medium", b.high > 0 ? "text-danger" : "text-content-muted")}>
                    {b.high}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function fmt(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
