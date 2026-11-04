import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={ariaInvalid ?? (!!error || undefined)}
      className={cn(
        "w-full h-10 rounded border bg-white px-3 text-sm text-content-primary placeholder:text-content-muted",
        "transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-content-muted",
        error || ariaInvalid ? "border-danger" : "border-border",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={ariaInvalid ?? (!!error || undefined)}
      className={cn(
        "w-full rounded border bg-white px-3 py-2 text-sm text-content-primary placeholder:text-content-muted",
        "transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-content-muted",
        error || ariaInvalid ? "border-danger" : "border-border",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export function Label({
  className,
  required,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn("block text-xs font-medium text-content-secondary mb-1.5", className)}
      {...props}
    >
      {props.children}
      {required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs text-danger" role="alert">
      {message}
    </p>
  );
}
