import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, Filter, Search, Plus, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { fetchRisks, riskKeys, fetchRefs, fetchOwners, ReferenceOption, RiskListItem } from "./api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge, RiskLevelBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";
import { RiskLevel, RiskStatus } from "./types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDeleteRisk, useCreateRisk } from "./api";

const levelOptions: { value: RiskLevel | ""; label: string }[] = [
  { value: "", label: "Semua Level" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "VERY_HIGH", label: "Very High" },
];

const statusOptions: { value: RiskStatus | ""; label: string }[] = [
  { value: "", label: "Semua Status" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Diajukan" },
  { value: "RETURNED", label: "Direvisi" },
  { value: "PENDING_VALIDATION", label: "Menunggu Validasi" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PENDING_VERIFICATION", label: "Menunggu Verifikasi" },
  { value: "CLOSED", label: "Ditutup" },
];

export function RisksPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [branchId, setBranchId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [level, setLevel] = useState("");
  const [levelField, setLevelField] = useState<"inherent" | "residual">("inherent");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showCreate, setShowCreate] = useState(false);

  const params = useMemo(
    () => ({
      q: qDebounced || undefined,
      branchId: branchId || undefined,
      categoryId: categoryId || undefined,
      status: status || undefined,
      level: level || undefined,
      levelField,
      page,
      pageSize: 10,
      sortBy,
      sortDir,
    }),
    [qDebounced, branchId, categoryId, status, level, levelField, page, sortBy, sortDir],
  );

  const list = useQuery({
    queryKey: riskKeys.list(params),
    queryFn: () => fetchRisks(params),
    placeholderData: (prev) => prev,
  });

  const refs = useQuery({ queryKey: riskKeys.refs, queryFn: fetchRefs });
  const branchOptions = user?.role === "MR" ? refs.data?.branches ?? [] : user?.branch ? [{ id: user.branch.id, name: user.branch.name, code: user.branch.code }] : [];
  const categoryOptions = refs.data?.categories ?? [];

  const del = useDeleteRisk({
    onError: (msg) => toast.error("Gagal menghapus", msg),
  });
  const create = useCreateRisk({
    onSuccess: () => {
      toast.success("Risiko dibuat", "Draft risiko berhasil disimpan");
      setShowCreate(false);
    },
    onError: (msg) => toast.error("Gagal membuat risiko", msg),
  });
  const [detail, setDetail] = useState<RiskListItem | null>(null);

  function onSearch(v: string) {
    setQ(v);
    setPage(1);
    window.clearTimeout((onSearch as unknown as { t?: number }).t);
    (onSearch as unknown as { t?: number }).t = window.setTimeout(() => setQDebounced(v), 400);
  }

  function toggleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir(col === "code" || col === "title" ? "asc" : "desc");
    }
  }

  const sortByCol = (col: string) =>
    cn(
      "cursor-pointer select-none hover:text-primary-600",
      sortBy === col && "text-primary-600 font-semibold",
      "inline-flex items-center gap-1",
    );

  const canCreate = can("risk:create");

  return (
    <div>
      <PageHeader
        title="Risk Register"
        icon={ClipboardList}
        description={
          user?.branch ? `Risiko cabang ${user.branch.name}` : "Seluruh risiko perusahaan"
        }
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Risiko Baru
            </Button>
          ) : null
        }
      />

      {/* Filter bar */}
      <Card className="mb-4">
        <div className="p-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:items-end">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-content-muted" aria-hidden="true" />
            <Input
              placeholder="Cari kode / judul / deskripsi..."
              aria-label="Pencarian risiko"
              className="pl-8"
              value={q}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          {user?.role === "MR" && (
            <Select value={branchId} onChange={(e) => { setBranchId(e.target.value); setPage(1); }} aria-label="Filter Branch">
              <option value="">Semua Branch</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </Select>
          )}
          <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} aria-label="Filter Kategori">
            <option value="">Semua Kategori</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter Status">
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }} aria-label="Filter Level">
              {levelOptions.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {level && (
          <div className="px-3 pb-3 flex items-center gap-2 text-2xs text-content-secondary">
            <Filter className="h-3 w-3" aria-hidden="true" />
            Level berdasarkan:
            <div className="flex rounded border border-border overflow-hidden">
              {(["inherent", "residual"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setLevelField(f)}
                  className={cn(
                    "px-2 py-1 capitalize",
                    levelField === f ? "bg-primary-500 text-white" : "bg-white hover:bg-slate-50",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Tabel */}
      <Card>
        {list.isLoading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : list.isError ? (
          <ErrorState onRetry={() => void list.refetch()} />
        ) : (list.data?.data.length ?? 0) === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Tidak ada risiko"
            description="Ubah filter atau tambahkan risiko baru untuk memulai."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-left text-content-secondary whitespace-nowrap">
                  <th className="px-3 py-2 font-medium">
                    <button className={sortByCol("code")} onClick={() => toggleSort("code")}>Kode</button>
                  </th>
                  <th className="px-3 py-2 font-medium min-w-[210px]">
                    <button className={sortByCol("title")} onClick={() => toggleSort("title")}>Judul Risiko</button>
                  </th>
                  <th className="px-3 py-2 font-medium">
                    <button className={sortByCol("branch")} onClick={() => toggleSort("branch")}>Branch</button>
                  </th>
                  <th className="px-3 py-2 font-medium">
                    <button className={sortByCol("category")} onClick={() => toggleSort("category")}>Kategori</button>
                  </th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium text-center">Inherent</th>
                  <th className="px-3 py-2 font-medium text-center">Residual</th>
                  <th className="px-3 py-2 font-medium">
                    <button className={sortByCol("status")} onClick={() => toggleSort("status")}>Status</button>
                  </th>
                  <th className="px-3 py-2 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(list.data?.data ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-medium text-primary-700 whitespace-nowrap">
                      <Link to={`/risks/${r.id}`} className="hover:underline">{r.code}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-content-primary max-w-[260px] truncate" title={r.title}>
                      <Link to={`/risks/${r.id}`} className="hover:underline">{r.title}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-content-secondary whitespace-nowrap">{r.branch.code}</td>
                    <td className="px-3 py-2.5 text-content-secondary whitespace-nowrap">{r.category.name}</td>
                    <td className="px-3 py-2.5 text-content-secondary whitespace-nowrap">{r.owner.fullName}</td>
                    <td className="px-3 py-2.5 text-center">
                      <RiskLevelBadge level={r.inherentLevel} withScore={r.inherentScore} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <RiskLevelBadge level={r.residualLevel} withScore={r.residualScore} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {r.status === "DRAFT" && (user?.role === "MR" || user?.id === r.owner.id) && (
                        <button
                          aria-label={`Hapus ${r.code}`}
                          title="Hapus draft"
                          className="grid h-7 w-7 place-items-center rounded text-content-muted hover:bg-danger-50 hover:text-danger"
                          onClick={() => setDetail(r)}
                        >
                          ✕
                        </button>
                      )}
                      <button
                        aria-label={`Detail ${r.code}`}
                        title="Detail"
                        className="grid h-7 w-7 place-items-center rounded text-content-muted hover:bg-slate-100 hover:text-content-primary"
                        onClick={() => navigate(`/risks/${r.id}`)}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {list.data && list.data.meta.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2.5">
            <p className="text-2xs text-content-secondary">
              Menampilkan {Math.max(1, (list.data.meta.page - 1) * list.data.meta.pageSize + 1)}-
              {Math.min(list.data.meta.total, list.data.meta.page * list.data.meta.pageSize)} dari{" "}
              <strong>{list.data.meta.total}</strong> risiko
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={list.data.meta.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="text-2xs text-content-secondary px-2">
                {list.data.meta.page}/{list.data.meta.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={list.data.meta.page >= list.data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Halaman berikutnya"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!detail}
        onClose={() => setDetail(null)}
        onConfirm={() => {
          if (detail) del.mutate(detail.id);
          setDetail(null);
        }}
        title="Hapus risiko draft?"
        message={`Risiko ${detail?.code} - "${detail?.title}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, hapus"
        loading={del.isPending}
      />

      {showCreate && (
        <CreateRiskModal
          branches={branchOptions}
          categories={categoryOptions}
          defaultBranchId={user?.branch?.id ?? ""}
          onClose={() => setShowCreate(false)}
          loading={create.isPending}
          onSubmit={(v) =>
            create.mutate({
              branchId: v.branchId,
              categoryId: v.categoryId,
              ownerId: v.ownerId,
              title: v.title,
              description: v.description,
              causes: v.causes || undefined,
              impacts: v.impacts || undefined,
              inherent: { probability: v.probability, impact: v.impact },
            })
          }
        />
      )}
    </div>
  );
}

/** Form create risiko (RHF + zod) */
const createFormSchema = z.object({
  branchId: z.string().min(1, "Branch wajib dipilih"),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  ownerId: z.string().min(1, "Risk Owner wajib dipilih"),
  title: z.string().min(5, "Judul minimal 5 karakter").max(150),
  description: z.string().min(10, "Deskripsi minimal 10 karakter").max(2000),
  causes: z.string().max(1000).optional(),
  impacts: z.string().max(1000).optional(),
  probability: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
});
type CreateForm = z.infer<typeof createFormSchema>;

function CreateRiskModal({
  branches,
  categories,
  defaultBranchId,
  onClose,
  onSubmit,
  loading,
}: {
  branches: ReferenceOption[];
  categories: ReferenceOption[];
  defaultBranchId: string;
  onClose: () => void;
  onSubmit: (v: CreateForm) => void;
  loading?: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { branchId: defaultBranchId, ownerId: "", probability: 3, impact: 3 },
  });
  const p = watch("probability");
  const i = watch("impact");
  const selectedBranch = watch("branchId");
  const owners = useQuery({
    queryKey: ["owners", selectedBranch],
    queryFn: () => fetchOwners(selectedBranch),
    enabled: !!selectedBranch,
  });
  const score = p * i;
  const previewColor = score >= 16 ? "bg-risk-very-high text-white" : score >= 11 ? "bg-corporate-red text-white" : score >= 6 ? "bg-corporate-yellow text-navy" : "bg-success text-white";
  const levelLabel = score >= 16 ? "Very High" : score >= 11 ? "High" : score >= 6 ? "Medium" : "Low";

  return (
    <Modal
      open
      onClose={onClose}
      title="Risiko Baru"
      description="Tambahkan risiko baru berstatus Draft dengan penilaian awal (inherent)"
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="h-8 px-3 text-xs rounded border border-border bg-white hover:bg-slate-50">
            Batal
          </button>
          <Button size="sm" loading={loading} onClick={handleSubmit(onSubmit)}>
            Simpan Draft
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(onSubmit)(e);
        }}
        noValidate
      >
        <div>
          <Label htmlFor="cr-branch" required>Branch</Label>
          <Select
            id="cr-branch"
            {...register("branchId", {
              onChange: () => setValue("ownerId", ""),
            })}
            aria-invalid={!!errors.branchId}
          >
            <option value="">Pilih branch...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </Select>
          <FieldError message={errors.branchId?.message} />
        </div>
        <div>
          <Label htmlFor="cr-category" required>Kategori Risiko</Label>
          <Select id="cr-category" {...register("categoryId")} aria-invalid={!!errors.categoryId}>
            <option value="">Pilih kategori...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <FieldError message={errors.categoryId?.message} />
        </div>
        <div>
          <Label htmlFor="cr-owner" required>Risk Owner</Label>
          <Select id="cr-owner" {...register("ownerId")} aria-invalid={!!errors.ownerId} disabled={!selectedBranch}>
            <option value="">{!selectedBranch ? "Pilih branch dahulu..." : owners.isLoading ? "Memuat..." : "Pilih owner..."}</option>
            {owners.data?.map((o) => (
              <option key={o.id} value={o.id}>{o.fullName}</option>
            ))}
          </Select>
          <FieldError message={errors.ownerId?.message} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="cr-title" required>Judul Risiko</Label>
          <Input id="cr-title" placeholder="Ringkasan risiko" {...register("title")} aria-invalid={!!errors.title} />
          <FieldError message={errors.title?.message} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="cr-desc" required>Deskripsi Risiko</Label>
          <Textarea id="cr-desc" rows={3} placeholder="Jelaskan risiko..." {...register("description")} aria-invalid={!!errors.description} />
          <FieldError message={errors.description?.message} />
        </div>
        <div>
          <Label htmlFor="cr-causes">Penyebab (Causes)</Label>
          <Textarea id="cr-causes" rows={2} placeholder="Apa akar penyebabnya?" {...register("causes")} />
        </div>
        <div>
          <Label htmlFor="cr-impacts">Dampak (Impacts)</Label>
          <Textarea id="cr-impacts" rows={2} placeholder="Apa dampaknya?" {...register("impacts")} />
        </div>
        <div>
          <Label htmlFor="cr-prob" required>Probability (1-5)</Label>
          <Input id="cr-prob" type="number" min={1} max={5} {...register("probability")} aria-invalid={!!errors.probability} />
          <FieldError message={errors.probability?.message} />
        </div>
        <div>
          <Label htmlFor="cr-imp2" required>Impact (1-5)</Label>
          <Input id="cr-imp2" type="number" min={1} max={5} {...register("impact")} aria-invalid={!!errors.impact} />
          <FieldError message={errors.impact?.message} />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3 rounded bg-slate-50 border border-border px-3 py-2.5">
          <span className="text-xs text-content-secondary">Nilai awal (inherent):</span>
          <span className={cn("text-sm font-bold px-2.5 py-1 rounded", previewColor)} aria-live="polite">
            {score} · {levelLabel}
          </span>
          <span className="text-2xs text-content-muted">Score = Probability × Impact</span>
        </div>
      </form>
    </Modal>
  );
}

