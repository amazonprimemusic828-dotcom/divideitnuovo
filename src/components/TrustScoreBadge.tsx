import React from "react";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

interface TrustScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export default function TrustScoreBadge({ 
  score, 
  size = "md", 
  showLabel = true 
}: TrustScoreBadgeProps) {
  const getTrustLevel = (score: number) => {
    if (score >= 80) return { level: "Eccellente", color: "bg-green-500", textColor: "text-green-600", icon: "🌟" };
    if (score >= 60) return { level: "Buono", color: "bg-blue-500", textColor: "text-blue-600", icon: "✅" };
    if (score >= 40) return { level: "Medio", color: "bg-yellow-500", textColor: "text-yellow-600", icon: "⭐" };
    return { level: "Basso", color: "bg-red-500", textColor: "text-red-600", icon: "⚠️" };
  };

  const trust = getTrustLevel(score || 0);
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-2"
  };

  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <div className="flex items-center gap-1">
          <Shield className={`w-3 h-3 ${trust.textColor}`} />
          <span className="text-xs text-muted-foreground font-medium">Affidabilità:</span>
        </div>
      )}
      <Badge className={`${trust.color} text-white ${sizeClasses[size]} font-semibold`}>
        {trust.icon} {score || 0}/100
      </Badge>
      {size !== "sm" && (
        <span className={`text-xs font-medium ${trust.textColor}`}>
          {trust.level}
        </span>
      )}
    </div>
  );
}
