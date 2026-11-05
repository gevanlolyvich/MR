import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

/** Select native bergaya aplikasi (tanpa dropdown custom agar aksesibel & mobile-friendly). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, id, ...props }, ref) => {
    const fallbackId = useId();
    return (
      <select
        ref={ref}
        id={id ?? fallbackId}
        aria-invalid={!!error || undefined}
        className={cn(
          "w-full h-10 rounded border bg-white px-2.5 text-sm text-content-primary",
          "transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500",
          "disabled:cursor-not-allowed disabled:bg-slate-50",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = "Select";
