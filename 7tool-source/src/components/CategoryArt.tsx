import type { CategoryIcon } from "@/lib/catalog";

const stroke = "#2a363f";

const paths: Record<CategoryIcon, React.ReactNode> = {
  drill: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <rect x="58" y="24" width="44" height="22" />
      <rect x="64" y="46" width="32" height="58" />
      <path d="M80 104 v34" />
      <path d="M70 138 l10 18 l10 -18" />
      <path d="M76 156 v8 M84 156 v8" />
      <path d="M58 30 h-12 M58 40 h-12" />
    </g>
  ),
  cutter: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <rect x="50" y="28" width="22" height="40" />
      <rect x="44" y="68" width="34" height="14" />
      <path d="M61 82 v68" />
      <path d="M48 90 l13 6 l13 -6 M48 110 l13 6 l13 -6 M48 130 l13 6 l13 -6" />
      <path d="M55 150 l6 10 l6 -10 z" />
      <circle cx="120" cy="100" r="32" />
      <path d="M120 68 v64 M88 100 h64 M97 77 l46 46 M143 77 l-46 46" />
    </g>
  ),
  edge: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <path d="M20 130 h160" />
      <path d="M20 130 l40 -40 h120" />
      <rect x="60" y="70" width="60" height="20" />
      <rect x="64" y="50" width="52" height="20" />
      <circle cx="90" cy="80" r="6" />
      <path d="M150 90 l20 10 l-20 10 z" />
    </g>
  ),
  grinder: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <rect x="30" y="80" width="100" height="30" />
      <circle cx="150" cy="95" r="22" />
      <circle cx="150" cy="95" r="6" />
      <path d="M30 80 v-14 h60 v14" />
      <path d="M40 110 v18 h80 v-18" />
      <path d="M55 128 h50" />
    </g>
  ),
  saw: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <path d="M20 140 h160" />
      <path d="M40 140 v-30" />
      <path d="M40 110 l30 -40 h60 l30 40" />
      <circle cx="100" cy="110" r="36" />
      <path d="M100 74 l4 8 l-8 0 z M136 110 l-8 4 l0 -8 z M100 146 l-4 -8 l8 0 z M64 110 l8 -4 l0 8 z" />
    </g>
  ),
  pipe: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <ellipse cx="60" cy="100" rx="14" ry="40" />
      <path d="M60 60 h80 M60 140 h80" />
      <ellipse cx="140" cy="100" rx="14" ry="40" />
      <path d="M100 50 v-20 M100 30 h20" />
      <path d="M86 100 h28" />
    </g>
  ),
  weldAuto: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <rect x="30" y="40" width="40" height="60" />
      <path d="M70 60 h60 v40 h-60" />
      <path d="M130 80 l30 30" />
      <path d="M150 110 l8 -4 l4 8 l-8 4 z" />
      <rect x="20" y="100" width="60" height="20" />
      <circle cx="34" cy="130" r="8" />
      <circle cx="66" cy="130" r="8" />
    </g>
  ),
  thermal: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <path d="M40 140 h120" />
      <path d="M100 140 v-50" />
      <path d="M88 90 h24 v-20 h-24 z" />
      <path d="M100 70 v-30" />
      <path d="M88 50 q12 -20 24 0" />
      <path d="M70 140 l8 -16 M130 140 l-8 -16" />
    </g>
  ),
  weld: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <rect x="30" y="50" width="80" height="60" />
      <path d="M30 70 h80 M30 90 h80" />
      <path d="M110 70 l40 -10 v50 l-40 -10" />
      <path d="M50 110 v20 M90 110 v20" />
      <path d="M40 130 h60" />
    </g>
  ),
  robot: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <rect x="40" y="120" width="60" height="20" />
      <path d="M70 120 v-30" />
      <path d="M70 90 l50 -30" />
      <path d="M120 60 l30 20" />
      <circle cx="70" cy="90" r="6" />
      <circle cx="120" cy="60" r="6" />
      <path d="M150 80 l-6 4 l-4 -6" />
    </g>
  ),
  lift: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <path d="M30 40 h140" />
      <path d="M100 40 v40" />
      <rect x="80" y="80" width="40" height="20" />
      <path d="M100 100 v30" />
      <path d="M80 130 h40 v20 h-40 z" />
      <path d="M50 40 v20 M150 40 v20" />
    </g>
  ),
  pneumatic: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <rect x="60" y="40" width="40" height="60" />
      <path d="M100 60 h30" />
      <path d="M60 100 v20 h40 v-20" />
      <path d="M70 120 l-10 30 l40 0 l-10 -30" />
      <path d="M130 60 q20 0 20 20 t-20 20" />
    </g>
  ),
  electric: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <rect x="40" y="60" width="60" height="40" />
      <path d="M100 70 h30 v20 h-30" />
      <path d="M40 100 v20 h30 v-20" />
      <path d="M50 120 v18 M65 120 v18" />
      <path d="M120 80 l8 -16 l-4 16 l8 -8" />
    </g>
  ),
  fixture: (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="square">
      <rect x="30" y="100" width="50" height="30" />
      <rect x="120" y="100" width="50" height="30" />
      <path d="M80 115 h40" />
      <path d="M80 105 h40 M80 125 h40" />
      <path d="M30 130 v20 h50 v-20 M120 130 v20 h50 v-20" />
    </g>
  ),
};

export function CategoryArt({ icon, className = "" }: { icon: CategoryIcon; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-steel-50 via-white to-cobalt-50/60 ${className}`}>
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-200/30 blur-2xl" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-cobalt-200/40 blur-2xl" />
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="absolute inset-0 h-full w-full opacity-[0.18]"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id={`grid-${icon}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#4f6271" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="200" height="200" fill={`url(#grid-${icon})`} />
      </svg>
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="relative h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {paths[icon]}
      </svg>
    </div>
  );
}
