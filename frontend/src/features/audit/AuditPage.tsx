import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchAudit, auditKeys, useAuditFilters } from "./api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";

export function AuditPage() {
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const filters = useAuditFilters();
  const params = useMemo(
    () => ({
      q: qDebounced || undefined,
      action: action || undefined,
      entityType: entityType || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize: 20,
    }),
    [qDebounced, action, entityType, from, to, page],
  );

  const list = useQuery({
    queryKey: auditKeys.list(params),
    queryFn: () => fetchAudit(params),
    placeholderData: (prev) => prev,
  });

  function onSearch(v: string) {
    setQ(v);
    setPage(1);
    window.clearTimeout((onSearch as unknown as { t?: number }).t);
    (onSearch as unknown as { t?: number }).t = window.setTimeout(() => setQDebounced(v), 400);
  }

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit Log"
        description="Jejak aktivitas pengguna dan perubahan data penting"
        icon={ScrollText}
      />

      <Card>
        <CardBody className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="au-from">Dari Tanggal</Label>
            <Input id="au-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <Label htmlFor="au-to">Sampai Tanggal</Label>
            <Input id="au-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          <div>
            <Label htmlFor="au-action">Aksi</Label>
            <Select id="au-action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">Semua Aksi</option>
              {(filters.data?.actions ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="au-entity">Entitas</Label>
            <Select id="au-entity" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}>
              <option value="">Semua Entitas</option>
              {(filters.data?.entityTypes ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Label htmlFor="au-q">Pencarian</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
              <Input id="au-q" className="pl-8" placeholder="Aktor, deskripsi, aksi..." value={q} onChange={(e) => onSearch(e.target.value)} />
            </div>
          </div>
        </CardBody>
      </Card>

      {list.isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : list.isError ? (
        <Card><ErrorState message="Audit log gagal dimuat" onRetry={() => void list.refetch()} /></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={ScrollText} title="Tidak ada aktivitas" description="Belum ada audit log sesuai filter." /></Card>
      ) : (
        <Card>
          <CardHeader title="Riwayat Aktivitas" subtitle={`${meta?.total ?? 0} catatan`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-left text-content-secondary">
                  <th className="px-3 py-2 font-medium">Waktu</th>
                  <th className="px-3 py-2 font-medium">Aktor</th>
                  <th className="px-3 py-2 font-medium">Aksi</th>
                  <th className="px-3 py-2 font-medium">Entitas</th>
                  <th className="px-3 py-2 font-medium">Deskripsi</th>
                  <th className="px-3 py-2 font-medium">Branch</th>
                  <th className="px-3 py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-3 py-2.5 whitespace-nowrap text-content-secondary">
                      {new Date(row.createdAt).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-content-primary">{row.actorName ?? "Sistem"}</p>
                      <p className="text-2xs text-content-muted">{row.actorRole ?? "—"}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex rounded border border-primary-200 bg-primary-50 px-1.5 py-0.5 font-mono text-[10px] text-primary-700">
                        {row.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-content-secondary">{row.entityType}</td>
                    <td className="px-3 py-2.5 max-w-[320px] text-content-primary">{row.description ?? "—"}</td>
                    <td className="px-3 py-2.5 text-content-secondary">{row.branch?.code ?? "—"}</td>
                    <td className="px-3 py-2.5 text-2xs text-content-muted">{row.ipAddress ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2.5">
              <p className="text-2xs text-content-secondary">Halaman {meta.page} dari {meta.totalPages}</p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                <Button size="sm" variant="secondary" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
