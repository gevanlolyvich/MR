import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Gavel,
  Layers,
  MessageSquare,
  Pencil,
  Send,
  Tag,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { fetchDetail, riskKeys, useDeleteRisk, useSaveAssessment, useSubmitRisk, useUpdateRisk, CommentRow } from "./api";
import { useSubmitResidual } from "@/features/approvals/api";
import { RiskLevel, RiskStatus } from "./types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { StatusBadge, RiskLevelBadge, Badge } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { Input, Label, FieldError, Textarea } from "@/components/ui/Input";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const statusFlow: Record<RiskStatus, { label: string; done: boolean }[]> = {
  DRAFT: [
    { label: "Input", done: true },
    { label: "Review Officer", done: false },
    { label: "Validasi MR", done: false },
    { label: "Mitigasi", done: false },
    { label: "Close", done: false },
  ],
  SUBMITTED: [
    { label: "Input", done: true },
    { label: "Review Officer", done: false },
    { label: "Validasi MR", done: false },
    { label: "Mitigasi", done: false },
    { label: "Close", done: false },
  ],
  RETURNED: [
    { label: "Input", done: true },
    { label: "Review Officer", done: true },
    { label: "Validasi MR", done: false },
    { label: "Mitigasi", done: false },
    { label: "Close", done: false },
  ],
  PENDING_VALIDATION: [
    { label: "Input", done: true },
    { label: "Review Officer", done: true },
    { label: "Validasi MR", done: false },
    { label: "Mitigasi", done: false },
    { label: "Close", done: false },
  ],
  REJECTED: [
    { label: "Input", done: true },
    { label: "Review Officer", done: true },
    { label: "Validasi MR", done: true },
    { label: "Mitigasi", done: false },
    { label: "Close", done: false },
  ],
  ACTIVE: [
    { label: "Input", done: true },
    { label: "Review Officer", done: true },
    { label: "Validasi MR", done: true },
    { label: "Mitigasi", done: true },
    { label: "Close", done: false },
  ],
  PENDING_VERIFICATION: [
    { label: "Input", done: true },
    { label: "Review Officer", done: true },
    { label: "Validasi MR", done: true },
    { label: "Mitigasi", done: true },
    { label: "Close", done: false },
  ],
  CLOSED: [
    { label: "Input", done: true },
    { label: "Review Officer", done: true },
    { label: "Validasi MR", done: true },
    { label: "Mitigasi", done: true },
    { label: "Close", done: true },
  ],
};

