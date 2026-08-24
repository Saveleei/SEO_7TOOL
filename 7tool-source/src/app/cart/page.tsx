import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CartView } from "./CartView";
import { noIndexRobots } from "@/lib/seo-metadata";

export const metadata = {
  title: "Корзина",
  description: "Оформление заказа промышленного инструмента и оборудования.",
  robots: noIndexRobots,
};

export default function CartPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="border-b border-steel-100 bg-gradient-to-b from-white via-cobalt-50/30 to-white">
          <div className="mx-auto max-w-[1280px] px-6 pb-8 pt-8 lg:pt-10">
            <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Корзина" }]} />
            <h1 className="mt-5 font-display text-[32px] font-bold tracking-tight text-steel-900 lg:text-[40px]">
              Корзина
            </h1>
            <p className="mt-2 max-w-[640px] text-[14.5px] text-steel-600">
              Сформируйте заказ — мы свяжемся в течение 15 минут в рабочее время и подтвердим наличие, цену и сроки отгрузки.
            </p>
          </div>
        </section>
        <CartView />
      </main>
      <SiteFooter />
    </>
  );
}
