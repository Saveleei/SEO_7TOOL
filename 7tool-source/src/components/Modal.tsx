"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  onClose,
  children,
  className = "",
  width = "max-w-[480px]",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  width?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  const node = (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute inset-0 bg-steel-900/60 backdrop-blur-sm animate-[fadeIn_.18s_ease]"
      />
      <div className={`relative w-full ${width} mx-0 sm:mx-4 max-h-[92vh] overflow-y-auto rounded-t-[20px] sm:rounded-[20px] border border-steel-200 bg-white shadow-elev animate-[slideUp_.22s_cubic-bezier(.2,.8,.2,1)] ${className}`}>
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-steel-600 shadow-soft transition hover:border-amber-400 hover:bg-amber-400 hover:text-steel-900"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M6 6l12 12M18 6l-12 12" /></svg>
        </button>
        {children}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
  return createPortal(node, document.body);
}
