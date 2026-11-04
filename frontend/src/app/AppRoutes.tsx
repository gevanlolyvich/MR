import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/features/auth/LoginPage";
import { ChangePasswordPage } from "@/features/auth/ChangePasswordPage";
import { RedirectIfAuthed, RequireAuth } from "@/features/auth/guards";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export function AppRoutes() {
  return (
    <Routes>
      {/* Redirect /login saat sudah login */}
      <Route element={<RedirectIfAuthed />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route
        element={<RequireAuth />}
        // Rute terproteksi + layout shell
      >
        {/* Halaman khusus: ubah password wajib */}
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ModulePlaceholder modulKey="/" />} />
          <Route path="/risks" element={<ModulePlaceholder modulKey="/risks" />} />
          <Route path="/risks/:id" element={<ModulePlaceholder modulKey="/risks" />} />
          <Route path="/matrix" element={<ModulePlaceholder modulKey="/matrix" />} />
          <Route path="/mitigations" element={<ModulePlaceholder modulKey="/mitigations" />} />
          <Route path="/monitoring" element={<ModulePlaceholder modulKey="/monitoring" />} />
          <Route path="/approvals" element={<ModulePlaceholder modulKey="/approvals" />} />
          <Route path="/reports" element={<ModulePlaceholder modulKey="/reports" />} />
          <Route path="/users" element={<ModulePlaceholder modulKey="/users" />} />
          <Route path="/branches" element={<ModulePlaceholder modulKey="/branches" />} />
          <Route path="/master-data" element={<ModulePlaceholder modulKey="/master-data" />} />
          <Route path="/audit" element={<ModulePlaceholder modulKey="/audit" />} />
          <Route path="/settings" element={<ModulePlaceholder modulKey="/settings" />} />
          <Route path="/profile" element={<ModulePlaceholder modulKey="/profile" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
