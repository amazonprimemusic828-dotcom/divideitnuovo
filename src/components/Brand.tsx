import { Link } from "react-router-dom";
import { Divide } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Brand({ to = "/", inverse = false, compact = false }: { to?: string; inverse?: boolean; compact?: boolean }) {
  return (
    <Link to={to} className={cn("brand-lockup", inverse && "brand-inverse")} aria-label="DivideIt, pagina iniziale">
      <span className="brand-symbol" aria-hidden="true"><Divide strokeWidth={2.6} /></span>
      {!compact && <span className="font-display">divideit<span className="brand-period">.</span></span>}
    </Link>
  );
}
