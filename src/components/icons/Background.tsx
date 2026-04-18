import { Box } from "@mui/material";
import React from "react";

export const Background = () => {
  return <SVGImage />;
};

export const AnimatedBackground = ({
  intensity = 0.02,
  maxOffset = 14,
  damping = 0.18,
}) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const reducedMotion = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    );
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let running = false;

    const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

    const onPointerMove = (e: PointerEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      // Opposite direction (inverse parallax)
      const rawX = -dx * intensity;
      const rawY = -dy * intensity;

      targetX = clamp(rawX, maxOffset);
      targetY = clamp(rawY, maxOffset);

      if (!running) {
        running = true;
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const tick = () => {
      // Smoothly approach target (damped interpolation)
      currentX += (targetX - currentX) * damping;
      currentY += (targetY - currentY) * damping;

      el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;

      // Keep the loop alive to finish easing even if pointer stops
      if (
        Math.abs(targetX - currentX) > 0.05 ||
        Math.abs(targetY - currentY) > 0.05
      ) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      el.style.transform = "translate3d(0,0,0)";
    };
  }, [intensity, maxOffset, damping, reducedMotion]);

  return (
    <Box
      ref={ref}
      sx={{
        position: "absolute",
        inset: 0,
        willChange: "transform",
        // Your existing background style (example; keep your own)
        backgroundImage:
          "radial-gradient(ellipse at top, #080e21 0%, #1b2735 95%)",
        transition: "transform 80ms linear", // micro-smoothing for minor jitters
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          transform: "translate3d(0,0,0)",
        },
      }}
    >
      <SVGImage />;
    </Box>
  );
};


const SVGImage = () => {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1920 1126"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="200%" height="200%" fill="#030B20" x="-50%" y="-50%" />
      <g clipPath="url(#clip0_133_404)">
        <path
          style={{ mixBlendMode: "screen" }}
          opacity="0.9"
          d="M960 1126C1265.41 1126 1513 878.413 1513 573C1513 267.587 1265.41 20 960 20C654.587 20 407 267.587 407 573C407 878.413 654.587 1126 960 1126Z"
          fill="url(#paint0_linear_133_404)"
          fillOpacity="0.6"
        />
      </g>
      <defs>
        <linearGradient
          id="paint0_linear_133_404"
          x1="1514.36"
          y1="99.8602"
          x2="390.263"
          y2="1059.24"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.12" stopColor="#6F226A" />
          <stop offset="0.15" stopColor="#611D5D" />
          <stop offset="0.22" stopColor="#431440" />
          <stop offset="0.29" stopColor="#2A0D28" />
          <stop offset="0.38" stopColor="#170716" />
          <stop offset="0.48" stopColor="#0A0309" />
          <stop offset="0.6" stopColor="#020002" />
          <stop offset="0.83" />
        </linearGradient>
        <clipPath id="clip0_133_404">
          <rect
            width="1106"
            height="1106"
            fill="white"
            transform="translate(407 20)"
          />
        </clipPath>
      </defs>
    </svg>
  );
};
