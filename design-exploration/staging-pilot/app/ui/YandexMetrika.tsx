type Props = { counterId: number | null };

export function YandexMetrika({ counterId }: Props) {
  if (!counterId) return null;
  const bootstrap = `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");window.dataLayer=window.dataLayer||[];ym(${counterId},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false,ecommerce:"dataLayer"});`;
  return <>
    <script id="yandex-metrika" dangerouslySetInnerHTML={{ __html:bootstrap }} />
    <noscript><img src={`https://mc.yandex.ru/watch/${counterId}`} alt="" width="1" height="1" style={{ position:"absolute", left:"-9999px" }} /></noscript>
  </>;
}
