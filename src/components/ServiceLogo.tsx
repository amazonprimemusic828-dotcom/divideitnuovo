import { CategorySymbol } from "@/components/logos/subscription-logos";
import { getServiceCategory } from "@/lib/serviceConstants";

interface ServiceLogoProps {
  name?: string | null;
  className?: string;
  size?: number;
  decorative?: boolean;
}

export default function ServiceLogo({ name, className, size, decorative = false }: ServiceLogoProps) {
  return <CategorySymbol category={getServiceCategory(name)} className={className} size={size} decorative={decorative} />;
}
