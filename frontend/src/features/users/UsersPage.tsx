import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users as UsersIcon, Plus, Search, Pencil, KeyRound, Power, ChevronLeft, ChevronRight } from "lucide-react";
import {
  fetchUsers,
  userKeys,
  useCreateUser,
  useUpdateUser,
  useResetUserPassword,
  useSetUserStatus,
  type UserRow,
  type RoleName,
} from "./api";
import { fetchRefs, riskKeys } from "@/features/risks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { getErrorMessage } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const roleLabels: Record<RoleName, string> = {
  MR: "Manajemen Risiko",
  RISK_OFFICER: "Risk Officer",
  RISK_OWNER: "Risk Owner",
};

const roleVariant: Record<RoleName, "primary" | "warning" | "default"> = {
  MR: "primary",
  RISK_OFFICER: "warning",
  RISK_OWNER: "default",
};

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [role, setRole] = useState("");
  const [branchId, setBranchId] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [statusUser, setStatusUser] = useState<UserRow | null>(null);

  const refs = useQuery({ queryKey: riskKeys.refs, queryFn: fetchRefs, staleTime: 5 * 60_000 });
  const params = useMemo(
    () => ({
      q: qDebounced || undefined,
      role: role || undefined,
      branchId: branchId || undefined,
      active: active || undefined,
      page,
      pageSize: 10,
    }),
    [qDebounced, role, branchId, active, page],
  );
  const list = useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => fetchUsers(params),
    placeholderData: (prev) => prev,
  });

  const create = useCreateUser();
  const update = useUpdateUser();
  const reset = useResetUserPassword();
  const setStatus = useSetUserStatus();

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
        title="User Management"
        description="Kelola akun pengguna, peran, dan penugasan branch"
        icon={UsersIcon}
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Pengguna Baru
          </Button>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-end gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
            <Input placeholder="Cari nama / username / email..." aria-label="Pencarian pengguna" className="pl-8" value={q} onChange={(e) => onSearch(e.target.value)} />
          </div>
          <div className="w-full sm:w-44">
            <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Filter role">
              <option value="">Semua Role</option>
              <option value="MR">Manajemen Risiko</option>
              <option value="RISK_OFFICER">Risk Officer</option>
              <option value="RISK_OWNER">Risk Owner</option>
            </Select>
          </div>
          <div className="w-full sm:w-44">
            <Select value={branchId} onChange={(e) => { setBranchId(e.target.value); setPage(1); }} aria-label="Filter branch">
              <option value="">Semua Branch</option>
              {(refs.data?.branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
            </Select>
          </div>
          <div className="w-full sm:w-40">
            <Select value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} aria-label="Filter status">
              <option value="">Semua Status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </Select>
          </div>
          <p className="ml-auto text-xs text-content-secondary">Total: <strong className="text-content-primary">{meta?.total ?? 0}</strong></p>
        </CardBody>
      </Card>

      {list.isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : list.isError ? (
        <Card><ErrorState message="Data pengguna gagal dimuat" onRetry={() => void list.refetch()} /></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={UsersIcon} title="Tidak ada pengguna" description="Belum ada pengguna sesuai filter." /></Card>
      ) : (
        <Card>
          <CardHeader title="Daftar Pengguna" subtitle="Akun dengan akses ke sistem" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-left text-content-secondary">
                  <th className="px-3 py-2 font-medium">Pengguna</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Branch</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Login Terakhir</th>
                  <th className="px-3 py-2 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-content-primary">{row.fullName}</p>
                      <p className="text-2xs text-content-secondary">@{row.username} · {row.email}</p>
                    </td>
                    <td className="px-3 py-2.5"><Badge variant={roleVariant[row.role.name]}>{roleLabels[row.role.name]}</Badge></td>
                    <td className="px-3 py-2.5 text-content-secondary">{row.branch ? `${row.branch.code} — ${row.branch.name}` : "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={row.isActive ? "success" : "danger"}>{row.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      {row.mustChangePassword && <p className="mt-1 text-2xs text-warning">Wajib ganti password</p>}
                    </td>
                    <td className="px-3 py-2.5 text-content-secondary">
                      {row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString("id-ID") : "Belum pernah"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" variant="secondary" title="Edit" onClick={() => { setEditing(row); setFormOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="secondary" title="Reset password" onClick={() => { setResetUser(row); setResetResult(null); }}>
                          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        {row.id !== currentUser?.id && (
                          <Button
                            size="sm"
                            variant={row.isActive ? "danger-outline" : "secondary"}
                            title={row.isActive ? "Nonaktifkan" : "Aktifkan"}
                            onClick={() => setStatusUser(row)}
                          >
                            <Power className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </td>
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

      {formOpen && (
        <UserFormModal
          user={editing}
          branches={refs.data?.branches ?? []}
          loading={create.isPending || update.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => {
            if (editing) {
              update.mutate(
                { id: editing.id, body: { ...values, password: undefined } },
                {
                  onSuccess: () => { toast.success("Pengguna diperbarui"); setFormOpen(false); },
                  onError: (err) => toast.error("Gagal memperbarui", getErrorMessage(err)),
                },
              );
            } else {
              create.mutate(values, {
                onSuccess: () => { toast.success("Pengguna dibuat", "Password awal wajib diganti saat login"); setFormOpen(false); },
                onError: (err) => toast.error("Gagal membuat pengguna", getErrorMessage(err)),
              });
            }
          }}
        />
      )}

      <Modal
        open={!!resetUser}
        onClose={() => { setResetUser(null); setResetResult(null); }}
        title={`Reset password ${resetUser?.fullName ?? ""}?`}
        description="Password baru akan dibuat otomatis dan wajib diganti saat login berikutnya."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setResetUser(null); setResetResult(null); }}>Tutup</Button>
            {!resetResult && (
              <Button
                size="sm"
                loading={reset.isPending}
                onClick={() =>
                  resetUser &&
                  reset.mutate(resetUser.id, {
                    onSuccess: (data) => setResetResult(data.temporaryPassword),
                    onError: (err) => toast.error("Gagal reset password", getErrorMessage(err)),
                  })
                }
              >
                Reset Sekarang
              </Button>
            )}
          </>
        }
      >
        {resetResult ? (
          <div className="rounded border border-success/30 bg-success-50 px-3 py-2.5">
            <p className="text-2xs font-medium text-success">Password sementara</p>
            <p className="mt-1 select-all font-mono text-sm font-semibold text-content-primary">{resetResult}</p>
            <p className="mt-1 text-2xs text-content-secondary">Sampaikan kepada pengguna secara aman.</p>
          </div>
        ) : (
          <p className="text-sm text-content-secondary">Tindakan ini akan mengganti password pengguna.</p>
        )}
      </Modal>

      <ConfirmDialog
        open={!!statusUser}
        onClose={() => setStatusUser(null)}
        onConfirm={() =>
          statusUser &&
          setStatus.mutate(
            { id: statusUser.id, isActive: !statusUser.isActive },
            {
              onSuccess: () => {
                toast.success(statusUser.isActive ? "Pengguna dinonaktifkan" : "Pengguna diaktifkan");
                setStatusUser(null);
              },
              onError: (err) => toast.error("Gagal mengubah status", getErrorMessage(err)),
            },
          )
        }
        title={statusUser?.isActive ? "Nonaktifkan pengguna?" : "Aktifkan pengguna?"}
        message={statusUser ? `${statusUser.fullName} akan ${statusUser.isActive ? "kehilangan" : "mendapatkan kembali"} akses ke sistem.` : ""}
        confirmLabel={statusUser?.isActive ? "Ya, nonaktifkan" : "Ya, aktifkan"}
        confirmVariant={statusUser?.isActive ? "danger" : "primary"}
        loading={setStatus.isPending}
      />
    </div>
  );
}

const baseSchema = z
  .object({
    username: z.string().min(3, "Minimal 3 karakter").max(50).regex(/^[a-zA-Z0-9._-]+$/, "Format username tidak valid"),
    email: z.string().email("Email tidak valid"),
    fullName: z.string().min(3, "Minimal 3 karakter").max(120),
    role: z.enum(["MR", "RISK_OFFICER", "RISK_OWNER"]),
    branchId: z.string().optional(),
    password: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.role !== "MR" && !val.branchId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["branchId"], message: "Branch wajib dipilih" });
    }
  });

