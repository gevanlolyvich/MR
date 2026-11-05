import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/features/auth/LoginPage";
import { ChangePasswordPage } from "@/features/auth/ChangePasswordPage";
import { RedirectIfAuthed, RequireAuth } from "@/features/auth/guards";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { RisksPage } from "@/features/risks/RisksPage";
import { RiskDetailPage } from "@/features/risks/RiskDetailPage";
import { MatrixPage } from "@/features/risks/MatrixPage";
import { ApprovalPage } from "@/features/approvals/ApprovalPage";
import { MitigationPage } from "@/features/mitigations/MitigationPage";
import { MonitoringPage } from "@/features/monitoring/MonitoringPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { UsersPage } from "@/features/users/UsersPage";
import { BranchesPage } from "@/features/branches/BranchesPage";
import { MasterDataPage } from "@/features/master-data/MasterDataPage";
import { AuditPage } from "@/features/audit/AuditPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
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
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/risks" element={<RisksPage />} />
          <Route path="/risks/:id" element={<RiskDetailPage />} />
          <Route path="/matrix" element={<MatrixPage />} />
          <Route path="/mitigations" element={<MitigationPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/approvals" element={<ApprovalPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/master-data" element={<MasterDataPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ModulePlaceholder modulKey="/profile" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
