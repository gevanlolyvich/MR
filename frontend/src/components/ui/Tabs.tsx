import { createContext, useContext, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TabsCtx = createContext<{ value: string; onChange: (v: string) => void } | null>(null);

function useTabsCtx() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("TabItem harus berada di dalam Tabs");
  return ctx;
}

export function Tabs({
  value: controlledValue,
  onChange: controlledOnChange,
  defaultValue = "",
  children,
  className,
}: {
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const value = controlledValue ?? internal;
  const onChange = controlledOnChange ?? setInternal;
  return (
    <TabsCtx.Provider value={{ value, onChange }}>
      <div role="tablist" className={cn("rounded border border-border bg-white overflow-hidden w-max min-w-full flex", className)}>
        {children}
      </div>
    </TabsCtx.Provider>
  );
}

export function TabItem({
  value,
  icon: Icon,
  children,
}: {
  value: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  const { value: active, onChange } = useTabsCtx();
  const isActive = active === value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => onChange(value)}
      className={cn(
        "flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors",
        "min-h-[38px]",
        isActive ? "bg-primary-500 text-white" : "text-content-secondary hover:bg-slate-50 hover:text-content-primary",
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </button>
  );
}
