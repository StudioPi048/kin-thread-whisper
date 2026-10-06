import { cn } from "@/lib/utils";

/** Three nested folios form a G: a family story held across generations. */
export function GenealizWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("genealiz-wordmark", className)}>
      <svg viewBox="0 0 44 44" fill="none" aria-hidden="true" className="genealiz-mark">
        <path
          d="M34 8H17C10 8 6 13 6 20V27C6 34 11 38 18 38H35V23H23"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          d="M35 14H19C15 14 12 17 12 21V26C12 30 15 32 19 32H29V29"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M35 2H16M41 23V38" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className="genealiz-lettering">GENEALIZ</span>
    </span>
  );
}
