import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PremiumSearchInputProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
};

export default function PremiumSearchInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  autoFocus,
}: PremiumSearchInputProps) {
  const reduceMotion = useReducedMotion();
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <motion.div
      initial={false}
      animate={
        reduceMotion
          ? undefined
          : {
              scale: isFocused ? 1.01 : 1,
            }
      }
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "relative flex-1 min-w-0",
        "rounded-2xl",
        // Use semantic tokens only
        "bg-background",
        "border-2 border-border",
        "shadow-sm",
        "focus-within:border-primary",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        "transition-[border-color,box-shadow,transform]",
        className,
      )}
    >
      <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
        <Search className={cn("h-5 w-5", isFocused && "text-foreground")} />
      </div>

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          // Let wrapper handle border/ring; keep input clean
          "h-12",
          "border-0",
          "bg-transparent",
          "pl-12 pr-12",
          "rounded-2xl",
          "focus-visible:ring-0 focus-visible:ring-offset-0",
          "text-base",
          inputClassName,
        )}
      />

      <motion.div
        initial={false}
        animate={
          reduceMotion
            ? undefined
            : {
                opacity: value ? 1 : 0,
                scale: value ? 1 : 0.95,
              }
        }
        transition={{ duration: 0.12, ease: "easeOut" }}
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2",
          value ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange("")}
          className={cn(
            "h-9 w-9 rounded-xl p-0",
            "text-muted-foreground hover:text-foreground",
            "transition-colors",
          )}
          aria-label="Pulisci ricerca"
        >
          <X className="h-4 w-4" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
