import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Save, RotateCcw } from "lucide-react";
import { useSettings, useSaveSettings, type SettingRow } from "./api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { useToast } from "@/contexts/ToastContext";
import { getErrorMessage } from "@/lib/api";

const labels: Record<string, { label: string; hint?: string; multiline?: boolean }> = {
  "risk.level.thresholds": {
    label: "Ambang Batas Level Risiko (JSON)",
    hint: "Format: { low, medium, high, very_high } berisi rentang skor.",
    multiline: true,
  },
  "submission.review.sla_days": { label: "SLA Review Risk Officer (hari)" },
  "management.validation.sla_days": { label: "SLA Validasi Manajemen Risiko (hari)" },
  "upload.max_size_mb": { label: "Ukuran Maksimum Upload Bukti (MB)" },
  "monitoring.overdue_grace_days": { label: "Toleransi Keterlambatan Mitigasi (hari)" },
};

export function SettingsPage() {
  const toast = useToast();
  const query = useSettings();
  const save = useSaveSettings();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!query.data?.data) return;
    const next: Record<string, string> = {};
    for (const s of query.data.data) next[s.key] = s.value;
    setValues(next);
  }, [query.data]);

  const rows: SettingRow[] = query.data?.data ?? [];
  const ordered = [...rows].sort((a, b) => {
    const ai = Object.keys(labels).indexOf(a.key);
    const bi = Object.keys(labels).indexOf(b.key);
    if (ai === -1 && bi === -1) return a.key.localeCompare(b.key);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  function onSave() {
    save.mutate(values, {
      onSuccess: () => toast.success("Pengaturan disimpan", "Perubahan berlaku untuk seluruh pengguna"),
      onError: (err) => toast.error("Gagal menyimpan pengaturan", getErrorMessage(err)),
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Konfigurasi ambang batas, SLA, dan kebijakan sistem"
        icon={SettingsIcon}
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Muat Ulang
            </Button>
            <Button size="sm" loading={save.isPending} onClick={onSave}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Simpan
            </Button>
          </>
        }
      />

      {query.isLoading ? (
        <TableSkeleton rows={5} cols={2} />
      ) : query.isError ? (
        <Card><ErrorState message="Pengaturan gagal dimuat" onRetry={() => void query.refetch()} /></Card>
      ) : (
        <Card>
          <CardHeader title="Pengaturan Sistem" subtitle="Nilai disimpan sebagai konfigurasi aplikasi" />
          <CardBody className="space-y-4">
            {ordered.length === 0 && <p className="text-xs text-content-secondary">Belum ada pengaturan.</p>}
            {ordered.map((row) => {
              const meta = labels[row.key];
              return (
                <div key={row.key}>
                  <Label htmlFor={`set-${row.key}`}>{meta?.label ?? row.key}</Label>
                  {meta?.multiline ? (
                    <Textarea
                      id={`set-${row.key}`}
                      rows={4}
                      className="font-mono text-2xs"
                      value={values[row.key] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [row.key]: e.target.value }))}
                    />
                  ) : (
                    <Input
                      id={`set-${row.key}`}
                      value={values[row.key] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [row.key]: e.target.value }))}
                    />
                  )}
                  <p className="mt-1 text-2xs text-content-muted">
                    <span className="font-mono">{row.key}</span>
                    {row.description ? ` — ${row.description}` : ""}
                    {meta?.hint ? ` ${meta.hint}` : ""}
                  </p>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
