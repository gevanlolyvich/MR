import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { navItemByPath } from "@/config/navigation";

/** Placeholder modul - diganti saat modul diimplementasikan. */
export function ModulePlaceholder({ modulKey }: { modulKey: string }) {
  const nav = navItemByPath(modulKey);
  return (
    <div>
      <PageHeader
        title={nav?.label ?? "Modul"}
        description="Modul ini sedang dalam tahap implementasi dan akan tersedia pada iterasi berikutnya."
      />
      <Card>
        <EmptyState
          icon={Inbox}
          title="Belum tersedia"
          description="Konten modul ini sedang dikerjakan. Silakan kembali di kemudian iterasi."
        />
      </Card>
    </div>
  );
}
