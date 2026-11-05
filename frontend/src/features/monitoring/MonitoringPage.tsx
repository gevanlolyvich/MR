import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Clock, Search, ShieldCheck, TrendingUp } from "lucide-react";
import { useMonitoring } from "./api";
import { fetchRefs, riskKeys } from "@/features/risks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge, RiskLevelBadge, Badge } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { StatGrid } from "@/features/dashboard/components";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const levelOptions = [
  { value: "", label: "Semua Level Residual" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "VERY_HIGH", label: "Very High" },
];

export function MonitoringPage() {
  const { user } = useAuth();
  const isMr = user?.role === "MR";

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [level, setLevel] = useState("");
  const [branchId, setBranchId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const params = useMemo(
    () => ({
      q: qDebounced || undefined,
      level: level || undefined,
      branchId: branchId || undefined,
      categoryId: categoryId || undefined,
    }),
    [qDebounced, level, branchId, categoryId],
  );

  const refs = useQuery({ queryKey: riskKeys.refs, queryFn: fetchRefs, staleTime: 5 * 60_000 });
  const mon = useMonitoring(params);

  function onSearch(v: string) {
    setQ(v);
    window.clearTimeout((onSearch as unknown as { t?: number }).t);
    (onSearch as unknown as { t?: number }).t = window.setTimeout(() => setQDebounced(v), 400);
  }

  const stats = mon.data?.stats;
  const rows = mon.data?.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Monitoring Risiko"
        description="Pemantauan risiko aktif, progres mitigasi, dan keterlambatan tindak lanjut"
        icon={Activity}
      />

      <StatGrid
        items={[
          { label: "Risiko Dipantau", value: stats?.total ?? null, icon: Activity, tone: "primary" },
          { label: "Aktif", value: stats?.totalActive ?? null, icon: ShieldCheck, tone: "default" },
          { label: "Menunggu Verifikasi", value: stats?.pendingVerification ?? null, icon: Clock, tone: "warning" },
          { label: "Risiko Terlambat", value: stats?.overdueRisks ?? null, icon: AlertTriangle, tone: "danger" },
          { label: "Residual High/Very High", value: stats?.highResidual ?? null, icon: AlertTriangle, tone: "danger" },
          { label: "Rata-rata Progres", value: stats ? `${stats.avgProgress}%` : null, icon: TrendingUp, tone: "success" },
        ]}
      />

      <Card>
        <CardBody className="flex flex-wrap items-end gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
            <Input
              placeholder="Cari kode / judul risiko..."
              aria-label="Pencarian monitoring"
              className="pl-8"
              value={q}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          {isMr && (
            <div className="w-full sm:w-48">
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="Filter branch">
                <option value="">Semua Branch</option>
                {(refs.data?.branches ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="w-full sm:w-48">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Filter kategori">
              <option value="">Semua Kategori</option>
              {(refs.data?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Filter level residual">
              {levelOptions.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      {mon.isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : mon.isError ? (
        <Card>
          <ErrorState message="Data monitoring gagal dimuat" onRetry={() => void mon.refetch()} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Activity}
            title="Tidak ada risiko aktif"
            description="Risiko yang sudah tervalidasi akan muncul di halaman monitoring."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Daftar Pemantauan" subtitle="Diurutkan berdasarkan skor residual tertinggi" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-left text-content-secondary">
                  <th className="px-3 py-2 font-medium">Risiko</th>
                  <th className="px-3 py-2 font-medium">Branch / Kategori</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Inherent</th>
                  <th className="px-3 py-2 font-medium">Residual</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium w-48">Progres Mitigasi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-3 py-2.5">
                      <Link to={`/risks/${row.id}`} className="font-medium text-primary-600 hover:underline">
                        {row.code}
                      </Link>
                      <p className="mt-0.5 max-w-[240px] truncate text-content-primary">{row.title}</p>
                    </td>
                    <td className="px-3 py-2.5 text-content-secondary">
                      <p>{row.branch.code}</p>
                      <p className="text-2xs text-content-muted">{row.category.name}</p>
                    </td>
                    <td className="px-3 py-2.5 text-content-secondary">{row.owner.fullName}</td>
                    <td className="px-3 py-2.5">
                      <RiskLevelBadge level={row.inherentLevel} withScore={row.inherentScore} />
                    </td>
                    <td className="px-3 py-2.5">
                      <RiskLevelBadge level={row.residualLevel} withScore={row.residualScore} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={row.status} />
                      {row.mitigation.overdue > 0 && (
                        <Badge variant="danger" className="mt-1">{row.mitigation.overdue} terlambat</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100">
                          <div
                            className={cn("h-full rounded", row.mitigation.overdue > 0 ? "bg-danger" : "bg-primary-500")}
                            style={{ width: `${row.mitigation.avgProgress}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-2xs text-content-secondary">{row.mitigation.avgProgress}%</span>
                      </div>
                      <p className="mt-1 text-2xs text-content-muted">
                        {row.mitigation.completed}/{row.mitigation.total} program selesai
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
