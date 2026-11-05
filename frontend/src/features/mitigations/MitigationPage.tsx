import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Plus,
  Search,
  Pencil,
  TrendingUp,
  Upload,
  CheckCircle2,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  fetchMitigations,
  mitigationKeys,
  useCreateMitigation,
  useUpdateMitigation,
  useUpdateProgress,
  useVerifyMitigationPlan,
  useDeleteMitigation,
  uploadMitigationEvidence,
  MITIGATION_STATUS,
  type MitigationRow,
} from "./api";
import { fetchRisks, fetchOwners, type RiskListItem, type OwnerOption } from "@/features/risks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const statusOptions = [
  { value: "", label: "Semua Status" },
  { value: "NOT_STARTED", label: "Belum Dimulai" },
  { value: "IN_PROGRESS", label: "Berjalan" },
  { value: "PENDING_VERIFICATION", label: "Menunggu Verifikasi" },
  { value: "COMPLETED", label: "Selesai" },
];

function errMsg(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Terjadi kesalahan";
}

export function MitigationPage() {
  const { user, can } = useAuth();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<MitigationRow | null>(null);
  const [progressPlan, setProgressPlan] = useState<MitigationRow | null>(null);
  const [verifyPlan, setVerifyPlan] = useState<MitigationRow | null>(null);
  const [evidencePlan, setEvidencePlan] = useState<MitigationRow | null>(null);
  const [deletePlan, setDeletePlan] = useState<MitigationRow | null>(null);

  const params = useMemo(
    () => ({ q: qDebounced || undefined, status: status || undefined, page, pageSize: 10 }),
    [qDebounced, status, page],
  );

  const list = useQuery({
    queryKey: mitigationKeys.list(params),
    queryFn: () => fetchMitigations(params),
    placeholderData: (prev) => prev,
  });

  const create = useCreateMitigation();
  const update = useUpdateMitigation();
  const progress = useUpdateProgress();
  const verify = useVerifyMitigationPlan();
  const del = useDeleteMitigation();

  const canManage = can("mitigation:manage");
  const canVerify = can("mitigation:verify");

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
        title="Mitigation Plan"
        description="Rencana, progres, bukti, dan verifikasi mitigasi risiko"
        icon={ShieldCheck}
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Mitigasi Baru
            </Button>
          ) : null
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-end gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
            <Input
              placeholder="Cari kode risiko / uraian..."
              aria-label="Pencarian mitigasi"
              className="pl-8"
              value={q}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-52">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter status">
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>
          <p className="ml-auto text-xs text-content-secondary">
            Total: <strong className="text-content-primary">{meta?.total ?? 0}</strong>
          </p>
        </CardBody>
      </Card>

      {list.isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : list.isError ? (
        <Card>
          <ErrorState message="Data mitigasi gagal dimuat" onRetry={() => void list.refetch()} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Belum ada rencana mitigasi"
            description="Rencana mitigasi dapat dibuat untuk risiko yang sudah berstatus Aktif."
            action={canManage ? { label: "Buat Mitigasi", onClick: () => setCreateOpen(true) } : undefined}
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Daftar Mitigasi" subtitle="Kelola progres dan verifikasi pelaksanaan" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-left text-content-secondary">
                  <th className="px-3 py-2 font-medium">Risiko</th>
                  <th className="px-3 py-2 font-medium">Program Mitigasi</th>
                  <th className="px-3 py-2 font-medium">PIC</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium w-44">Progres</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const meta2 = MITIGATION_STATUS[row.status];
                  const isPic = row.responsibleId === user?.id;
                  const isRiskOwner = row.risk.ownerId === user?.id;
                  const canEditRow = canManage && (user?.role === "MR" || isRiskOwner || isPic);
                  const overdue = row.status !== "COMPLETED" && row.dueDate && new Date(row.dueDate).getTime() < Date.now();
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-3 py-2.5">
                        <Link to={`/risks/${row.risk.id}`} className="font-medium text-primary-600 hover:underline">
                          {row.risk.code}
                        </Link>
                        <p className="mt-0.5 max-w-[220px] truncate text-content-primary">{row.risk.title}</p>
                        <p className="text-2xs text-content-muted">{row.risk.branch.code}</p>
                      </td>
                      <td className="px-3 py-2.5 max-w-[260px]">
                        <p className="text-content-primary">{row.description}</p>
                        {row.actionPlan && <p className="mt-0.5 text-2xs text-content-muted line-clamp-2">{row.actionPlan}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-content-secondary">{row.responsible.fullName}</td>
                      <td className={cn("px-3 py-2.5 whitespace-nowrap", overdue ? "text-danger font-medium" : "text-content-secondary")}>
                        {row.dueDate ? new Date(row.dueDate).toLocaleDateString("id-ID") : "-"}
                        {overdue && <span className="ml-1 text-2xs">(terlambat)</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100">
                            <div className="h-full rounded bg-primary-500" style={{ width: `${row.progress}%` }} />
                          </div>
                          <span className="shrink-0 text-2xs text-content-secondary">{row.progress}%</span>
                        </div>
                        <p className="mt-1 text-2xs text-content-muted">{row._count.updates} update · {row._count.evidences} bukti</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={meta2.variant}>{meta2.label}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap justify-end gap-1">
                          {canEditRow && row.status !== "COMPLETED" && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => setProgressPlan(row)} title="Update progres">
                                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => setEditPlan(row)} title="Edit">
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => setEvidencePlan(row)} title="Unggah bukti">
                                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                            </>
                          )}
                          {canVerify && row.status === "PENDING_VERIFICATION" && (
                            <Button size="sm" onClick={() => setVerifyPlan(row)} title="Verifikasi">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Verifikasi
                            </Button>
                          )}
                          {canEditRow && row.status === "NOT_STARTED" && (
                            <Button size="sm" variant="danger-outline" onClick={() => setDeletePlan(row)} title="Hapus">
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2.5">
              <p className="text-2xs text-content-secondary">
                Halaman {meta.page} dari {meta.totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button size="sm" variant="secondary" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {createOpen && (
        <CreateMitigationModal
          loading={create.isPending}
          onClose={() => setCreateOpen(false)}
          onSubmit={(v) =>
            create.mutate(v, {
              onSuccess: () => {
                toast.success("Mitigasi dibuat", "Rencana mitigasi berhasil ditambahkan");
                setCreateOpen(false);
              },
              onError: (err) => toast.error("Gagal membuat mitigasi", errMsg(err)),
            })
          }
        />
      )}

      {editPlan && (
        <EditMitigationModal
          plan={editPlan}
          loading={update.isPending}
          onClose={() => setEditPlan(null)}
          onSubmit={(body) =>
            update.mutate(
              { id: editPlan.id, body },
              {
                onSuccess: () => {
                  toast.success("Mitigasi diperbarui");
                  setEditPlan(null);
                },
                onError: (err) => toast.error("Gagal memperbarui", errMsg(err)),
              },
            )
          }
        />
      )}

      {progressPlan && (
        <ProgressModal
          plan={progressPlan}
          loading={progress.isPending}
          onClose={() => setProgressPlan(null)}
          onSubmit={(value, note) =>
            progress.mutate(
              { id: progressPlan.id, progress: value, note },
              {
                onSuccess: () => {
                  toast.success("Progres tersimpan", "Update progres tercatat pada riwayat");
                  setProgressPlan(null);
                },
                onError: (err) => toast.error("Gagal menyimpan progres", errMsg(err)),
              },
            )
          }
        />
      )}

      {verifyPlan && (
        <VerifyModal
          plan={verifyPlan}
          loading={verify.isPending}
          onClose={() => setVerifyPlan(null)}
          onSubmit={(decision, note) =>
            verify.mutate(
              { id: verifyPlan.id, decision, note },
              {
                onSuccess: () => {
                  toast.success("Verifikasi tersimpan");
                  setVerifyPlan(null);
                },
                onError: (err) => toast.error("Gagal verifikasi", errMsg(err)),
              },
            )
          }
        />
      )}

      {evidencePlan && (
        <EvidenceModal
          plan={evidencePlan}
          onClose={() => setEvidencePlan(null)}
          onUpload={async (file) => {
            try {
              await uploadMitigationEvidence(evidencePlan.id, file);
              toast.success("Bukti terunggah", "Dokumen bukti berhasil disimpan");
              setEvidencePlan(null);
              void list.refetch();
            } catch (err) {
              toast.error("Gagal mengunggah", errMsg(err));
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!deletePlan}
        onClose={() => setDeletePlan(null)}
        onConfirm={() =>
          deletePlan &&
          del.mutate(deletePlan.id, {
            onSuccess: () => {
              toast.success("Mitigasi dihapus");
              setDeletePlan(null);
            },
            onError: (err) => toast.error("Gagal menghapus", errMsg(err)),
          })
        }
        title="Hapus rencana mitigasi?"
        message="Rencana mitigasi yang belum berjalan akan dihapus."
        confirmLabel="Ya, hapus"
        loading={del.isPending}
      />
    </div>
  );
}

const createSchema = z.object({
  riskId: z.string().min(1, "Risiko wajib dipilih"),
  description: z.string().min(5, "Uraian minimal 5 karakter").max(2000),
  actionPlan: z.string().max(2000).optional(),
  responsibleId: z.string().min(1, "PIC wajib dipilih"),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
});
type CreateForm = z.infer<typeof createSchema>;

function CreateMitigationModal({
  onClose,
  onSubmit,
  loading,
}: {
  onClose: () => void;
  onSubmit: (v: {
    riskId: string;
    description: string;
    actionPlan?: string;
    responsibleId: string;
    startDate?: string;
    dueDate?: string;
    budget?: number;
  }) => void;
  loading?: boolean;
}) {
  const risks = useQuery({
    queryKey: ["risks", "active-options"],
    queryFn: () => fetchRisks({ status: "ACTIVE", pageSize: 100 }),
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema), defaultValues: { riskId: "", responsibleId: "" } });

  const riskId = watch("riskId");
  const selectedRisk = (risks.data?.data ?? []).find((r) => r.id === riskId);
  const owners = useQuery({
    queryKey: ["owners", selectedRisk?.branch.id],
    queryFn: () => fetchOwners(selectedRisk!.branch.id),
    enabled: !!selectedRisk,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Rencana Mitigasi Baru"
      description="Buat rencana mitigasi untuk risiko yang telah berstatus Aktif"
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Batal</Button>
          <Button size="sm" loading={loading} onClick={handleSubmit(onSubmit)}>Simpan</Button>
        </>
      }
    >
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void handleSubmit(onSubmit)(e); }} noValidate>
        <div className="sm:col-span-2">
          <Label htmlFor="mg-risk" required>Risiko (Aktif)</Label>
          <Select
            id="mg-risk"
            {...register("riskId", { onChange: () => setValue("responsibleId", "") })}
            aria-invalid={!!errors.riskId}
          >
            <option value="">{risks.isLoading ? "Memuat..." : "Pilih risiko..."}</option>
            {(risks.data?.data ?? []).map((r: RiskListItem) => (
              <option key={r.id} value={r.id}>{r.code} — {r.title}</option>
            ))}
          </Select>
          <FieldError message={errors.riskId?.message} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="mg-desc" required>Uraian Program Mitigasi</Label>
          <Textarea id="mg-desc" rows={2} {...register("description")} aria-invalid={!!errors.description} />
          <FieldError message={errors.description?.message} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="mg-action">Rencana Aksi</Label>
          <Textarea id="mg-action" rows={2} {...register("actionPlan")} />
        </div>
        <div>
          <Label htmlFor="mg-pic" required>PIC</Label>
          <Select id="mg-pic" {...register("responsibleId")} aria-invalid={!!errors.responsibleId} disabled={!selectedRisk}>
            <option value="">{!selectedRisk ? "Pilih risiko dahulu..." : owners.isLoading ? "Memuat..." : "Pilih PIC..."}</option>
            {(owners.data ?? []).map((o: OwnerOption) => (
              <option key={o.id} value={o.id}>{o.fullName}</option>
            ))}
          </Select>
          <FieldError message={errors.responsibleId?.message} />
        </div>
        <div>
          <Label htmlFor="mg-budget">Anggaran (Rp)</Label>
          <Input id="mg-budget" type="number" min={0} step={1000} {...register("budget")} />
        </div>
        <div>
          <Label htmlFor="mg-start">Tanggal Mulai</Label>
          <Input id="mg-start" type="date" {...register("startDate")} />
        </div>
        <div>
          <Label htmlFor="mg-due">Target Selesai</Label>
          <Input id="mg-due" type="date" {...register("dueDate")} />
        </div>
      </form>
    </Modal>
  );
}

const editSchema = z.object({
  description: z.string().min(5).max(2000),
  actionPlan: z.string().max(2000).optional(),
  responsibleId: z.string().min(1),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
});
type EditForm = z.infer<typeof editSchema>;

function EditMitigationModal({
  plan,
  onClose,
  onSubmit,
  loading,
}: {
  plan: MitigationRow;
  onClose: () => void;
  onSubmit: (v: EditForm) => void;
  loading?: boolean;
}) {
  const owners = useQuery({ queryKey: ["owners", "edit", plan.id], queryFn: () => fetchOwners(plan.risk.branch.id) });
  const { register, handleSubmit, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      description: plan.description,
      actionPlan: plan.actionPlan ?? "",
      responsibleId: plan.responsibleId,
      startDate: plan.startDate ? plan.startDate.slice(0, 10) : "",
      dueDate: plan.dueDate ? plan.dueDate.slice(0, 10) : "",
      budget: plan.budget != null ? Number(plan.budget) : undefined,
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Mitigasi"
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Batal</Button>
          <Button size="sm" loading={loading} onClick={handleSubmit(onSubmit)}>Simpan</Button>
        </>
      }
    >
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void handleSubmit(onSubmit)(e); }} noValidate>
        <div className="sm:col-span-2">
          <Label htmlFor="me-desc" required>Uraian</Label>
          <Textarea id="me-desc" rows={2} {...register("description")} />
          <FieldError message={errors.description?.message} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="me-action">Rencana Aksi</Label>
          <Textarea id="me-action" rows={2} {...register("actionPlan")} />
        </div>
        <div>
          <Label htmlFor="me-pic" required>PIC</Label>
          <Select id="me-pic" {...register("responsibleId")}>
            <option value={plan.responsibleId}>{plan.responsible.fullName}</option>
            {(owners.data ?? []).filter((o) => o.id !== plan.responsibleId).map((o) => (
              <option key={o.id} value={o.id}>{o.fullName}</option>
            ))}
          </Select>
          <FieldError message={errors.responsibleId?.message} />
        </div>
        <div>
          <Label htmlFor="me-budget">Anggaran (Rp)</Label>
          <Input id="me-budget" type="number" min={0} step={1000} {...register("budget")} />
        </div>
        <div>
          <Label htmlFor="me-start">Tanggal Mulai</Label>
          <Input id="me-start" type="date" {...register("startDate")} />
        </div>
        <div>
          <Label htmlFor="me-due">Target Selesai</Label>
          <Input id="me-due" type="date" {...register("dueDate")} />
        </div>
      </form>
    </Modal>
  );
}

