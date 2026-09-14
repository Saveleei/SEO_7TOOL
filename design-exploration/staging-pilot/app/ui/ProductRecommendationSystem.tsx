import Image from "next/image";
import {
  formatFeedPrice,
  getFeedProductCompatibility,
  getFeedProductImage,
  getFeedProductPriceLabel,
  getFeedVariantSpecs,
  type FeedProduct,
  type FeedProductAlternative,
  type FeedVariant,
} from "../data/feedCatalog";
import { getVariantChoicePresentation } from "../data/variantPresentation";
import type { ProductPageArchetype } from "../data/productPageArchetypes";
import { ContactRequestDialog } from "./ContactRequestDialog";
import { FeedAvailability } from "./FeedAvailability";
import { ProductComparisonDialog, type ProductComparisonOption, type ProductComparisonRow } from "./ProductComparisonDialog";
import { AddRequestButton } from "./RequestCart";

type ProductRecommendationSystemProps = {
  product: FeedProduct;
  variant: FeedVariant;
  selectedProductContext: string;
  criteria: Array<{ title: string; copy: string }>;
  alternatives: FeedProductAlternative[];
  pageArchetype: ProductPageArchetype;
};

export function ProductRecommendationSystem({ product, variant, selectedProductContext, criteria, alternatives, pageArchetype }: ProductRecommendationSystemProps) {
  const compatibility = getFeedProductCompatibility(product, variant, 3);
  const selectedChoice = getVariantChoicePresentation(product, variant);
  const comparisonOptions = buildComparisonOptions(product, variant, alternatives);
  const comparisonRows = buildComparisonRows(product, variant, alternatives);

  return <><ProductComparisonDialog currentProductId={product.id} currentVariantId={variant.id} options={comparisonOptions} rows={comparisonRows} heading={pageArchetype.comparisonTitle} description={pageArchetype.comparisonDescription} keepAction={pageArchetype.comparisonKeepAction} /><section className="section section-muted feed-recommendation-system" id="recommendations"><div className="container">
    <div className="section-heading feed-recommendation-heading"><div><p className="eyebrow">Короткий путь к закупке</p><h2>{pageArchetype.recommendationTitle}</h2></div><p>{pageArchetype.recommendationIntro}</p></div>

    <section className="feed-recommendation-stage" aria-labelledby="compatible-title">
      <header><span>01</span><div><p>Совместимость</p><h3 id="compatible-title">{pageArchetype.compatibilityTitle}</h3></div><small>Только проверяемые совпадения</small></header>
      {compatibility.length > 0
        ? <div className="feed-recommendation-grid">{compatibility.map((recommendation) => <RecommendationCard key={`${recommendation.product.id}-${recommendation.variant.id}`} mode="compatibility" recommendation={recommendation} />)}</div>
        : <div className="feed-recommendation-empty"><div><b>В фиде нет достаточных данных для автоматической связи</b><p>Не показываем товары из соседней категории наугад. Менеджер проверит посадку, диапазон и рабочие условия по выбранному исполнению.</p></div><ContactRequestDialog categoryTitle={`${selectedProductContext}: проверить совместимость`} buttonLabel="Проверить совместимость" /></div>}
    </section>

    <section className="feed-recommendation-stage feed-recommendation-stage--kit" aria-labelledby="kit-title">
      <header><span>02</span><div><p>Полный комплект</p><h3 id="kit-title">{pageArchetype.kitTitle}</h3></div><small>Без автоматического навязывания</small></header>
      <div className="feed-recommendation-kit"><div className="feed-recommendation-kit-copy"><span>Уже передадим инженеру</span><b>{selectedChoice.label}</b><p>{product.title}{variant.sku ? ` · артикул ${variant.sku}` : ""}</p></div><ol>{criteria.slice(0, 3).map((criterion) => <li key={criterion.title}><b>{criterion.title}</b><span>{criterion.copy}</span></li>)}</ol><div className="feed-recommendation-kit-action"><b>Собрать комплект под вашу задачу</b><p>Переходники, расходные материалы и оснастку добавим только после проверки применимости. В форме уже сохранено выбранное исполнение.</p><ContactRequestDialog categoryTitle={`${selectedProductContext}: полный комплект`} buttonLabel="Подобрать полный комплект" /></div></div>
    </section>

    <section className="feed-recommendation-stage" aria-labelledby="alternatives-title">
      <header><span>03</span><div><p>Осознанная замена</p><h3 id="alternatives-title">{pageArchetype.alternativesTitle}</h3></div><small>С объяснением различий</small></header>
      {alternatives.length > 0
        ? <div className="feed-recommendation-grid">{alternatives.map((recommendation) => <RecommendationCard key={`${recommendation.product.id}-${recommendation.variant.id}`} mode="alternative" recommendation={recommendation} />)}</div>
        : <div className="feed-recommendation-empty"><div><b>Нет моделей с достаточным числом сопоставимых параметров</b><p>Это безопаснее случайной выдачи похожих названий. Инженер предложит замену после уточнения обязательных характеристик.</p></div><ContactRequestDialog categoryTitle={`${selectedProductContext}: подобрать альтернативу`} buttonLabel="Подобрать альтернативу" /></div>}
    </section>
  </div></section></>;
}

