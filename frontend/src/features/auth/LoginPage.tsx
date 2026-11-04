import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, FieldError, Label } from "@/components/ui/Input";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const schema = z.object({
  username: z.string().min(1, "Username atau email wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await login(values.username, values.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy flex items-center justify-center px-4 py-8">
      {/* Aksen geometris JXB: bar merah + diagonal kuning & biru, secukupnya */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-1.5 w-[140%] -translate-x-1/2 rotate-[-3deg] bg-corporate-red opacity-90" />
        <div className="absolute -left-24 bottom-[-40px] h-40 w-2.5 rotate-45 bg-corporate-yellow opacity-80" />
        <div className="absolute right-[-30px] top-1/4 h-64 w-2.5 -rotate-45 bg-[#2E4D9E] opacity-70" />
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-navy-900/60" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Identitas di atas card */}
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 inline-block rounded-lg bg-white p-3 shadow-dropdown">
            <Logo variant="full" theme="dark" className="h-14 w-auto justify-center" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">JXB-MR</h1>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
            Enterprise Risk Management System
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-card bg-white border border-white/10 shadow-dropdown p-6">
          <h2 className="text-sm font-semibold text-content-primary">Masuk ke akun Anda</h2>
          <p className="mt-0.5 text-xs text-content-secondary">Gunakan username atau email kantor</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
            {error && (
              <div role="alert" className="rounded border border-danger/30 bg-danger-50 px-3 py-2.5 text-xs text-danger animate-fade">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="username" required>Username / Email</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted">
                  <UserIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="username atau nama@jxb.co.id"
                  className="pl-9"
                  aria-invalid={!!errors.username}
                  {...register("username")}
                />
              </div>
              <FieldError message={errors.username?.message} />
            </div>

            <div>
              <Label htmlFor="password" required>Password</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </span>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded text-content-muted hover:bg-slate-100 hover:text-content-primary"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <FieldError message={errors.password?.message} />
            </div>

            <Button type="submit" className="w-full" loading={isSubmitting} size="lg">
              {isSubmitting ? "Memverifikasi..." : "Masuk"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-2xs text-white/40">
          © {new Date().getFullYear()} Jakarta Experience Board · Manajemen Risiko
        </p>
      </div>
    </div>
  );
}