export function RiskDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<"assess" | "history" | "workflow" | "mitigation">("assess");
  const [assessType, setAssessType] = useState<"INHERENT" | "RESIDUAL">("INHERENT");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitNote, setSubmitNote] = useState("");
  const [residualOpen, setResidualOpen] = useState(false);
  const [residualNote, setResidualNote] = useState("");

  const detail = useQuery({
    queryKey: riskKeys.detail(id),
    queryFn: () => fetchDetail(id),
    enabled: !!id,
  });

  const saveAssessment = useSaveAssessment(id);
  const submitRisk = useSubmitRisk(id, {
    onSuccess: () => {
      toast.success("Risiko diajukan", "Menunggu review Risk Officer");
      setSubmitOpen(false);
      setSubmitNote("");
    },
    onError: (msg) => toast.error("Gagal mengajukan", msg),
  });
  const submitResidual = useSubmitResidual();
  const update = useUpdateRisk(id, {
    onSuccess: () => {
      toast.success("Perubahan tersimpan");
      setEditOpen(false);
    },
    onError: (msg) => toast.error("Gagal menyimpan", msg),
  });
  const del = useDeleteRisk({
    onSuccess: () => {
      toast.success("Risiko dihapus");
      navigate("/risks");
    },
    onError: (msg) => toast.error("Gagal menghapus", msg),
  });

  if (detail.isLoading) {
    return (
      <>
        <PageHeader title="Memuat..." icon={ClipboardList} />
        <TableSkeleton rows={6} cols={4} />
      </>
    );
  }
  if (detail.isError || !detail.data?.risk) {
    return (
      <>
        <PageHeader title="Detail Risiko" icon={ClipboardList} />
        <Card>
          <ErrorState message="Risiko tidak ditemukan atau tidak dapat diakses" onRetry={() => void detail.refetch()} />
        </Card>
      </>
    );
  }

  const r = detail.data.risk;
  const isOwner = user?.role === "RISK_OWNER" && user?.id === r.owner.id;
  const editable = isOwner || user?.role === "MR";
  const canSubmitNow = editable && ["DRAFT", "RETURNED", "REJECTED"].includes(r.status);
  const canEditFields = editable && ["DRAFT", "RETURNED", "REJECTED"].includes(r.status);

  const latestInherent = r.assessments.find((a) => a.type === "INHERENT");
  const latestResidual = r.assessments.find((a) => a.type === "RESIDUAL");

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${r.code} · ${r.title}`}
        icon={ClipboardList}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canSubmitNow && (
              <Button size="sm" onClick={() => setSubmitOpen(true)}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Ajukan untuk Review
              </Button>
            )}
            {r.status === "ACTIVE" && r.residualScore != null && (isOwner || user?.role === "MR") && (
              <Button size="sm" onClick={() => setResidualOpen(true)}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Ajukan Residual
              </Button>
            )}
            {canEditFields && (
              <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            )}
            {r.status === "DRAFT" && (isOwner || user?.role === "MR") && (
              <Button size="sm" variant="danger-outline" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Hapus
              </Button>
            )}
          </div>
        }
      />

      {/* Overview */}
      <Card>
        <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoField icon={Tag} label="Kategori" value={r.category.name} />
          <InfoField icon={Building2} label="Branch" value={`${r.branch.name} (${r.branch.code})`} />
          <InfoField icon={UserIcon} label="Risk Owner" value={r.owner.fullName} />
          <InfoField icon={Gavel} label="Status" value={<StatusBadge status={r.status} />} />
          <div className="md:col-span-2 xl:col-span-4">
            <p className="text-2xs font-medium uppercase text-content-secondary">Deskripsi</p>
            <p className="mt-1 text-xs text-content-primary leading-relaxed">{r.description}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-2xs font-medium uppercase text-content-secondary">Penyebab</p>
                <p className="mt-1 text-xs text-content-secondary">{r.causes ?? "-"}</p>
              </div>
              <div>
                <p className="text-2xs font-medium uppercase text-content-secondary">Dampak</p>
                <p className="mt-1 text-xs text-content-secondary">{r.impacts ?? "-"}</p>
              </div>
            </div>
          </div>
          {/* Workflow progress */}
          <div className="md:col-span-2 xl:col-span-4 pt-2 border-t border-border">
            <p className="text-2xs font-medium uppercase text-content-secondary mb-2">Alur Persetujuan</p>
            <ol className="flex flex-wrap items-center gap-1.5">
              {statusFlow[r.status].map((step, i) => (
                <li key={step.label} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-2xs font-medium",
                      step.done ? "bg-success-50 text-success border border-success/25" : "bg-slate-100 text-content-muted",
                    )}
                  >
                    {i + 1}. {step.label}
                  </span>
                  {i < statusFlow[r.status].length - 1 && (
                    <ChevronRight className="h-3 w-3 text-content-muted" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </CardBody>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onChange={(v) => setTab(v as typeof tab)}>
        <TabItem value="assess" icon={Layers}>Penilaian</TabItem>
        <TabItem value="workflow" icon={FileText}>Riwayat Workflow</TabItem>
        <TabItem value="history" icon={ClipboardList}>Riwayat Nilai</TabItem>
        <TabItem value="mitigation" icon={Tag}>Mitigasi</TabItem>
      </Tabs>

      {tab === "assess" && (
        <div className="grid gap-4 xl:grid-cols-3">
          {/* Bila anda adalah reviewer, ubah setelah khusus */}
          <Card className="xl:col-span-2">
            <CardHeader
              title="Summary Penilaian"
              subtitle="Skala Probability dan Impact 1-5, Score = P × I"
            />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <AssessCard
                title="Inherent Assessment"
                assessment={latestInherent}
                probability={r.inherentProbability}
                impact={r.inherentImpact}
                score={r.inherentScore}
                level={r.inherentLevel}
              />
              <AssessCard
                title="Residual Assessment"
                assessment={latestResidual}
                probability={r.residualProbability}
                impact={r.residualImpact}
                score={r.residualScore}
                level={r.residualLevel}
                empty="Residual dapat diisi setelah mitigasi direncanakan"
              />
            </CardBody>
          </Card>

          {/* Panel ubah penilaian */}
          {editable && !["CLOSED"].includes(r.status) && (
            <Card>
              <CardHeader
                title="Update Penilaian"
                subtitle={
                  ["DRAFT", "SUBMITTED", "RETURNED", "REJECTED"].includes(r.status)
                    ? "Hanya Inherent dapat diubah pada tahap ini"
                    : "Inherent & Residual"
                }
              />
              <CardBody>
                <div className="flex rounded border border-border overflow-hidden mb-4">
                  {(["INHERENT", "RESIDUAL"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setAssessType(t)}
                      className={cn(
                        "flex-1 px-2 py-1.5 text-xs font-medium capitalize transition-colors",
                        assessType === t ? "bg-primary-500 text-white" : "bg-white hover:bg-slate-50",
                        t === "RESIDUAL" && ["DRAFT", "SUBMITTED", "RETURNED", "REJECTED"].includes(r.status) && "opacity-50",
                      )}
                      disabled={t === "RESIDUAL" && ["DRAFT", "SUBMITTED", "RETURNED", "REJECTED"].includes(r.status)}
                    >
                      {t.toLowerCase()}
                    </button>
                  ))}
                </div>

                <AssessmentForm
                  risk={r}
                  type={assessType}
                  pending={saveAssessment.isPending}
                  onSave={(probability, impact, justification) =>
                    saveAssessment.mutate(
                      { type: assessType, probability, impact, justification },
                      {
                        onSuccess: () => toast.success("Penilaian tersimpan", "Semua perubahan tercatat di riwayat"),
                        onError: (msg) =>
                          toast.error(
                            "Gagal menyimpan",
                            (msg as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Terjadi kesalahan",
                          ),
                      },
                    )
                  }
                  
                />
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {tab === "workflow" && (
        <Card>
          <CardHeader title="Riwayat Workflow & Approval" subtitle="Setiap perubahan status tercatat oleh sistem" />
          <CardBody className="p-0">
            <Timeline
              items={r.approvals.map((a) => ({
                id: a.id,
                title: a.action,
                desc: `${a.actor?.fullName ?? "-"}: ${a.fromStatus ?? "?"} → ${a.toStatus ?? "?"}${a.note ? ` · "${a.note}"` : ""}`,
                at: a.createdAt,
                success: true,
              }))}
            />
          </CardBody>
        </Card>
      )}

      {tab === "history" && (
        <Card>
          <CardHeader title="Riwayat Perubahan Penilaian" subtitle="Audit trail untuk setiap revisi nilai assessment" />
          <CardBody className="p-0">
            <Timeline
              items={r.histories.map((h) => ({
                id: h.id,
                title: `${h.type} assessment`,
                desc: `${h.changedBy?.fullName ?? "-"}: P${h.oldProbability ?? "-"}·I${h.oldImpact ?? "-"} → P${h.newProbability}·I${h.newImpact}${h.reason ? ` · ${h.reason}` : ""}`,
                at: h.createdAt,
                success: true,
              }))}
            />
          </CardBody>
        </Card>
      )}

      {tab === "mitigation" && (
        <Card>
          <CardHeader title="Mitigation Plan" subtitle="Program mitigasi terkait risiko ini" />
          {r.mitigations.length === 0 ? (
            <CardBody>
              <p className="text-xs text-content-secondary">Belum ada rencana mitigasi. Setelah risiko tervalidasi, mitigasi dapat diusulkan di modul Mitigation Plan.</p>
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[620px]">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-left text-content-secondary">
                    <th className="px-3 py-2 font-medium">Program</th>
                    <th className="px-3 py-2 font-medium">PIC</th>
                    <th className="px-3 py-2 font-medium">Target</th>
                    <th className="px-3 py-2 font-medium w-40">Progress</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {r.mitigations.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2.5 text-content-primary">{m.description}</td>
                      <td className="px-3 py-2.5 text-content-secondary">{m.responsible?.fullName ?? "-"}</td>
                      <td className="px-3 py-2.5 text-content-secondary whitespace-nowrap">{m.dueDate ? new Date(m.dueDate).toLocaleDateString("id-ID") : "-"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded bg-slate-100 overflow-hidden">
                            <div className="h-full bg-primary-500 rounded" style={{ width: `${m.progress}%` }} />
                          </div>
                          <span className="text-2xs text-content-secondary shrink-0">{m.progress}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={(m.status === "COMPLETED" ? "success" : m.status === "PENDING_VERIFICATION" ? "warning" : "primary") as "success" | "warning" | "primary"}>
                          {m.status.replace("_", " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Catatan reviewer */}
      {r.comments.length > 0 && (
        <Card>
          <CardHeader title="Catatan Reviewer" subtitle="Masukan dari Risk Officer / MR" />
          {r.comments.map((c: CommentRow) => (
            <Body key={c.id}>
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-3.5 w-3.5 text-content-muted shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-content-primary">{c.author?.fullName}</span>
                <Badge variant={c.authorRole === "MR" ? "primary" : "default"}>{c.authorRole}</Badge>
                {!c.isResolved && <Badge variant="warning">Belum ditanggapi</Badge>}
              </div>
              <p className="text-xs text-content-secondary leading-relaxed">{c.comment}</p>
              <p className="text-2xs text-content-muted mt-1">{new Date(c.createdAt).toLocaleString("id-ID")}</p>
            </Body>
          ))}
        </Card>
      )}

      {/* Submit modal */}
      <Modal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title={`Ajukan ${r.code}?`}
        description="Risiko dikirim ke Risk Officer untuk review kelengkapan"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setSubmitOpen(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              loading={submitRisk.isPending}
              onClick={() => submitRisk.mutate(submitNote)}
            >
              Ajukan
            </Button>
          </>
        }
      >
        <Label htmlFor="submit-note">Catatan (opsional)</Label>
        <Textarea
          id="submit-note"
          rows={3}
          placeholder="Pesan ke reviewer..."
          value={submitNote}
          onChange={(e) => setSubmitNote(e.target.value)}
        />
      </Modal>

      {/* Submit residual modal */}
      <Modal
        open={residualOpen}
        onClose={() => setResidualOpen(false)}
        title={`Ajukan verifikasi residual ${r.code}?`}
        description="Residual assessment akan diverifikasi MR. Pastikan program mitigasi telah dilaksanakan."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setResidualOpen(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              loading={submitResidual.isPending}
              onClick={() =>
                submitResidual.mutate(
                  { id: r.id, body: { note: residualNote || undefined } },
                  {
                    onSuccess: () => {
                      toast.success("Residual diajukan", "Menunggu verifikasi MR");
                      setResidualOpen(false);
                      setResidualNote("");
                    },
                    onError: (err) =>
                      toast.error("Gagal mengajukan residual", getErrorMessage(err)),
                  },
                )
              }
            >
              Ajukan
            </Button>
          </>
        }
      >
        <Label htmlFor="residual-note">Catatan (opsional)</Label>
        <Textarea
          id="residual-note"
          rows={3}
          placeholder="Ringkasan pelaksanaan mitigasi..."
          value={residualNote}
          onChange={(e) => setResidualNote(e.target.value)}
        />
      </Modal>

      {/* Edit modal */}
      {r && <EditModal risk={r} open={editOpen} onClose={() => setEditOpen(false)} loading={update.isPending} onSave={(v) => update.mutate(v)} />}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => del.mutate(r.id)}
        title="Hapus risiko draft?"
        message={`Risiko ${r.code} akan dihapus permanen dari registri.`}
        confirmLabel="Ya, hapus"
        loading={del.isPending}
      />
    </div>
  );
}

function InfoField({ icon: Icon, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-2xs font-medium uppercase text-content-secondary flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
        {label}
      </p>
      <div className="mt-1 text-xs text-content-primary">{value}</div>
    </div>
  );
}

function AssessCard({
  title,
  assessment,
  probability,
  impact,
  score,
  level,
  empty,
}: {
  title: string;
  assessment?: { justification: string | null; assessedBy: { fullName: string } | null; createdAt: string };
  probability: number | null;
  impact: number | null;
  score: number | null;
  level: RiskLevel | null;
  empty?: string;
}) {
  return (
    <div className="rounded border border-border bg-slate-50/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-2xs font-semibold uppercase text-content-secondary">{title}</p>
        <RiskLevelBadge level={level} withScore={score} />
      </div>
      {probability == null ? (
        <p className="text-xs text-content-muted">{empty ?? "Belum dinilai"}</p>
      ) : (
        <>
          <p className="text-xs text-content-primary">
            Probability <strong>{probability}</strong> · Impact <strong>{impact}</strong>
          </p>
          {assessment && (
            <p className="mt-1.5 text-2xs text-content-secondary">
              {assessment.justification ?? "-"} — {assessment.assessedBy?.fullName} · {new Date(assessment.createdAt).toLocaleDateString("id-ID")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

const assessFormSchema = z.object({
  probability: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  justification: z.string().max(1000).optional(),
});
type AssessForm = z.infer<typeof assessFormSchema>;

function AssessmentForm({
  risk,
  type,
  pending,
  onSave,
}: {
  risk: { inherentProbability: number; inherentImpact: number; residualProbability: number | null; residualImpact: number | null };
  type: "INHERENT" | "RESIDUAL";
  pending?: boolean;
  onSave: (p: number, i: number, note?: string) => void;
}) {
  const defaultP = type === "INHERENT" ? risk.inherentProbability : risk.residualProbability ?? 0;
  const defaultI = type === "INHERENT" ? risk.inherentImpact : risk.residualImpact ?? 0;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AssessForm>({
    resolver: zodResolver(assessFormSchema),
    defaultValues: { probability: defaultP || 1, impact: defaultI || 1 },
  });
  const p = watch("probability");
  const i = watch("impact");
  const score = p * i;
  const levelLabel = score >= 16 ? "Very High" : score >= 11 ? "High" : score >= 6 ? "Medium" : "Low";
  const sameValue = p === defaultP && i === defaultI;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit((v) => onSave(v.probability, v.impact, v.justification))(e);
      }}
      noValidate
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`pf-${type}`} required>Probability (1-5)</Label>
          <Input id={`pf-${type}`} type="number" min={1} max={5} {...register("probability")} aria-invalid={!!errors.probability} />
        </div>
        <div>
          <Label htmlFor={`pi-${type}`} required>Impact (1-5)</Label>
          <Input id={`pi-${type}`} type="number" min={1} max={5} {...register("impact")} aria-invalid={!!errors.impact} />
        </div>
      </div>
      {!sameValue && (
        <div className="flex items-center gap-2 rounded border border-primary-200 bg-primary-50 px-3 py-2 text-xs">
          <span className="text-content-secondary">Preview:</span>
          <strong className="text-primary-700">
            Score {score} · {levelLabel}
          </strong>
          <ArrowRightLeft className="h-3 w-3 text-primary-400" aria-hidden="true" />
        </div>
      )}
      <div>
        <Label htmlFor={`jn-${type}`}>Justifikasi Perubahan</Label>
        <Textarea id={`jn-${type}`} rows={2} placeholder="Alasan perubahan penilaian (tercatat di audit trail)" {...register("justification")} />
      </div>
      <Button type="submit" size="sm" className="w-full" loading={pending} disabled={sameValue}>
        Simpan Penilaian {type.toLowerCase()}
      </Button>
    </form>
  );
}

const editFormSchema = z.object({
  title: z.string().min(5, "Judul minimal 5 karakter").max(150),
  description: z.string().min(10).max(2000),
  causes: z.string().max(1000).optional(),
  impacts: z.string().max(1000).optional(),
});
type EditForm2 = z.infer<typeof editFormSchema>;

function EditModal({
  risk,
  open,
  onClose,
  onSave,
  loading,
}: {
  risk: { title: string; description: string; causes: string | null; impacts: string | null };
  open: boolean;
  onClose: () => void;
  onSave: (v: EditForm2) => void;
  loading?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditForm2>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      title: risk.title,
      description: risk.description,
      causes: risk.causes ?? "",
      impacts: risk.impacts ?? "",
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Risiko"
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" loading={loading} onClick={handleSubmit((v) => onSave(v))}>
            Simpan
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void handleSubmit((v) => onSave(v))(e); }} noValidate>
        <div>
          <Label htmlFor="ed-title" required>Judul</Label>
          <Input id="ed-title" {...register("title")} aria-invalid={!!errors.title} />
          <FieldError message={errors.title?.message} />
        </div>
        <div>
          <Label htmlFor="ed-desc" required>Deskripsi</Label>
          <Textarea id="ed-desc" rows={3} {...register("description")} aria-invalid={!!errors.description} />
          <FieldError message={errors.description?.message} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ed-causes">Penyebab</Label>
            <Textarea id="ed-causes" rows={2} {...register("causes")} />
          </div>
          <div>
            <Label htmlFor="ed-imp">Dampak</Label>
            <Textarea id="ed-imp" rows={2} {...register("impacts")} />
          </div>
        </div>
      </form>
    </Modal>
  );
}

function Timeline({ items }: { items: { id: string; title: string; desc: string; at: string; success?: boolean }[] }) {
  if (items.length === 0) {
    return <p className="px-4 py-6 text-xs text-content-secondary text-center">Belum ada riwayat</p>;
  }
  return (
    <ol className="relative px-4 py-3 overflow-hidden">
      <div className="absolute left-6 top-6 bottom-6 w-px bg-border" aria-hidden="true" />
      {items.map((it) => (
        <li key={it.id} className="relative pl-8 pb-4 last:pb-0">
          <span
            className={cn(
              "absolute left-0 top-0.5 h-3.5 w-3.5 rounded-full border-2",
              it.success ? "bg-success border-success/40" : "bg-slate-300 border-border",
            )}
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-xs font-medium text-content-primary">{it.title.replace(/_/g, " ")}</p>
            <span className="text-2xs text-content-muted">{new Date(it.at).toLocaleString("id-ID")}</span>
          </div>
          <p className="mt-0.5 text-xs text-content-secondary">{it.desc}</p>
        </li>
      ))}
    </ol>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-border last:border-0">
      {children}
    </div>
  );
}
