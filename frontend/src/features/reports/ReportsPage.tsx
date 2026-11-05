import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Printer, Search } from "lucide-react";
import { useReport, reportExportUrl } from "./api";
import { fetchRefs, riskKeys } from "@/features/risks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge, RiskLevelBadge } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { StatGrid, BreakdownList } from "@/features/dashboard/components";
import { useAuth } from "@/contexts/AuthContext";

const statusOptions = [
  { value: "", label: "Semua Status" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Diajukan" },
  { value: "PENDING_VALIDATION", label: "Menunggu Validasi" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PENDING_VERIFICATION", label: "Menunggu Verifikasi" },
  { value: "CLOSED", label: "Ditutup" },
  { value: "RETURNED", label: "Direvisi" },
  { value: "REJECTED", label: "Ditolak" },
];

const levelOptions = [
  { value: "", label: "Semua Level Residual" },
  { value: "VERY_HIGH", label: "Very High" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const levelColor: Record<string, string> = {
  VERY_HIGH: "#B3242B",
  HIGH: "#E94343",
  MEDIUM: "#F5B820",
  LOW: "#159B69",
};

export function ReportsPage() {
  const { user } = useAuth();
  const isMr = user?.role === "MR";

  const [q, setQ] = useState("");
  const [branchId, setBranchId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const refs = useQuery({ queryKey: riskKeys.refs, queryFn: fetchRefs, staleTime: 5 * 60_000 });
  const params = useMemo(
    () => ({
      branchId: branchId || undefined,
      categoryId: categoryId || undefined,
      level: level || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [branchId, categoryId, level, status, from, to],
  );
  const report = useReport(params);

  const rows = (report.data?.rows ?? []).filter((r) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return r.code.toLowerCase().includes(needle) || r.title.toLowerCase().includes(needle) || r.owner.toLowerCase().includes(needle);
  });

  const s = report.data?.summary;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reporting"
        description="Laporan register risiko, distribusi level, dan progres mitigasi"
        icon={BarChart3}
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              Cetak
            </Button>
            <a href={reportExportUrl(params)}>
              <Button size="sm">
                <Download className="h-4 w-4" aria-hidden="true" />
                Ekspor CSV
              </Button>
            </a>
          </>
        }
      />

      <Card className="print:hidden">
        <CardBody className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="rp-from">Dari Tanggal</Label>
            <Input id="rp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="rp-to">Sampai Tanggal</Label>
            <Input id="rp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {isMr && (
            <div>
              <Label htmlFor="rp-branch">Branch</Label>
              <Select id="rp-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Semua Branch</option>
                {(refs.data?.branches ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="rp-cat">Kategori</Label>
            <Select id="rp-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Semua Kategori</option>
              {(refs.data?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rp-level">Level Residual</Label>
            <Select id="rp-level" value={level} onChange={(e) => setLevel(e.target.value)}>
              {levelOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="rp-status">Status</Label>
            <Select id="rp-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="rp-q">Pencarian</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
              <Input id="rp-q" className="pl-8" placeholder="Kode, judul, atau owner..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        </CardBody>
      </Card>

      <StatGrid
        items={[
          { label: "Total Risiko", value: s?.total ?? null, tone: "primary" },
          { label: "Risiko Aktif", value: s?.active ?? null },
          { label: "High/Very High (Residual)", value: s?.highResidual ?? null, tone: "danger" },
          { label: "Rata-rata Progres Mitigasi", value: s ? `${s.avgProgress}%` : null, tone: "success" },
          { label: "Total Mitigasi", value: s?.totalMitigations ?? null },
          { label: "Mitigasi Selesai", value: s?.completedMitigations ?? null, tone: "success" },
          { label: "Mitigasi Terlambat", value: s?.overdueMitigations ?? null, tone: "warning" },
          {
            label: "Total Anggaran",
            value: s ? `Rp ${s.totalBudget.toLocaleString("id-ID")}` : null,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title="Distribusi Level Residual" />
          <CardBody className="space-y-2">
            {(report.data?.byLevel ?? []).map((row) => (
              <div key={row.level} className="flex items-center justify-between gap-2">
                <RiskLevelBadge level={row.level} />
                <span className="text-sm font-semibold" style={{ color: levelColor[row.level] }}>
                  {row.total}
                </span>
              </div>
            ))}
            {(report.data?.byLevel ?? []).length === 0 && <p className="text-xs text-content-secondary">Tidak ada data</p>}
          </CardBody>
        </Card>
        <BreakdownList
          title="Risiko per Kategori"
          rows={(report.data?.byCategory ?? []).map((c) => ({ name: c.name, total: c.total }))}
        />
        {isMr ? (
          <BreakdownList
            title="Risiko per Branch"
            rows={(report.data?.byBranch ?? []).map((b) => ({ name: `${b.code} — ${b.name}`, total: b.total }))}
          />
        ) : (
          <Card>
            <CardHeader title="Status Risiko" />
            <CardBody className="space-y-2">
              {(report.data?.byStatus ?? []).map((row) => (
                <div key={row.status} className="flex items-center justify-between gap-2">
                  <StatusBadge status={row.status} />
                  <span className="text-sm font-semibold text-content-primary">{row.total}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        )}
      </div>

      {report.isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : report.isError ? (
        <Card>
          <ErrorState message="Laporan gagal dimuat" onRetry={() => void report.refetch()} />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Register Risiko" subtitle={`${rows.length} risiko ditampilkan`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-left text-content-secondary">
                  <th className="px-3 py-2 font-medium">Kode</th>
                  <th className="px-3 py-2 font-medium">Risiko</th>
                  <th className="px-3 py-2 font-medium">Branch</th>
                  <th className="px-3 py-2 font-medium">Kategori</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Inherent</th>
                  <th className="px-3 py-2 font-medium">Residual</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Mitigasi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <Link to={`/risks/${row.id}`} className="font-medium text-primary-600 hover:underline">{row.code}</Link>
                    </td>
                    <td className="px-3 py-2 max-w-[240px] truncate text-content-primary">{row.title}</td>
                    <td className="px-3 py-2 text-content-secondary">{row.branch.code}</td>
                    <td className="px-3 py-2 text-content-secondary">{row.category}</td>
                    <td className="px-3 py-2 text-content-secondary">{row.owner}</td>
                    <td className="px-3 py-2"><RiskLevelBadge level={row.inherentLevel} withScore={row.inherentScore} /></td>
                    <td className="px-3 py-2"><RiskLevelBadge level={row.residualLevel} withScore={row.residualScore} /></td>
                    <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                    <td className="px-3 py-2 text-content-secondary">
                      {row.mitigationCount} · {row.mitigationProgress}%
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-content-secondary">Tidak ada risiko sesuai filter</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