function ProgressModal({
  plan,
  onClose,
  onSubmit,
  loading,
}: {
  plan: MitigationRow;
  onClose: () => void;
  onSubmit: (progress: number, note: string) => void;
  loading?: boolean;
}) {
  const [value, setValue] = useState(plan.progress);
  const [note, setNote] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="Update Progres Mitigasi"
      description={plan.description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Batal</Button>
          <Button size="sm" loading={loading} onClick={() => onSubmit(value, note)}>Simpan Progres</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label htmlFor="pg-value">Progres (%)</Label>
          <div className="flex items-center gap-3">
            <input
              id="pg-value"
              type="range"
              min={0}
              max={100}
              step={5}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer accent-primary-500"
            />
            <span className="w-12 text-right text-sm font-semibold text-content-primary">{value}%</span>
          </div>
        </div>
        <div>
          <Label htmlFor="pg-note">Catatan Progres</Label>
          <Textarea id="pg-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Apa yang sudah dikerjakan?" />
        </div>
        {value >= 100 && (
          <p className="rounded border border-warning/30 bg-warning-50 px-3 py-2 text-2xs text-[#8A6210]">
            Progres 100% akan mengajukan mitigasi ini untuk verifikasi Risk Officer/MR.
          </p>
        )}
      </div>
    </Modal>
  );
}

