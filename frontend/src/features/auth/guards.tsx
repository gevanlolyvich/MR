import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";

export function AuthSplash() {
  return (
    <div className="min-h-screen grid place-items-center bg-page px-4">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <Logo variant="full" />
        <p className="text-xs text-content-secondary">Memuat sistem...</p>
      </div>
    </div>
  );
}

export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthSplash />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}

export function RedirectIfAuthed() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthSplash />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}
