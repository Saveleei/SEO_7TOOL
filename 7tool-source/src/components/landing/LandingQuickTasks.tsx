"use client";

import { trackEvent } from "@/lib/analytics";
import type { LandingQuickTask } from "@/lib/landing-pages";

export const LANDING_QUICK_TASK_EVENT = "7tool:landing-quick-task";

type Props = {
  category: string;
  intent: string;
  tasks: LandingQuickTask[];
};

export type LandingQuickTaskDetail = LandingQuickTask & {
  category: string;
  intent: string;
};

export function LandingQuickTasks({ category, intent, tasks }: Props) {
  function choose(task: LandingQuickTask) {
    const detail: LandingQuickTaskDetail = { ...task, category, intent };
    window.dispatchEvent(new CustomEvent<LandingQuickTaskDetail>(LANDING_QUICK_TASK_EVENT, { detail }));
    trackEvent("lp_quick_choice", { page_type: "landing", category, intent, placement: task.questionName || "task" });
    requestAnimationFrame(() => document.getElementById("request")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="mt-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-steel-500">Быстрый выбор по задаче</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {tasks.map((task) => (
          <button
            key={`${task.questionName || "task"}-${task.value}`}
            type="button"
            onClick={() => choose(task)}
            className="inline-flex min-h-11 items-center rounded-lg border border-steel-200 bg-white px-4 text-left text-[13px] font-bold text-steel-700 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900"
          >
            {task.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-steel-500">Нажмите на задачу — выбор подставится в короткую форму.</p>
    </div>
  );
}