type RecommendationCardProps = {
  mode: "compatibility" | "alternative";
  recommendation: {
    product: FeedProduct;
    variant: FeedVariant;
    relationLabel?: string;
    reason?: string;
    evidence: string[];
    differences?: string[];
    caveat?: string;
  };
};

function RecommendationCard({ mode, recommendation }: RecommendationCardProps) {
  const { product, variant } = recommendation;
  const choice = getVariantChoicePresentation(product, variant);
  const image = variant.images?.find(Boolean) ?? getFeedProductImage(product);
  const price = formatFeedPrice(variant.price) ?? getFeedProductPriceLabel(product);
  const href = `/product/${product.slug}?variant=${encodeURIComponent(variant.id)}#variants`;
  const label = mode === "compatibility" ? recommendation.relationLabel : recommendation.reason;

  return <article className={`feed-recommendation-card feed-recommendation-card--${mode}`}>
    <a className="feed-recommendation-media" href={href}>{image ? <Image src={image} alt={`${product.title}, ${choice.label}`} width={220} height={170} unoptimized /> : <span>Фото уточняется</span>}</a>
    <div className="feed-recommendation-body"><span className="feed-recommendation-reason">{label}</span><h4><a href={href}>{product.title}</a></h4><p className="feed-recommendation-choice">{choice.label}</p>{choice.context && <p className="feed-recommendation-context">{choice.context}</p>}<ul>{recommendation.evidence.map((fact) => <li key={fact}>{fact}</li>)}</ul>{recommendation.differences && recommendation.differences.length > 0 && <p className="feed-recommendation-difference"><b>Отличается:</b> {recommendation.differences.join(" · ")}</p>}{recommendation.caveat && <p className="feed-recommendation-caveat">{recommendation.caveat}</p>}<small>{variant.sku ? `Артикул ${variant.sku}` : "Артикул не указан в фиде"}</small><div className="feed-recommendation-commercial"><b>{price}</b><FeedAvailability available={isConfirmedAvailable(variant)} exact /></div>{mode === "compatibility" ? <AddRequestButton item={{ id:`variant:${variant.id}`, title:variant.name || product.title, article:variant.sku ? `Артикул ${variant.sku}` : "Артикул не указан в фиде", price, image, href }}>Добавить в КП</AddRequestButton> : <a className="feed-recommendation-link" href={href}>Сравнить характеристики →</a>}</div>
  </article>;
}

function isConfirmedAvailable(variant: FeedVariant): boolean {
  return variant.available && typeof variant.quantity === "number" && variant.quantity > 0;
}

function buildComparisonOptions(product: FeedProduct, variant: FeedVariant, alternatives: FeedProductAlternative[]): ProductComparisonOption[] {
  const choice = getVariantChoicePresentation(product, variant);
  return [
    {
      id:variant.id,
      productId:product.id,
      title:product.title,
      brand:product.brand,
      choiceLabel:choice.label,
      choiceContext:choice.context,
      article:variant.sku ? `Артикул ${variant.sku}` : "Артикул не указан в фиде",
      price:formatFeedPrice(variant.price) ?? getFeedProductPriceLabel(product),
      available:isConfirmedAvailable(variant),
      image:variant.images?.find(Boolean) ?? getFeedProductImage(product),
      href:`/product/${product.slug}?variant=${encodeURIComponent(variant.id)}#variants`,
      reason:"Текущее выбранное исполнение",
      current:true,
    },
    ...alternatives.map((alternative) => {
      const alternativeChoice = getVariantChoicePresentation(alternative.product, alternative.variant);
      return {
        id:alternative.variant.id,
        productId:alternative.product.id,
        title:alternative.product.title,
        brand:alternative.product.brand,
        choiceLabel:alternativeChoice.label,
        choiceContext:alternativeChoice.context,
        article:alternative.variant.sku ? `Артикул ${alternative.variant.sku}` : "Артикул не указан в фиде",
        price:formatFeedPrice(alternative.variant.price) ?? getFeedProductPriceLabel(alternative.product),
        available:isConfirmedAvailable(alternative.variant),
        image:alternative.variant.images?.find(Boolean) ?? getFeedProductImage(alternative.product),
        href:`/product/${alternative.product.slug}?variant=${encodeURIComponent(alternative.variant.id)}#variants`,
        reason:alternative.reason,
      };
    }),
  ];
}

function buildComparisonRows(product: FeedProduct, variant: FeedVariant, alternatives: FeedProductAlternative[]): ProductComparisonRow[] {
  const sourceSpecs = getFeedVariantSpecs(product, variant).slice(0, 5);
  const candidateSpecs = alternatives.map((alternative) => getFeedVariantSpecs(alternative.product, alternative.variant));
  return sourceSpecs.map((sourceSpec) => ({
    label:sourceSpec.label,
    values:[sourceSpec.value, ...candidateSpecs.map((specs) => specs.find((spec) => normalizeSpecLabel(spec.label) === normalizeSpecLabel(sourceSpec.label))?.value ?? "")],
  }));
}

function normalizeSpecLabel(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/[^a-zа-я0-9]+/giu, " ").trim();
}
