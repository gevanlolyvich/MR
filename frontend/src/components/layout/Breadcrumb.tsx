import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0 overflow-x-auto no-scrollbar", className)}>
      <ol className="flex items-center gap-1 text-xs whitespace-nowrap">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-content-muted shrink-0" aria-hidden="true" />}
            {item.to ? (
              <Link to={item.to} className="text-content-secondary hover:text-primary-600 flex items-center gap-1">
                {i === 0 && <Home className="h-3 w-3 shrink-0" aria-hidden="true" />}
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-content-primary font-medium flex items-center gap-1">
                {i === 0 && <Home className="h-3 w-3 shrink-0" aria-hidden="true" />}
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
