import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuth } from "@/contexts/AuthContext";
import { navItemByPath } from "@/config/navigation";
import { cn } from "@/lib/utils";

function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | JXB-MR`;
  }, [title]);
}

export function AppLayout() {
  const { user, can } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Tutup drawer mobile saat pindah halaman
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const nav = navItemByPath(location.pathname);
  const title = nav ? nav.label : "Dashboard";
  useDocumentTitle(title);

  const canFn = (p?: string) => !p || can(p);

  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar
        user={{ role: user!.role, fullName: user!.fullName, branchName: user!.branch?.name ?? null }}
        can={canFn}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className={cn("flex min-w-0 flex-1 flex-col")}>
        <Topbar
          title={title}
          crumbItems={[{ label: "Beranda", to: "/" }, ...(nav && nav.path !== "/" ? [{ label: nav.label }] : [])]}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="flex-1 px-3 py-4 sm:px-5 sm:py-5 min-w-0">
          <Outlet />
        </main>
        <footer className="border-t border-border px-4 py-2.5 text-2xs text-content-muted">
          JXB-MR · Enterprise Risk Management System © {new Date().getFullYear()} Jakarta Experience Board
        </footer>
      </div>
    </div>
  );
}