type UserForm = z.infer<typeof baseSchema>;

function UserFormModal({
  user,
  branches,
  loading,
  onClose,
  onSubmit,
}: {
  user: UserRow | null;
  branches: { id: string; code?: string; name: string }[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: UserForm) => void;
}) {
  const isEdit = !!user;
  const schema = useMemo(
    () =>
      baseSchema.superRefine((val, ctx) => {
        if (!isEdit && (!val.password || val.password.length < 8)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "Password minimal 8 karakter" });
        }
      }),
    [isEdit],
  );

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<UserForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: user?.username ?? "",
      email: user?.email ?? "",
      fullName: user?.fullName ?? "",
      role: user?.role.name ?? "RISK_OWNER",
      branchId: user?.branch?.id ?? "",
      password: "",
    },
  });

  const role = watch("role");

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit ${user?.fullName}` : "Pengguna Baru"}
      description={isEdit ? "Perbarui data akun dan penugasan" : "Buat akun baru dengan password awal"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Batal</Button>
          <Button size="sm" loading={loading} onClick={handleSubmit(onSubmit)}>Simpan</Button>
        </>
      }
    >
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void handleSubmit(onSubmit)(e); }} noValidate>
        <div>
          <Label htmlFor="us-fullname" required>Nama Lengkap</Label>
          <Input id="us-fullname" {...register("fullName")} aria-invalid={!!errors.fullName} />
          <FieldError message={errors.fullName?.message} />
        </div>
        <div>
          <Label htmlFor="us-username" required>Username</Label>
          <Input id="us-username" {...register("username")} aria-invalid={!!errors.username} />
          <FieldError message={errors.username?.message} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="us-email" required>Email</Label>
          <Input id="us-email" type="email" {...register("email")} aria-invalid={!!errors.email} />
          <FieldError message={errors.email?.message} />
        </div>
        <div>
          <Label htmlFor="us-role" required>Role</Label>
          <Select
            id="us-role"
            {...register("role", { onChange: (e) => { if (e.target.value === "MR") setValue("branchId", ""); } })}
          >
            <option value="MR">Manajemen Risiko</option>
            <option value="RISK_OFFICER">Risk Officer</option>
            <option value="RISK_OWNER">Risk Owner</option>
          </Select>
          <FieldError message={errors.role?.message} />
        </div>
        <div>
          <Label htmlFor="us-branch" required={role !== "MR"}>Branch</Label>
          <Select id="us-branch" {...register("branchId")} disabled={role === "MR"} aria-invalid={!!errors.branchId}>
            <option value="">{role === "MR" ? "Tidak terikat branch" : "Pilih branch..."}</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.code ? `${b.code} — ` : ""}{b.name}</option>)}
          </Select>
          <FieldError message={errors.branchId?.message} />
        </div>
        {!isEdit && (
          <div className="sm:col-span-2">
            <Label htmlFor="us-password" required>Password Awal</Label>
            <Input id="us-password" type="password" autoComplete="new-password" {...register("password")} aria-invalid={!!errors.password} />
            <FieldError message={errors.password?.message} />
            <p className="mt-1 text-2xs text-content-muted">Minimal 8 karakter. Pengguna wajib mengganti saat login pertama.</p>
          </div>
        )}
      </form>
    </Modal>
  );
}
