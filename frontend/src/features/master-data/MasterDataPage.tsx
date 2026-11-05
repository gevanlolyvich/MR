import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Plus, Search, Pencil, Power } from "lucide-react";
import {
  fetchCategories,
  categoryKeys,
  useCreateCategory,
  useUpdateCategory,
  useSetCategoryStatus,
  type CategoryRow,
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

export function MasterDataPage() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [statusRow, setStatusRow] = useState<CategoryRow | null>(null);

  const params = useMemo(() => ({ q: q || undefined, active: active || undefined }), [q, active]);
  const list = useQuery({ queryKey: categoryKeys.list(params), queryFn: () => fetchCategories(params) });
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const setStatus = useSetCategoryStatus();

  const rows = list.data?.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Master Data"
        description="Kelola kategori risiko yang digunakan pada register risiko"
        icon={Database}
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Kategori Baru
          </Button>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-end gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
            <Input placeholder="Cari kode / nama kategori..." aria-label="Pencarian kategori" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
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
        <Card><ErrorState message="Data kategori gagal dimuat" onRetry={() => void list.refetch()} /></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Database} title="Tidak ada kategori" description="Belum ada kategori sesuai filter." /></Card>
      ) : (
        <Card>
          <CardHeader title="Kategori Risiko" subtitle="Taksonomi risiko perusahaan" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-left text-content-secondary">
                  <th className="px-3 py-2 font-medium">Kode</th>
                  <th className="px-3 py-2 font-medium">Nama Kategori</th>
                  <th className="px-3 py-2 font-medium">Deskripsi</th>
                  <th className="px-3 py-2 font-medium">Jumlah Risiko</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 font-semibold text-content-primary">{row.code}</td>
                    <td className="px-3 py-2.5 text-content-primary">{row.name}</td>
                    <td className="px-3 py-2.5 max-w-[320px] truncate text-content-secondary">{row.description ?? "—"}</td>
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
        <CategoryFormModal
          category={editing}
          loading={create.isPending || update.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => {
            if (editing) {
              update.mutate(
                { id: editing.id, body: values },
                {
                  onSuccess: () => { toast.success("Kategori diperbarui"); setFormOpen(false); },
                  onError: (err) => toast.error("Gagal memperbarui kategori", getErrorMessage(err)),
                },
              );
            } else {
              create.mutate(values, {
                onSuccess: () => { toast.success("Kategori dibuat"); setFormOpen(false); },
                onError: (err) => toast.error("Gagal membuat kategori", getErrorMessage(err)),
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
              onSuccess: () => { toast.success("Status kategori diperbarui"); setStatusRow(null); },
              onError: (err) => toast.error("Gagal mengubah status", getErrorMessage(err)),
            },
          )
        }
        title={statusRow?.isActive ? "Nonaktifkan kategori?" : "Aktifkan kategori?"}
        message={statusRow ? `Kategori ${statusRow.code} — ${statusRow.name} akan ${statusRow.isActive ? "dinonaktifkan" : "diaktifkan"}.` : ""}
        confirmLabel={statusRow?.isActive ? "Ya, nonaktifkan" : "Ya, aktifkan"}
        confirmVariant={statusRow?.isActive ? "danger" : "primary"}
        loading={setStatus.isPending}
      />
    </div>
  );
}

const categorySchema = z.object({
  code: z.string().min(2, "Minimal 2 karakter").max(20).regex(/^[A-Za-z0-9-]+$/, "Format kode tidak valid"),
  name: z.string().min(3, "Minimal 3 karakter").max(120),
  description: z.string().max(500).optional(),
});
type CategoryForm = z.infer<typeof categorySchema>;

function CategoryFormModal({
  category,
  loading,
  onClose,
  onSubmit,
}: {
  category: CategoryRow | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: CategoryForm) => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      code: category?.code ?? "",
      name: category?.name ?? "",
      description: category?.description ?? "",
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? `Edit ${category.code}` : "Kategori Baru"}
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
          <Label htmlFor="ct-code" required>Kode Kategori</Label>
          <Input id="ct-code" {...register("code")} aria-invalid={!!errors.code} placeholder="OPS" />
          <FieldError message={errors.code?.message} />
        </div>
        <div>
          <Label htmlFor="ct-name" required>Nama Kategori</Label>
          <Input id="ct-name" {...register("name")} aria-invalid={!!errors.name} placeholder="Operasional" />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="ct-desc">Deskripsi</Label>
          <Textarea id="ct-desc" rows={3} {...register("description")} />
        </div>
      </form>
    </Modal>
  );
}
