import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, LogOut, Menu, RotateCcw, User } from "lucide-react";
import { Breadcrumb } from "./Breadcrumb";
import { Dropdown, DropdownDivider, DropdownItem } from "@/components/ui/Dropdown";
import { useAuth, type RoleName } from "@/contexts/AuthContext";

interface TopbarProps {
  title: string;
  crumbItems: { label: string; to?: string }[];
  onOpenMobile: () => void;
}

const roleLabels: Record<RoleName, string> = {
  MR: "Manajemen Risiko",
  RISK_OFFICER: "Risk Officer",
  RISK_OWNER: "Risk Owner",
};

export function Topbar({ title, crumbItems, onOpenMobile }: TopbarProps) {
  const { user, logout } = useAuth();
  const [unread, _setUnread] = useState(0);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-white px-3 sm:px-5">
      {/* Mobile: tombol menu */}
      <button
        onClick={onOpenMobile}
        aria-label="Buka menu navigasi"
        className="grid h-9 w-9 shrink-0 place-items-center rounded text-content-primary hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <Breadcrumb items={crumbItems} />
        <h1 className="truncate text-[15px] font-semibold text-content-primary leading-tight">{title}</h1>
      </div>

      {/* Notification */}
      <button
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded text-content-secondary hover:bg-slate-100 hover:text-content-primary"
        aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : " (tidak ada)"}`}
        title="Notifikasi"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
        )}
      </button>

      {/* Profile */}
      <Dropdown
        trigger={
          <span className="flex items-center gap-2 rounded px-1.5 py-1.5 hover:bg-slate-100">
            <span className="hidden min-w-0 text-right sm:block">
              <span className="block max-w-[160px] truncate text-xs font-semibold text-content-primary leading-tight">
                {user?.fullName}
              </span>
              <span className="block text-2xs text-content-secondary leading-tight">
                {user?.role ? roleLabels[user.role] : ""}
                {user?.branch ? ` · ${user.branch.code}` : ""}
              </span>
            </span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-[11px] font-semibold text-white">
              {(user?.fullName ?? "?")
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
          </span>
        }
      >
      <DropdownItem icon={<User className="h-4 w-4" aria-hidden="true" />}>
          <Link to="/profile" className="block w-full">
            Profil Saya
          </Link>
        </DropdownItem>
        <DropdownItem icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
          <Link to="/profile" className="block w-full">
            Ubah Password
          </Link>
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem icon={<LogOut className="h-4 w-4" aria-hidden="true" />} danger onClick={() => void logout()}>
          Logout
        </DropdownItem>
      </Dropdown>
    </header>
  );
}

export { roleLabels };
