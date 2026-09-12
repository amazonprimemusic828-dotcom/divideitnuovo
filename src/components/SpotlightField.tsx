import * as React from "react";

type SpotlightFieldProps = {
  className?: string;
  children: React.ReactNode;
};

/**
 * Signature moment: a soft aurora spotlight that follows the pointer.
 * Uses CSS variables for position (colors remain in the design system).
 */
export function SpotlightField({ className, children }: SpotlightFieldProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const reducedMotion = React.useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false,
    [],
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reducedMotion) return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
    },
    [reducedMotion],
  );

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      className={
        "relative overflow-hidden bg-hero-aurora " +
        (reducedMotion ? "" : "[transition:background-position_200ms_ease]") +
        " " +
        (className ?? "")
      }
    >
      {/* subtle texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.25] [background-image:radial-gradient(hsl(var(--foreground)/0.08)_1px,transparent_1px)] [background-size:16px_16px]"
      />
      {children}
    </div>
  );
}
