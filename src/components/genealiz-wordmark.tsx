import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface GenealizWordmarkProps {
  className?: string;
  tone?: "light" | "dark";
  variant?: "horizontal" | "stacked" | "symbol";
}

function artworkMask(asset: "symbol" | "lettering" | "signature"): CSSProperties {
  const mask = `url(/assets/genealiz/genealiz-${asset}.svg) center / contain no-repeat`;
  return { mask, WebkitMask: mask, backgroundColor: "currentColor", color: "inherit" };
}

const symbol = artworkMask("symbol");
const lettering = { ...artworkMask("lettering"), width: "4.8em", aspectRatio: "704 / 83" };
const signature = {
  ...artworkMask("signature"),
  width: "5.6em",
  maxWidth: "100%",
  aspectRatio: "704 / 817",
};

/** Approved seal and lettering traced from the supplied artwork. */
export function GenealizWordmark({
  className,
  tone = "light",
  variant = "horizontal",
}: GenealizWordmarkProps) {
  return (
    <span
      role="img"
      aria-label="GENEALIZ"
      className={cn("genealiz-wordmark", className)}
      style={{ color: tone === "dark" ? "var(--gold-soft)" : "var(--bronze)" }}
    >
      {variant === "stacked" ? (
        <span aria-hidden="true" style={signature} />
      ) : (
        <>
          <span aria-hidden="true" className="genealiz-mark" style={symbol} />
          {variant === "horizontal" && (
            <span aria-hidden="true" className="genealiz-lettering" style={lettering} />
          )}
        </>
      )}
    </span>
  );
}
