import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 disabled:bg-primary-300 border border-transparent",
  secondary:
    "bg-white text-content-primary border border-border hover:bg-slate-50 active:bg-slate-100 disabled:text-content-muted",
  danger:
    "bg-danger text-white hover:bg-danger/90 active:bg-danger active:bg-[#BF3238] disabled:bg-danger/50 border border-transparent",
  "danger-outline":
    "bg-white text-danger border border-danger/40 hover:bg-danger-50 active:bg-danger-100 disabled:opacity-50",
  ghost:
    "bg-transparent text-content-primary hover:bg-slate-100 active:bg-slate-200 border border-transparent disabled:text-content-muted",
};

const sizes = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  icon: "h-9 w-9 p-0 justify-center",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, className, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded font-medium transition-colors select-none whitespace-nowrap",
        "disabled:cursor-not-allowed disabled:opacity-70",
        variants[variant],
        sizes[size],
        className,
      )}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-0.5 h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
