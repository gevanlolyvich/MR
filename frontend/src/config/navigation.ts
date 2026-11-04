import {
  LayoutDashboard,
  ClipboardList,
  ClipboardCheck,
  Grid3x3,
  ShieldCheck,
  Activity,
  FileSignature,
  BarChart3,
  Users,
  Building2,
  Database,
  ScrollText,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Panel utama (risiko) */
const mainGroup: NavGroup = {
  title: "Manajemen Risiko",
  items: [
    { path: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
    { path: "/risks", label: "Risk Register", icon: ClipboardList, permission: "risk:view" },
    { path: "/matrix", label: "Risk Matrix", icon: Grid3x3, permission: "matrix:view" },
    { path: "/mitigations", label: "Mitigation Plan", icon: ShieldCheck, permission: "mitigation:manage" },
    { path: "/monitoring", label: "Monitoring", icon: Activity, permission: "monitoring:view" },
    { path: "/approvals", label: "Approval", icon: FileSignature, permission: "risk:review" },
    { path: "/reports", label: "Reporting", icon: BarChart3, permission: "reporting:view" },
  ],
};

/** Panel administrasi (khusus MR) */
const adminGroup: NavGroup = {
  title: "Administrasi",
  items: [
    { path: "/users", label: "User Management", icon: Users, permission: "user:manage" },
    { path: "/branches", label: "Branch Management", icon: Building2, permission: "branch:manage" },
    { path: "/master-data", label: "Master Data", icon: Database, permission: "category:manage" },
    { path: "/audit", label: "Audit Log", icon: ScrollText, permission: "audit:view" },
    { path: "/settings", label: "Settings", icon: Settings, permission: "settings:manage" },
  ],
};

export interface PermissionChecker {
  (permission?: string): boolean;
}

export function visibleNav(can: PermissionChecker): NavGroup[] {
  const filter = (g: NavGroup): NavGroup => ({
    ...g,
    items: g.items.filter((i) => !i.permission || can(i.permission)),
  });
  return [filter(mainGroup), filter(adminGroup)].filter((g) => g.items.length > 0);
}

export const navItemByPath = (path: string): NavItem | undefined =>
  [...mainGroup.items, ...adminGroup.items].find(
    (i) => path === i.path || (path.startsWith(i.path) && i.path !== "/" && i.path.length > 1),
  );

export const navIcons = { ClipboardCheck };
