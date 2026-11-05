import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus, Search, Pencil, Power } from "lucide-react";
import {
  fetchBranches,
  branchKeys,
  useCreateBranch,
  useUpdateBranch,
  useSetBranchStatus,
  type BranchRow,
} from "./api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useToast } from "@/contexts/ToastContext";
import { getErrorMessage } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export function BranchesPage() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [statusRow, setStatusRow] = useState<BranchRow | null>(null);

  const params = useMemo(() => ({ q: q || undefined, active: active || undefined }), [q, active]);
  const list = useQuery({ queryKey: branchKeys.list(params), queryFn: () => fetchBranches(params) });
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const setStatus = useSetBranchStatus();

  const rows = list.data?.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Branch Management"
        description="Kelola unit branch perusahaan sebagai cakupan data risiko"
        icon={Building2}
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Branch Baru
          </Button>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-end gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
            <Input placeholder="Cari kode / nama branch..." aria-label="Pencarian branch" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="w-full sm:w-44">
            <Select value={active} onChange={(e) => setActive(e.target.value)} aria-label="Filter status">
              <option value="">Semua Status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </Select>
          </div>
          <p className="ml-auto text-xs text-content-secondary">Total: <strong className="text-content-primary">{rows.length}</strong></p>
        </CardBody>
      </Card>

      {list.isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : list.isError ? (
        <Card><ErrorState message="Data branch gagal dimuat" onRetry={() => void list.refetch()} /></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Building2} title="Tidak ada branch" description="Belum ada branch sesuai filter." /></Card>
      ) : (
        <Card>
          <CardHeader title="Daftar Branch" subtitle="Setiap risiko terikat pada satu branch" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-left text-content-secondary">
                  <th className="px-3 py-2 font-medium">Kode</th>
                  <th className="px-3 py-2 font-medium">Nama Branch</th>
                  <th className="px-3 py-2 font-medium">Deskripsi</th>
                  <th className="px-3 py-2 font-medium">Pengguna</th>
                  <th className="px-3 py-2 font-medium">Risiko</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 font-semibold text-content-primary">{row.code}</td>
                    <td className="px-3 py-2.5 text-content-primary">{row.name}</td>
                    <td className="px-3 py-2.5 max-w-[260px] truncate text-content-secondary">{row.description ?? "—"}</td>
                    <td className="px-3 py-2.5 text-content-secondary">{row._count.users}</td>
                    <td className="px-3 py-2.5 text-content-secondary">{row._count.risks}</td>
                    <td className="px-3 py-2.5"><Badge variant={row.isActive ? "success" : "danger"}>{row.isActive ? "Aktif" : "Nonaktif"}</Badge></td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" title="Edit" onClick={() => { setEditing(row); setFormOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant={row.isActive ? "danger-outline" : "secondary"} title={row.isActive ? "Nonaktifkan" : "Aktifkan"} onClick={() => setStatusRow(row)}>
                          <Power className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {formOpen && (
        <BranchFormModal
          branch={editing}
          loading={create.isPending || update.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => {
            if (editing) {
              update.mutate(
                { id: editing.id, body: values },
                {
                  onSuccess: () => { toast.success("Branch diperbarui"); setFormOpen(false); },
                  onError: (err) => toast.error("Gagal memperbarui branch", getErrorMessage(err)),
                },
              );
            } else {
              create.mutate(values, {
                onSuccess: () => { toast.success("Branch dibuat"); setFormOpen(false); },
                onError: (err) => toast.error("Gagal membuat branch", getErrorMessage(err)),
              });
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!statusRow}
        onClose={() => setStatusRow(null)}
        onConfirm={() =>
          statusRow &&
          setStatus.mutate(
            { id: statusRow.id, isActive: !statusRow.isActive },
            {
              onSuccess: () => { toast.success("Status branch diperbarui"); setStatusRow(null); },
              onError: (err) => toast.error("Gagal mengubah status", getErrorMessage(err)),
            },
          )
        }
        title={statusRow?.isActive ? "Nonaktifkan branch?" : "Aktifkan branch?"}
        message={statusRow ? `Branch ${statusRow.code} — ${statusRow.name} akan ${statusRow.isActive ? "dinonaktifkan" : "diaktifkan"}.` : ""}
        confirmLabel={statusRow?.isActive ? "Ya, nonaktifkan" : "Ya, aktifkan"}
        confirmVariant={statusRow?.isActive ? "danger" : "primary"}
        loading={setStatus.isPending}
      />
    </div>
  );
}

const branchSchema = z.object({
  code: z.string().min(2, "Minimal 2 karakter").max(20).regex(/^[A-Za-z0-9-]+$/, "Format kode tidak valid"),
  name: z.string().min(3, "Minimal 3 karakter").max(120),
  description: z.string().max(500).optional(),
});
type BranchForm = z.infer<typeof branchSchema>;

function BranchFormModal({
  branch,
  loading,
  onClose,
  onSubmit,
}: {
  branch: BranchRow | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: BranchForm) => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<BranchForm>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      code: branch?.code ?? "",
      name: branch?.name ?? "",
      description: branch?.description ?? "",
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={branch ? `Edit ${branch.code}` : "Branch Baru"}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Batal</Button>
          <Button size="sm" loading={loading} onClick={handleSubmit(onSubmit)}>Simpan</Button>
        </>
      }
    >
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void handleSubmit(onSubmit)(e); }} noValidate>
        <div>
          <Label htmlFor="br-code" required>Kode Branch</Label>
          <Input id="br-code" {...register("code")} aria-invalid={!!errors.code} placeholder="BRC01" />
          <FieldError message={errors.code?.message} />
        </div>
        <div>
          <Label htmlFor="br-name" required>Nama Branch</Label>
          <Input id="br-name" {...register("name")} aria-invalid={!!errors.name} placeholder="Branch Cikarang 01" />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="br-desc">Deskripsi</Label>
          <Textarea id="br-desc" rows={3} {...register("description")} />
        </div>
      </form>
    </Modal>
  );
}
