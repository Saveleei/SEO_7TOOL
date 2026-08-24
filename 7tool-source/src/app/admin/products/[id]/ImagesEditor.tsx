"use client";

import { useState, useTransition } from "react";
import { saveImages, uploadImage } from "./actions";

export function ImagesEditor({ productId, initial }: { productId: string; initial: string[] }) {
  const [images, setImages] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onUpload(files: FileList) {
    setErr(null);
    setBusy(true);
    try {
      const next = [...images];
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", f);
        const { url } = await uploadImage(fd);
        next.push(url);
      }
      setImages(next);
      await persist(next);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function persist(arr: string[]) {
    const fd = new FormData();
    fd.set("images", JSON.stringify(arr));
    await saveImages(productId, fd);
  }

  function remove(idx: number) {
    const next = images.filter((_, i) => i !== idx);
    setImages(next);
    start(() => persist(next));
  }
  function move(idx: number, dir: -1 | 1) {
    const t = idx + dir;
    if (t < 0 || t >= images.length) return;
    const next = [...images];
    [next[idx], next[t]] = [next[t], next[idx]];
    setImages(next);
    start(() => persist(next));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((src, i) => (
          <figure key={src + i} className="group relative overflow-hidden rounded-md border border-steel-200 bg-white">
            <div className="relative aspect-square bg-steel-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-contain" />
              {i === 0 && (
                <span className="absolute left-2 top-2 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-steel-900">главное</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[11px] text-steel-600">
              <div className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded border border-steel-200 px-1 disabled:opacity-30">←</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} className="rounded border border-steel-200 px-1 disabled:opacity-30">→</button>
              </div>
              <button type="button" onClick={() => remove(i)} className="text-red-700 hover:underline">удалить</button>
            </div>
          </figure>
        ))}
        <label className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-steel-300 bg-steel-50 text-steel-500 transition hover:border-amber-400 hover:bg-amber-50 ${busy ? "opacity-50" : ""}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          <span className="text-[12px] font-bold">{busy ? "Загрузка…" : "Добавить фото"}</span>
          <input
            type="file"
            multiple
            accept="image/*"
            disabled={busy}
            onChange={(e) => e.target.files && onUpload(e.target.files)}
            className="hidden"
          />
        </label>
      </div>
      {err && <div className="text-[12px] text-red-700">{err}</div>}
      <p className="text-[11.5px] text-steel-500">Формат → WebP 1600px Q80. Первое фото — главное.</p>
    </div>
  );
}
