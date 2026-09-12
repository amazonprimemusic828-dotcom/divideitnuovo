import type { SVGProps } from "react";
import { BookOpen, Clapperboard, Cloud, Dumbbell, Gamepad2, GraduationCap, Headphones, Layers3, NotebookPen, PackageOpen, type LucideIcon } from "lucide-react";
import { SERVICE_CATEGORY_LABELS, type ServiceCategory } from "@/lib/serviceConstants";
import { cn } from "@/lib/utils";

const categoryIcons: Record<ServiceCategory, LucideIcon> = {
  video: Clapperboard,
  music: Headphones,
  gaming: Gamepad2,
  productivity: NotebookPen,
  reading: BookOpen,
  learning: GraduationCap,
  sport: Dumbbell,
  cloud: Cloud,
  bundle: PackageOpen,
  generic: Layers3,
};

interface CategorySymbolProps extends SVGProps<SVGSVGElement> {
  category: ServiceCategory;
  size?: number;
  decorative?: boolean;
}

export function CategorySymbol({ category, size = 48, className, decorative = false, ...props }: CategorySymbolProps) {
  const Icon = categoryIcons[category];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("service-symbol", className)}
      data-service-category={category}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : SERVICE_CATEGORY_LABELS[category]}
      aria-hidden={decorative || undefined}
      focusable="false"
      {...props}
    >
      <rect x="0.5" y="0.5" width="47" height="47" rx="13" />
      <Icon x={11} y={11} width={26} height={26} strokeWidth={1.8} aria-hidden="true" focusable="false" />
    </svg>
  );
}
