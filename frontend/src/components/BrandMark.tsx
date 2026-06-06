import { useId } from "react";
import { BRAND_SHORT } from "../brand";

type Props = { compact?: boolean };

export function BrandMark({ compact }: Props) {
  const gradId = `vmBrandGrad-${useId().replace(/:/g, "")}`;

  return (
    <div
      className={`brand-mark ${compact ? "brand-mark--compact" : ""}`}
      aria-hidden
    >
      <svg
        className="brand-mark__icon"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id={gradId}
            x1="0"
            y1="0"
            x2="40"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--lnd-blue)" />
            <stop offset="1" stopColor="var(--lnd-blue)" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Фон */}
        <rect width="40" height="40" rx="10" fill={`url(#${gradId})`} />

        {/* Медицинский крест */}
        <rect x="17" y="11" width="6" height="18" rx="2" fill="white">
          <animate
            attributeName="opacity"
            values="0.85;1;0.85"
            dur="2s"
            repeatCount="indefinite"
          />
        </rect>
        <rect x="11" y="17" width="18" height="6" rx="2" fill="white">
          <animate
            attributeName="opacity"
            values="0.85;1;0.85"
            dur="2s"
            repeatCount="indefinite"
          />
        </rect>

        {/* Пульсирующее кольцо */}
        <circle
          cx="20"
          cy="20"
          r="13"
          fill="none"
          stroke="white"
          strokeWidth="2"
        >
          <animate
            attributeName="r"
            values="13;17;13"
            dur="4.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.8;0;0.8"
            dur="4.5s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      {!compact && (
        <div className="brand-mark__text">
          <span className="brand-mark__name">{BRAND_SHORT}</span>
        </div>
      )}
    </div>
  );
}
