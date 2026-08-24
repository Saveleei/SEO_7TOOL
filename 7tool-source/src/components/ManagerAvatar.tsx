export function ManagerAvatar({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <radialGradient id="mg-bg" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#fbb74b" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <linearGradient id="mg-jacket" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1c252c" />
          <stop offset="100%" stopColor="#0f161b" />
        </linearGradient>
        <linearGradient id="mg-skin" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fde0a8" />
          <stop offset="100%" stopColor="#f3c98a" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="60" fill="url(#mg-bg)" />
      {/* shoulders / jacket */}
      <path d="M10 120 C 18 88, 38 78, 60 78 S 102 88, 110 120 Z" fill="url(#mg-jacket)" />
      <path d="M48 86 L60 102 L72 86 L72 120 L48 120 Z" fill="#fff" />
      <path d="M60 102 L57 120 L63 120 Z" fill="#f59e0b" />
      {/* head */}
      <circle cx="60" cy="56" r="22" fill="url(#mg-skin)" />
      {/* hair */}
      <path d="M40 50 Q42 32 60 30 T82 50 Q82 42 70 36 Q60 32 50 36 Q40 42 40 50 Z" fill="#0f161b" />
      {/* glasses */}
      <circle cx="52" cy="58" r="5.5" fill="none" stroke="#0f161b" strokeWidth="1.6" />
      <circle cx="68" cy="58" r="5.5" fill="none" stroke="#0f161b" strokeWidth="1.6" />
      <path d="M57.5 58 H62.5" stroke="#0f161b" strokeWidth="1.6" />
      {/* mouth */}
      <path d="M55 70 Q60 73 65 70" stroke="#7a4612" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
