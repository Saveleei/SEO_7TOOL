import Script from "next/script";
import { YANDEX_ECOMMERCE_LAYER, YANDEX_METRIKA_ID } from "@/lib/metrika-config";

export function YandexMetrika() {
  const id = YANDEX_METRIKA_ID;

  return (
    <>
      <Script id="yandex-metrika" strategy="beforeInteractive">
        {`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
          window.dataLayer=window.dataLayer||[];
          ym(${id},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false,ecommerce:"${YANDEX_ECOMMERCE_LAYER}"});
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://mc.yandex.ru/watch/${id}`}
          alt=""
          style={{ position: "absolute", left: "-9999px" }}
        />
      </noscript>
    </>
  );
}
