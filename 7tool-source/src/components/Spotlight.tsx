"use client";

import { useRef, type CSSProperties } from "react";

export function Spotlight({
  children,
  className = "",
  color = "rgba(245, 158, 11, 0.28)",
  size = 420,
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !ref.current) return;
    ref.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  const style: CSSProperties & Record<string, string | number> = {
    "--spotlight-color": color,
    "--spotlight-size": `${size}px`,
  };
  return (
    <div ref={ref} onMouseMove={onMove} style={style} className={`spotlight ${className}`}>
      {children}
    </div>
  );
}
