"use client";

import Image from "next/image";
import { useState } from "react";

export function FeedProductGallery({ images, title }: { images: string[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] ?? images[0];

  return <div className="feed-conversion-gallery">
    <div className="feed-conversion-gallery-main">
      {activeImage ? <Image src={activeImage} alt={title} width={760} height={650} priority unoptimized /> : <span>Изображение уточняется</span>}
      <small>Фото из каталога поставщика</small>
    </div>
    {images.length > 1 && <div className="feed-conversion-thumbnails" aria-label="Другие фотографии товара">
      {images.slice(0, 6).map((image, index) => <button className={index === activeIndex ? "active" : undefined} type="button" aria-label={`Показать фото ${index + 1}`} aria-pressed={index === activeIndex} onClick={() => setActiveIndex(index)} key={image}>
        <Image src={image} alt="" width={90} height={76} unoptimized />
      </button>)}
    </div>}
  </div>;
}
