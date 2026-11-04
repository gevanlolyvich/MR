import { cn } from "@/lib/utils";

interface LogoProps {
  /** "full" = logo + wordmark dari aset hitam; "mark" = hanya simbol/logo */
  variant?: "mark" | "full";
  /** Tema warna teks & pegangan logo: dark = untuk background gelap (sidebar) */
  theme?: "dark" | "light";
  className?: string;
  withTitle?: boolean;
}

/**
 * Komponen logo resmi JXB.
 * Menggunakan aset asli dari /branding (tidak digambar ulang, proporsi asli dipertahankan).
 */
export function Logo({
  variant = "full",
  theme = "light",
  className,
  withTitle = false,
}: LogoProps) {
  const src =
    variant === "mark"
      ? "/branding/jxb-logo-white.png"
      : "/branding/jxb-logo-black.png";

  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      <img
        src={src}
        alt="Logo Jakarta Experience Board (JXB)"
        className={cn(
          "shrink-0 object-contain",
          variant === "mark" ? "h-9 w-auto" : "h-10 w-auto",
        )}
        draggable={false}
      />
      {withTitle && (
        <div className="min-w-0">
          <span
            className={cn(
              "block text-[15px] font-bold leading-tight tracking-wide",
              theme === "light" ? "text-white" : "text-navy",
            )}
          >
            JXB-MR
          </span>
          <span
            className={cn(
              "block text-[10px] font-medium leading-tight uppercase tracking-wider",
              theme === "light" ? "text-white/70" : "text-content-secondary",
            )}
          >
            Enterprise Risk Management
          </span>
        </div>
      )}
    </div>
  );
}
