export function Logo({ inverted = false }: { inverted?: boolean }) {
  if (inverted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1.5 shadow-amber">
        <span className="grid h-6 w-6 place-items-center rounded-sm bg-steel-900 text-amber-400">
          <Bolt />
        </span>
        <span className="font-display text-[20px] font-extrabold leading-none tracking-[-0.02em] text-steel-900">
          7TOOL
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-steel-900 px-3 py-1.5 shadow-elev">
      <span className="grid h-6 w-6 place-items-center rounded-sm bg-amber-400 text-steel-900">
        <Bolt />
      </span>
      <span className="font-display text-[20px] font-extrabold leading-none tracking-[-0.02em] text-white">
        7TOOL
      </span>
    </span>
  );
}

function Bolt() {
  // Стилизованный знак гайки/шестерни
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2zm0 4.2L6.66 9.4v5.2L12 17.8l5.34-3.2V9.4L12 6.2zm0 2.6a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4z"/>
    </svg>
  );
}
