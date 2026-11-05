import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileSignature, ShieldCheck, ClipboardCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  fetchApprovalQueue,
  approvalKeys,
  useReviewRisk,
  useValidateRisk,
  useVerifyRisk,
  useVerifyMitigation,
  type ApprovalRiskRow,
  type ApprovalMitigationRow,
  type Decision,
} from "./api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge, RiskLevelBadge, Badge } from "@/components/ui/Badge";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";

type ActionKind = "review" | "validate" | "verify" | "verifyMitigation";

interface PendingAction {
  kind: ActionKind;
  id: string;
  label: string;
  title: string;
  description: string;
  allowReturn?: boolean;
  approveLabel: string;
  rejectLabel?: string;
}

export function ApprovalPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<"risks" | "mitigations">("risks");
  const [action, setAction] = useState<PendingAction | null>(null);

  const queue = useQuery({ queryKey: approvalKeys.queue, queryFn: fetchApprovalQueue });

  const review = useReviewRisk();
  const validate = useValidateRisk();
  const verify = useVerifyRisk();
  const verifyMitigation = useVerifyMitigation();

  const isMr = user?.role === "MR";
  const isOfficer = user?.role === "RISK_OFFICER";

  function riskAction(row: ApprovalRiskRow): PendingAction | null {
    if (row.status === "SUBMITTED" && (isOfficer || isMr)) {
      return {
        kind: "review",
        id: row.id,
        label: "Review",
        title: `Review ${row.code}`,
        description: "Setujui kelengkapan risiko untuk diteruskan ke validasi MR, atau kembalikan untuk revisi.",
        allowReturn: true,
        approveLabel: "Setujui Review",
        rejectLabel: "Kembalikan untuk Revisi",
      };
    }
    if (row.status === "PENDING_VALIDATION" && isMr) {
      return {
        kind: "validate",
        id: row.id,
        label: "Validasi",
        title: `Validasi ${row.code}`,
        description: "Validasi risiko. Jika disetujui, risiko menjadi Aktif dan siap masuk tahap mitigasi.",
        approveLabel: "Validasi & Aktifkan",
        rejectLabel: "Tolak Risiko",
      };
    }
    if (row.status === "PENDING_VERIFICATION" && isMr) {
      return {
        kind: "verify",
        id: row.id,
        label: "Verifikasi",
        title: `Verifikasi Residual ${row.code}`,
        description: "Verifikasi penilaian residual. Jika disetujui, risiko akan ditutup (Closed).",
        approveLabel: "Verifikasi & Tutup",
        rejectLabel: "Tolak Verifikasi",
      };
    }
    return null;
  }

  function mitigationAction(row: ApprovalMitigationRow): PendingAction {
    return {
      kind: "verifyMitigation",
      id: row.id,
      label: "Verifikasi",
      title: "Verifikasi Mitigasi",
      description: `Verifikasi penyelesaian mitigasi untuk ${row.risk.code}: "${row.description}".`,
      approveLabel: "Verifikasi Selesai",
      rejectLabel: "Kembalikan ke In Progress",
    };
  }

  function submit(decision: Decision, note: string) {
    if (!action) return;
    const body = { decision, note: note || undefined };
    const callbacks = {
      onSuccess: () => {
        toast.success("Berhasil", "Keputusan approval telah disimpan");
        setAction(null);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Terjadi kesalahan";
        toast.error("Gagal memproses", msg);
      },
    };

    if (action.kind === "review") {
      review.mutate({ id: action.id, body }, callbacks);
    } else if (action.kind === "validate") {
      validate.mutate({ id: action.id, body }, callbacks);
    } else if (action.kind === "verify") {
      verify.mutate({ id: action.id, body }, callbacks);
    } else {
      const final: "APPROVE" | "REJECT" = decision === "APPROVE" ? "APPROVE" : "REJECT";
      verifyMitigation.mutate({ id: action.id, body: { decision: final, note: body.note } }, callbacks);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Approval & Workflow"
        description="Antrean review, validasi, dan verifikasi sesuai peran Anda"
        icon={FileSignature}
      />

      <Tabs value={tab} onChange={(v) => setTab(v as typeof tab)}>
        <TabItem value="risks" icon={ClipboardCheck}>
          Risiko {queue.data ? `(${queue.data.counts.risks})` : ""}
        </TabItem>
        <TabItem value="mitigations" icon={ShieldCheck}>
          Mitigasi {queue.data ? `(${queue.data.counts.mitigations})` : ""}
        </TabItem>
      </Tabs>

      {queue.isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : queue.isError ? (
        <Card>
          <ErrorState message="Antrean approval gagal dimuat" onRetry={() => void queue.refetch()} />
        </Card>
      ) : tab === "risks" ? (
        <Card>
          <CardHeader title="Antrean Risiko" subtitle="Risiko yang memerlukan tindakan Anda" />
          {queue.data!.risks.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Tidak ada antrean"
              description="Semua risiko pada cakupan Anda sudah diproses."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-xs">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-left text-content-secondary">
                    <th className="px-3 py-2 font-medium">Risiko</th>
                    <th className="px-3 py-2 font-medium">Branch / Owner</th>
                    <th className="px-3 py-2 font-medium">Inherent</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.data!.risks.map((row) => {
                    const act = riskAction(row);
                    return (
                      <tr key={row.id} className="border-b border-border last:border-0 align-top">
                        <td className="px-3 py-2.5">
                          <Link to={`/risks/${row.id}`} className="font-medium text-primary-600 hover:underline">
                            {row.code}
                          </Link>
                          <p className="mt-0.5 max-w-xs truncate text-content-primary">{row.title}</p>
                          <p className="text-2xs text-content-muted">{row.category.name}</p>
                        </td>
                        <td className="px-3 py-2.5 text-content-secondary">
                          <p>{row.branch.code}</p>
                          <p className="text-2xs">{row.owner.fullName}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <RiskLevelBadge level={row.inherentLevel} withScore={row.inherentScore} />
                          {row.residualLevel && (
                            <p className="mt-1">
                              <RiskLevelBadge level={row.residualLevel} withScore={row.residualScore} />
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {act ? (
                            <Button size="sm" onClick={() => setAction(act)}>
                              {act.label}
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          ) : (
                            <Link to={`/risks/${row.id}`} className="text-2xs font-medium text-primary-600 hover:underline">
                              Lihat detail
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader title="Antrean Verifikasi Mitigasi" subtitle="Mitigasi yang telah mencapai 100% dan menunggu verifikasi" />
          {queue.data!.mitigations.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Tidak ada antrean mitigasi"
              description="Belum ada mitigasi yang menunggu verifikasi."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-left text-content-secondary">
                    <th className="px-3 py-2 font-medium">Risiko</th>
                    <th className="px-3 py-2 font-medium">Program Mitigasi</th>
                    <th className="px-3 py-2 font-medium">PIC</th>
                    <th className="px-3 py-2 font-medium">Progres</th>
                    <th className="px-3 py-2 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.data!.mitigations.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-3 py-2.5">
                        <Link to={`/risks/${row.risk.id}`} className="font-medium text-primary-600 hover:underline">
                          {row.risk.code}
                        </Link>
                        <p className="mt-0.5 max-w-xs truncate text-content-primary">{row.risk.title}</p>
                      </td>
                      <td className="px-3 py-2.5 text-content-primary max-w-sm">{row.description}</td>
                      <td className="px-3 py-2.5 text-content-secondary">{row.responsible.fullName}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded bg-slate-100">
                            <div className="h-full rounded bg-primary-500" style={{ width: `${row.progress}%` }} />
                          </div>
                          <span className="text-2xs text-content-secondary">{row.progress}%</span>
                        </div>
                        <Badge variant="warning" className="mt-1">
                          {row.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button size="sm" onClick={() => setAction(mitigationAction(row))}>
                          Verifikasi
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <DecisionModal
        action={action}
        loading={review.isPending || validate.isPending || verify.isPending || verifyMitigation.isPending}
        onClose={() => setAction(null)}
        onSubmit={submit}
      />
    </div>
  );
}

function DecisionModal({
  action,
  loading,
  onClose,
  onSubmit,
}: {
  action: PendingAction | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (decision: Decision, note: string) => void;
}) {
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | "RETURN">("APPROVE");
  const [note, setNote] = useState("");

  function close() {
    setDecision("APPROVE");
    setNote("");
    onClose();
  }

  const rejectValue = action?.allowReturn ? "RETURN" : "REJECT";

  return (
    <Modal
      open={!!action}
      onClose={close}
      title={action?.title ?? ""}
      description={action?.description}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={close}>
            Batal
          </Button>
          <Button
            size="sm"
            variant={decision === "APPROVE" ? "primary" : "danger"}
            loading={loading}
            onClick={() => {
              onSubmit(decision, note);
              setDecision("APPROVE");
              setNote("");
            }}
          >
            {decision === "APPROVE" ? action?.approveLabel : (action?.rejectLabel ?? "Tolak")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setDecision("APPROVE")}
            className={cn(
              "rounded border px-3 py-2.5 text-left text-xs transition-colors",
              decision === "APPROVE" ? "border-success bg-success-50" : "border-border bg-white hover:bg-slate-50",
            )}
          >
            <span className="flex items-center gap-1.5 font-semibold text-content-primary">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              Setujui
            </span>
            <span className="mt-0.5 block text-2xs text-content-secondary">{action?.approveLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => setDecision(rejectValue)}
            className={cn(
              "rounded border px-3 py-2.5 text-left text-xs transition-colors",
              decision !== "APPROVE" ? "border-danger bg-danger-50" : "border-border bg-white hover:bg-slate-50",
            )}
          >
            <span className="flex items-center gap-1.5 font-semibold text-content-primary">
              <ClipboardCheck className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
              {action?.allowReturn ? "Kembalikan" : "Tolak"}
            </span>
            <span className="mt-0.5 block text-2xs text-content-secondary">{action?.rejectLabel ?? "Tolak pengajuan"}</span>
          </button>
        </div>
        <div>
          <Label htmlFor="decision-note">
            Catatan {decision !== "APPROVE" && action?.allowReturn ? "(wajib)" : "(opsional)"}
          </Label>
          <Textarea
            id="decision-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tambahkan catatan untuk pihak terkait..."
          />
        </div>
      </div>
    </Modal>
  );
}
