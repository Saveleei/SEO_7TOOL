"use client";

import { useState } from "react";
import { searchCategoryProductPhotos, uploadCategoryCover, type CategoryProductPhoto } from "./actions";

export function CoverPicker({ name, initial, categorySlug }: { name: string; initial: string | null; categorySlug?: string }) {
  const [url, setUrl] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<CategoryProductPhoto[]>([]);
  const [searching, setSearching] = useState(false);

  async function onUpload(file: File) {
    setErr(null); setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await uploadCategoryCover(fd);
      setUrl(r.url);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadProductPhotos(nextQuery = query) {
    if (!categorySlug) return;
    setErr(null);
    setSearching(true);
    try {
      setPhotos(await searchCategoryProductPhotos(categorySlug, nextQuery));
      setGalleryOpen(true);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={url} />
      <div className="flex items-start gap-3">
        <div className="relative aspect-[16/10] w-[220px] shrink-0 overflow-hidden rounded-md border border-steel-200 bg-steel-50">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] uppercase tracking-[0.16em] text-steel-400">обложка</div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label className={`inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-steel-200 bg-white px-3 py-1.5 text-[12.5px] font-bold text-steel-700 hover:border-amber-400 hover:bg-amber-50 ${busy ? "opacity-50" : ""}`}>
            {busy ? "Загрузка…" : "Загрузить новую"}
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              className="hidden"
            />
          </label>
          {categorySlug && (
            <button
              type="button"
              onClick={() => galleryOpen ? setGalleryOpen(false) : void loadProductPhotos("")}
              disabled={searching}
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12.5px] font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              {searching ? "Загрузка…" : galleryOpen ? "Скрыть фотографии товаров" : "Выбрать из товаров категории"}
            </button>
          )}
          {url && (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-steel-200 bg-white px-3 py-1.5 text-[12.5px] font-bold text-red-700 hover:border-red-300"
            >
              Убрать обложку
            </button>
          )}
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/img/.../cover.webp"
            className="rounded-md border border-steel-200 bg-white px-3 py-1.5 text-[12.5px] text-steel-700 focus:border-amber-400 focus:outline-none"
          />
          {err && <div className="text-[11.5px] text-red-700">{err}</div>}
          <p className="text-[11.5px] text-steel-500">→ WebP 1600×1200 Q82</p>
        </div>
      </div>
      {galleryOpen && categorySlug && (
        <div className="rounded-md border border-steel-200 bg-steel-50/70 p-3">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void loadProductPhotos();
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Название, артикул или бренд"
              className="min-w-0 flex-1 rounded-md border border-steel-200 bg-white px-3 py-1.5 text-[12.5px] focus:border-amber-400 focus:outline-none"
            />
            <button type="submit" disabled={searching} className="rounded-md bg-steel-900 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">
              Найти
            </button>
          </form>
          <p className="mt-2 text-[11px] text-steel-500">Нажмите на фотографию — она станет обложкой после сохранения категории.</p>
          <div className="mt-3 grid max-h-[430px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-5">
            {photos.map((photo) => (
              <button
                type="button"
                key={`${photo.productId}:${photo.url}`}
                onClick={() => setUrl(photo.url)}
                title={photo.productTitle}
                className={`group overflow-hidden rounded-md border bg-white text-left transition ${url === photo.url ? "border-amber-500 ring-2 ring-amber-200" : "border-steel-200 hover:border-amber-300"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.productTitle} className="aspect-square w-full object-contain p-1.5" loading="lazy" />
                <span className="block truncate border-t border-steel-100 px-2 py-1.5 text-[10.5px] text-steel-600">{photo.productTitle}</span>
              </button>
            ))}
          </div>
          {!searching && photos.length === 0 && <div className="py-6 text-center text-[12px] text-steel-500">Фотографии не найдены.</div>}
        </div>
      )}
    </div>
  );
}
