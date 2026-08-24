"use client";

import { useEffect, useState } from "react";

const TABS = [
  { id: "p-info", label: "Описание" },
  { id: "p-specs", label: "Характеристики" },
  { id: "p-faq", label: "Вопрос-ответ" },
];

export function StickyTabs() {
  const [active, setActive] = useState<string>("");
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setStuck(window.scrollY > 720);
      // detect active section
      let cur = "";
      for (const t of TABS) {
        const el = document.getElementById(t.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top - 120 < 0) cur = t.id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const click = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <nav
      className={`sticky top-[64px] z-20 -mx-6 mt-8 border-y border-steel-200 bg-white/95 backdrop-blur transition ${
        stuck ? "shadow-soft" : ""
      }`}
    >
      <ul className="mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-6 py-2">
        {TABS.map((t) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              onClick={click(t.id)}
              className={`inline-flex shrink-0 items-center rounded-md px-3 py-1.5 text-[13px] font-bold transition ${
                active === t.id
                  ? "bg-amber-400 text-steel-900 shadow-amber"
                  : "text-steel-700 hover:bg-amber-50 hover:text-amber-800"
              }`}
            >
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
