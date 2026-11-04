import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, FieldError, Label } from "@/components/ui/Input";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useState } from "react";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
    newPassword: z.string().min(8, "Password minimal 8 karakter"),
    confirm: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ["confirm"],
    message: "Konfirmasi password tidak cocok",
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordPage() {
  const { refetchUser } = useAuth();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await api.post("/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success("Password diubah", "Password Anda berhasil diperbarui");
      refetchUser();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-page grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-5 text-center">
          <Logo variant="full" className="justify-center" />
        </div>
        <div className="rounded-card bg-white border border-border shadow-card p-6">
          <h1 className="text-sm font-semibold text-content-primary">Ubah Password</h1>
          <p className="mt-0.5 text-xs text-content-secondary">
            Password Anda harus diganti sebelum melanjutkan
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
            {error && (
              <div role="alert" className="rounded border border-danger/30 bg-danger-50 px-3 py-2.5 text-xs text-danger">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="currentPassword" required>Password saat ini</Label>
              <Input id="currentPassword" type="password" autoComplete="current-password" {...register("currentPassword")} />
              <FieldError message={errors.currentPassword?.message} />
            </div>
            <div>
              <Label htmlFor="newPassword" required>Password baru</Label>
              <Input id="newPassword" type="password" autoComplete="new-password" {...register("newPassword")} />
              <FieldError message={errors.newPassword?.message} />
            </div>
            <div>
              <Label htmlFor="confirm" required>Konfirmasi password baru</Label>
              <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} />
              <FieldError message={errors.confirm?.message} />
            </div>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Simpan Password Baru
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