function VerifyModal({
  plan,
  onClose,
  onSubmit,
  loading,
}: {
  plan: MitigationRow;
  onClose: () => void;
  onSubmit: (decision: "APPROVE" | "REJECT", note: string) => void;
  loading?: boolean;
}) {
  const [decision, setDecision] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [note, setNote] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="Verifikasi Mitigasi"
      description={plan.description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Batal</Button>
          <Button size="sm" variant={decision === "APPROVE" ? "primary" : "danger"} loading={loading} onClick={() => onSubmit(decision, note)}>
            {decision === "APPROVE" ? "Verifikasi Selesai" : "Kembalikan"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDecision("APPROVE")}
            className={cn("rounded border px-3 py-2 text-xs font-medium", decision === "APPROVE" ? "border-success bg-success-50 text-success" : "border-border bg-white")}
          >
            Setujui Selesai
          </button>
          <button
            type="button"
            onClick={() => setDecision("REJECT")}
            className={cn("rounded border px-3 py-2 text-xs font-medium", decision === "REJECT" ? "border-danger bg-danger-50 text-danger" : "border-border bg-white")}
          >
            Kembalikan
          </button>
        </div>
        <div>
          <Label htmlFor="vf-note">Catatan</Label>
          <Textarea id="vf-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan verifikasi..." />
        </div>
      </div>
    </Modal>
  );
}

function EvidenceModal({
  plan,
  onClose,
  onUpload,
}: {
  plan: MitigationRow;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title="Unggah Bukti Mitigasi"
      description={plan.description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Batal</Button>
          <Button
            size="sm"
            loading={uploading}
            disabled={!file}
            onClick={async () => {
              if (!file) return;
              setUploading(true);
              await onUpload(file);
              setUploading(false);
            }}
          >
            Unggah
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="ev-file">Dokumen Bukti (PDF/gambar/Word/Excel, maks 5MB)</Label>
        <input
          id="ev-file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-content-secondary file:mr-3 file:rounded file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-primary-700 hover:file:bg-primary-100"
        />
        {file && <p className="text-2xs text-content-muted">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
      </div>
    </Modal>
  );
}
