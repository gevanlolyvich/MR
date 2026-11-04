import { NavLink } from "react-router-dom";
import { ChevronLeft, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { visibleNav } from "@/config/navigation";
import type { RoleName } from "@/contexts/AuthContext";

const roleLabels: Record<RoleName, string> = {
  MR: "Manajemen Risiko",
  RISK_OFFICER: "Risk Officer",
  RISK_OWNER: "Risk Owner",
};

interface SidebarProps {
  user: { role: RoleName; fullName: string; branchName?: string | null } | null;
  can: (p?: string) => boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function NavItemComp({
  to,
  icon: Icon,
  label,
  collapsed,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded px-3 py-2 text-[13px] font-medium transition-colors",
          "min-h-[40px] whitespace-nowrap",
          isActive
            ? "bg-primary-500 text-white"
            : "text-slate-300 hover:bg-white/10 hover:text-white",
          collapsed && "px-2.5 justify-center",
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate flex-1 text-left">{label}</span>}
    </NavLink>
  );
}

export function Sidebar({
  user,
  can,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const groups = visibleNav(can);

  return (
    <>
      {/* Overlay mobile */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-navy/60 transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed z-50 inset-y-0 left-0 flex flex-col bg-navy text-white",
          "transition-transform duration-200 lg:translate-x-0 lg:static lg:shrink-0",
          "w-[272px] lg:w-[264px]",
          !mobileOpen && "-translate-x-full lg:translate-x-0",
        )}
        aria-label="Navigasi utama"
      >
        {/* Header */}
        <div className={cn("flex items-center gap-2.5 px-4 h-14 shrink-0 border-b border-white/10")}>
          {mobileOpen && (
            <button
              onClick={onCloseMobile}
              aria-label="Tutup menu navigasi"
              className="ml-auto lg:hidden rounded p-1.5 text-white/70 hover:bg-white/10"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="px-4 py-4 shrink-0 border-b border-white/10 flex items-center justify-between">
          <Logo variant="mark" theme="light" withTitle />
          {!mobileOpen ? null : null}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-4 sidebar-scroll">
          {groups.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  {group.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.path}>
                    <NavItemComp to={item.path} icon={item.icon} label={item.label} collapsed={collapsed} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer user */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
            <div className="shrink-0 grid h-8 w-8 place-items-center rounded-full bg-primary-500 text-xs font-semibold text-white">
              {(user?.fullName ?? "?")
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white">{user?.fullName}</p>
                <p className="truncate text-2xs text-white/50">{user ? roleLabels[user.role] : ""}</p>
              </div>
            )}
          </div>
          {(collapsed || !mobileOpen) && (
            <button
              onClick={onToggleCollapsed}
              className={cn(
                "mt-2 hidden lg:flex w-full items-center justify-center gap-1.5 rounded px-2 py-1.5 text-2xs text-white/60 hover:bg-white/10 hover:text-white transition-colors",
              )}
              aria-label={collapsed ? "Perbesar sidebar" : "Perkecil sidebar"}
            >
              <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform", collapsed && "rotate-180")} aria-hidden="true" />
              {!collapsed && "Perkecil"}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
