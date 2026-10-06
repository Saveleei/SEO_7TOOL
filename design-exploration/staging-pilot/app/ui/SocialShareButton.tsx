"use client";

import { useState } from "react";

export function SocialShareButton({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await copyText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_500);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_500);
    }
  }

  return <button className="button button-quiet social-share-button" type="button" onClick={() => void share()}>
    <span aria-hidden="true">↗</span>{copied ? "Ссылка скопирована" : "Поделиться"}
  </button>;
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}
