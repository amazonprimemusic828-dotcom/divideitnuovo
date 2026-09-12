// EuroCoin.tsx — VERSIONE AUTONOMA: non serve nessun CSS esterno
import { Link } from "react-router-dom";
import coinFront from "@/assets/euro-coin-front.png";
import coinBack from "@/assets/euro-coin-back.png";

const EDGE_SEGMENTS = 24;
const COIN_SIZE = 140; // px
const THICKNESS_RATIO = 0.14; // spessore = 14% del diametro

const COIN_CSS = `
@keyframes euro-coin-spin {
  from { transform: rotateY(0deg); }
  to { transform: rotateY(360deg); }
}
@keyframes euro-coin-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(calc(var(--coin-float, 12px) * -1)); }
}
@keyframes euro-coin-shadow {
  0%, 100% { opacity: 0.35; scale: 1; }
  50% { opacity: 0.18; scale: 0.82; }
}
.euro-coin-wrapper { position: relative; transform-style: preserve-3d; }
.euro-coin-spin {
  animation: euro-coin-spin 3.2s linear infinite;
  transform-style: preserve-3d !important;
}
.euro-coin-float {
  animation: euro-coin-float 2.8s ease-in-out infinite;
  transform-style: preserve-3d !important;
}
.euro-coin-shadow { animation: euro-coin-shadow 2.8s ease-in-out infinite; transform-origin: center; }
.euro-coin-wrapper:hover .euro-coin-spin { animation-duration: 1.2s; }
@keyframes euro-coin-glow {
  0%, 100% {
    box-shadow: 0 0 6px rgba(139, 69, 255, .28),
                0 0 12px rgba(139, 69, 255, .12);
  }
  50% {
    box-shadow: 0 0 10px rgba(139, 69, 255, .52),
                0 0 20px rgba(139, 69, 255, .20);
  }
}
.euro-coin-wrapper::after {
  content: "";
  position: absolute;
  inset: 1px;
  border-radius: 9999px;
  pointer-events: none;
  animation: euro-coin-glow 2.8s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .euro-coin-spin, .euro-coin-float, .euro-coin-shadow { animation: none; }
  .euro-coin-wrapper::after { animation: none; box-shadow: 0 0 8px rgba(139, 69, 255, .3); }
}
`;

export function EuroCoin({
  size = COIN_SIZE,
  thickness,
  showShadow = true,
  className = "",
  asLink = true,
}: {
  size?: number;
  thickness?: number;
  showShadow?: boolean;
  className?: string;
  asLink?: boolean;
}) {
  const radius = size / 2;
  const coinThickness = thickness ?? Math.max(6, size * THICKNESS_RATIO);
  const segmentWidth = 2 * radius * Math.tan(Math.PI / EDGE_SEGMENTS) + 1;
  const floatAmplitude = Math.max(3, Math.min(12, size * 0.08));

  const wrapperStyle = {
    width: size,
    height: size,
    perspective: size * 5,
    "--coin-float": `${floatAmplitude}px`,
  } as React.CSSProperties;

  const coin = (
    <>
      <style dangerouslySetInnerHTML={{ __html: COIN_CSS }} />
      <span className="euro-coin-float block h-full w-full" style={{ transformStyle: "preserve-3d" }}>
        <span className="euro-coin-spin relative block h-full w-full" style={{ transformStyle: "preserve-3d" }}>
          {/* Faccia frontale */}
          <span
            className="absolute inset-0 overflow-hidden rounded-full"
            style={{ backfaceVisibility: "hidden", transform: `translateZ(${coinThickness / 2}px)` }}
          >
            <img src={coinFront} alt="" className="h-full w-full rounded-full object-cover" draggable={false} />
          </span>
          {/* Faccia posteriore */}
          <span
            className="absolute inset-0 overflow-hidden rounded-full"
            style={{ backfaceVisibility: "hidden", transform: `rotateY(180deg) translateZ(${coinThickness / 2}px)` }}
          >
            <img src={coinBack} alt="" className="h-full w-full rounded-full object-cover" draggable={false} />
          </span>
          {/* Bordo (spessore) */}
          {Array.from({ length: EDGE_SEGMENTS }).map((_, i) => {
            const angle = (360 / EDGE_SEGMENTS) * i;
            return (
              <span
                key={i}
                aria-hidden="true"
                className="absolute"
                style={{
                  width: segmentWidth,
                  height: coinThickness,
                  left: radius - segmentWidth / 2,
                  top: radius - coinThickness / 2,
                  background: "linear-gradient(180deg, #d8d8d8 0%, #b9bcc0 35%, #8f9398 70%, #b9bcc0 100%)",
                  transform: `rotateZ(${angle}deg) translateY(${radius - 0.5}px) rotateX(90deg)`,
                }}
              />
            );
          })}
        </span>
      </span>
      {showShadow && (
        <span
          aria-hidden="true"
          className="euro-coin-shadow pointer-events-none absolute left-1/2 block rounded-[50%]"
          style={{
            width: size * 0.7,
            height: size * 0.14,
            top: size + Math.max(6, size * 0.12),
            transform: "translateX(-50%)",
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 45%, transparent 70%)",
          }}
        />
      )}
    </>
  );

  if (!asLink) {
    return (
      <span className={`euro-coin-wrapper relative inline-block ${className}`} style={wrapperStyle}>
        {coin}
      </span>
    );
  }

  return (
    <Link
      to="/Referral"
      aria-label="Vai al programma referral: invita un amico e guadagna 1 euro"
      className={`euro-coin-wrapper group relative inline-block cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background rounded-full ${className}`}
      style={wrapperStyle}
    >
      {coin}
    </Link>
  );
}

export default EuroCoin;