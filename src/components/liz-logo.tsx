import logoAsset from "@/assets/liz-logo.png.asset.json";
import { cn } from "@/lib/utils";

interface LizLogoProps {
  className?: string;
  size?: number;
  alt?: string;
}

/**
 * Marca visual do Instituto Liz — ampulheta dourada com folhas.
 * Sempre renderizada a partir do CDN. Não substituir por SVG improvisado.
 */
export function LizLogo({ className, size = 40, alt = "Instituto Liz" }: LizLogoProps) {
  return (
    <img
      src={logoAsset.url}
      alt={alt}
      width={size}
      height={size}
      className={cn("object-contain select-none", className)}
      draggable={false}
    />
  );
}

export function LizLogoLockup({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "light";
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LizLogo size={36} />
      <div className="leading-tight">
        <p
          className={cn(
            "font-serif text-base tracking-tight whitespace-nowrap",
            variant === "light" ? "text-sidebar-foreground" : "text-primary",
          )}
        >
          Instituto Liz
        </p>
        <p
          className={cn(
            "text-[10px] uppercase tracking-[0.24em] whitespace-nowrap",
            variant === "light" ? "text-sidebar-foreground" : "text-muted-foreground",
          )}
        >
          Psicogenealogia
        </p>
      </div>
    </div>
  );
}
