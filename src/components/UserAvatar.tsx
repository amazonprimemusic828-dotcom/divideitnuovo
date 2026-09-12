import React, { useId } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  userEmail: string;
  userName: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showOnline?: boolean;
  className?: string;
  /** 0-100 trust score — renders a professional progress ring around the avatar */
  trustScore?: number | null;
  /** Show the numeric trust badge under the ring (default: true when trustScore is set and size >= md) */
  showTrustValue?: boolean;
}

// Legacy avatar values remain displayable without changing stored profiles.
function parsePredefinedAvatar(value?: string | null) {
  if (!value?.startsWith("predefined:")) return null;
  const parts = value.split(":");
  return { gradient: parts[2], emoji: parts[3] };
}

export default function UserAvatar({ userEmail, userName, avatarUrl, size = "md", showOnline = false, className, trustScore = null, showTrustValue }: UserAvatarProps) {
  const id = useId();
  const sizes = { xs: "size-7", sm: "size-9", md: "size-11", lg: "size-14", xl: "size-20" };
  const legacy = parsePredefinedAvatar(avatarUrl);
  const initials = userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || userEmail[0]?.toUpperCase() || "U";
  const hasTrust = typeof trustScore === "number" && Number.isFinite(trustScore);
  const score = hasTrust ? Math.max(0, Math.min(100, Math.round(trustScore))) : 0;
  const showValue = showTrustValue ?? (hasTrust && (size === "lg" || size === "xl"));
  return (
    <span className={cn("relative inline-flex shrink-0 flex-col items-center", className)}>
      <span className={cn("relative inline-flex", hasTrust && "rounded-full border-2 border-mint p-1")} aria-label={hasTrust ? `Affidabilità ${score} su 100` : undefined}>
        <Avatar className={sizes[size]}>
          {!legacy && avatarUrl && <AvatarImage src={avatarUrl} alt={userName} className="object-cover" />}
          <AvatarFallback className="bg-secondary font-semibold text-secondary-foreground" style={legacy ? { background: legacy.gradient } : undefined}>
            {legacy?.emoji || initials}
          </AvatarFallback>
        </Avatar>
        {showOnline && <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-muted-foreground" aria-label="Stato non disponibile" />}
        {showValue && hasTrust && <span id={id} className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border-2 border-card bg-mint px-2 text-sm font-bold text-mint-foreground">{score}</span>}
      </span>
      {showValue && hasTrust && <span className="pt-4 text-sm text-muted-foreground">Affidabilità</span>}
    </span>
  );
}
