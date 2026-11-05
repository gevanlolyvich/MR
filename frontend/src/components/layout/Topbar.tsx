import { Link, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, LogOut, Menu, RotateCcw, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Breadcrumb } from "./Breadcrumb";
import { Dropdown, DropdownDivider, DropdownItem } from "@/components/ui/Dropdown";
import { useAuth, type RoleName } from "@/contexts/AuthContext";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/features/notifications/api";
import { cn } from "@/lib/utils";

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
  const navigate = useNavigate();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const unread = notifications.data?.unread ?? 0;
  const items = notifications.data?.data ?? [];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-white px-3 sm:px-5">
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
      <Dropdown
        className="shrink-0"
        trigger={
          <span
            className="relative grid h-9 w-9 place-items-center rounded text-content-secondary hover:bg-slate-100 hover:text-content-primary"
            aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : " (tidak ada)"}`}
            title="Notifikasi"
          >
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </span>
        }
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-xs font-semibold text-content-primary">Notifikasi</p>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="inline-flex items-center gap-1 text-2xs font-medium text-primary-600 hover:underline"
            >
              <CheckCheck className="h-3 w-3" aria-hidden="true" />
              Tandai semua
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-content-secondary">Belum ada notifikasi</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.isRead) markRead.mutate(n.id);
                  if (n.link) {
                    navigate(n.link);
                  }
                }}
                className={cn(
                  "block w-full border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-slate-50",
                  !n.isRead && "bg-primary-50/50",
                )}
              >
                <div className="flex items-start gap-2">
                  <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-primary-500")} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-content-primary">{n.title}</p>
                    <p className="mt-0.5 text-2xs text-content-secondary leading-snug line-clamp-2">{n.message}</p>
                    <p className="mt-1 text-[10px] text-content-muted">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: idLocale })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </Dropdown>

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
