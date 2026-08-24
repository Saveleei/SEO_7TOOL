"use client";

import { useState } from "react";
import { uploadLandingImage } from "./actions";

export function LandingImagePicker({ name, initial }: { name: string; initial?: string }) {
  const [url, setUrl] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadLandingImage(formData);
      setUrl(result.url);
    } catch {
      setError("Не удалось загрузить изображение. Допустимы JPG, PNG, WebP и AVIF до 12 МБ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={url} />
      <div className="flex flex-wrap items-start gap-3">
        <div className="aspect-[16/10] w-[220px] overflow-hidden rounded-lg border border-steel-200 bg-steel-50">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-[0.14em] text-steel-400">без фото</div>}
        </div>
        <div className="grid min-w-[240px] flex-1 gap-2">
          <label className="inline-flex w-fit cursor-pointer rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-900 hover:bg-amber-100">
            {busy ? "Загрузка…" : "Загрузить фото"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} className="hidden" onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0])} />
          </label>
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Или вставьте URL изображения" className="rounded-md border border-steel-200 px-3 py-2 text-[13px] focus:border-amber-400 focus:outline-none" />
          {url && <button type="button" onClick={() => setUrl("")} className="w-fit text-[12px] font-bold text-red-700 hover:underline">Убрать фото</button>}
          {error && <p className="text-[11px] text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}

