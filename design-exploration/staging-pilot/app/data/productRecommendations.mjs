function normalize(value = "") {
  return String(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, "");
}

function formatParameter(parameter) {
  return `${parameter?.value ?? ""}${parameter?.unit ? ` ${parameter.unit}` : ""}`.trim();
}

function findParameter(variant, keyword) {
  const normalizedKeyword = normalize(keyword);
  return variant?.params?.find((item) => normalize(item.name).includes(normalizedKeyword));
}

export function getParameterValue(variant, keyword) {
  return formatParameter(findParameter(variant, keyword));
}

export function getParameterNumber(variant, keyword) {
  const value = getParameterValue(variant, keyword).replace(",", ".");
  const match = value.match(/-?\d+(?:\.\d+)?/);
  const parsed = Number.parseFloat(match?.[0] ?? "");
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isConfirmedAvailable(variant) {
  return variant?.available === true && typeof variant.quantity === "number" && variant.quantity > 0;
}

function hasProductImage(product) {
  return product?.images?.some(Boolean) || product?.variants?.some((variant) => variant.images?.some(Boolean));
}

function spindleMatches(first, second) {
  const a = normalize(first);
  const b = normalize(second);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

function machineDiameter(variant) {
  return getParameterNumber(variant, "макс. диаметр корончатого") ?? getParameterNumber(variant, "макс. диаметр отверстия");
}

function cutterDiameter(variant) {
  return getParameterNumber(variant, "диаметр режущей") ?? getParameterNumber(variant, "диаметр");
}

function isMagneticDrill(product) {
  return product?.category === "stanki-sverlilnye"
    && /(магнит|электромагнит)/i.test(product.title)
    && !/(приспособлен|креплен|стойк|оснастк)/i.test(product.title);
}

export function selectCompatibleAccessories(products, machine, limit = 3, selectedVariant = machine?.variants?.[0]) {
  const spindle = getParameterValue(selectedVariant, "шпиндель");
  const maximumDiameter = machineDiameter(selectedVariant);
  if (!spindle || !maximumDiameter) return [];

  const candidates = products
    .filter((product) => product.category === "koronchatye-sverla" && hasProductImage(product))
    .flatMap((product) => product.variants.map((variant) => ({
      product,
      variant,
      diameter:cutterDiameter(variant),
      spindle:getParameterValue(variant, "хвостовик"),
      workingLength:getParameterValue(variant, "рабочая длина"),
    })))
    .filter((item) => item.diameter && item.diameter <= maximumDiameter && item.variant.price > 0 && isConfirmedAvailable(item.variant) && spindleMatches(spindle, item.spindle));

  const preferredDiameters = Array.from(new Set([18, 25, maximumDiameter].filter((value) => value <= maximumDiameter)));
  const selected = [];
  for (const target of preferredDiameters) {
    const match = candidates
      .filter((candidate) => !selected.some((item) => item.variant.id === candidate.variant.id))
      .sort((first, second) => Math.abs(first.diameter - target) - Math.abs(second.diameter - target) || first.variant.price - second.variant.price)[0];
    if (match) selected.push(match);
    if (selected.length >= limit) break;
  }
  return selected;
}

function selectCompatibleMachines(products, cutter, selectedVariant, limit) {
  const diameter = cutterDiameter(selectedVariant);
  const cutterSpindle = getParameterValue(selectedVariant, "хвостовик");
  const workingLength = getParameterValue(selectedVariant, "рабочая длина");
  if (!diameter || !cutterSpindle) return [];

  const candidates = products
    .filter((product) => product.id !== cutter.id && isMagneticDrill(product) && hasProductImage(product))
    .flatMap((product) => product.variants.map((variant) => ({
      product,
      variant,
      maximumDiameter:machineDiameter(variant),
      spindle:getParameterValue(variant, "шпиндель"),
    })))
    .filter((item) => item.maximumDiameter && item.maximumDiameter >= diameter && spindleMatches(item.spindle, cutterSpindle))
    .sort((first, second) => Number(isConfirmedAvailable(second.variant)) - Number(isConfirmedAvailable(first.variant))
      || first.maximumDiameter - second.maximumDiameter
      || (first.variant.price ?? Number.POSITIVE_INFINITY) - (second.variant.price ?? Number.POSITIVE_INFINITY));

  const selected = [];
  for (const candidate of candidates) {
    if (selected.some((item) => item.product.id === candidate.product.id)) continue;
    selected.push({
      ...candidate,
      relationLabel:"Совпадает по хвостовику и диаметру",
      evidence:[
        `Хвостовик сверла ${cutterSpindle} соответствует шпинделю ${candidate.spindle}`,
        `Ø${diameter} мм входит в диапазон станка до Ø${candidate.maximumDiameter} мм`,
      ],
      caveat:`Перед заказом проверим ${workingLength ? `рабочую длину ${workingLength}, ` : ""}центрирующий штифт и подачу СОЖ.`,
    });
    if (selected.length >= limit) break;
  }
  return selected;
}

export function selectProductCompatibility(products, product, selectedVariant = product?.variants?.[0], limit = 3) {
  if (!product || !selectedVariant || limit <= 0) return [];
  if (product.category === "stanki-sverlilnye" && isMagneticDrill(product)) {
    const maximumDiameter = machineDiameter(selectedVariant);
    const spindle = getParameterValue(selectedVariant, "шпиндель");
    return selectCompatibleAccessories(products, product, limit, selectedVariant).map((item) => ({
      ...item,
      relationLabel:"Совпадает по хвостовику и рабочему диапазону",
      evidence:[
        `Хвостовик ${item.spindle} соответствует шпинделю ${spindle}`,
        `Ø${item.diameter} мм входит в диапазон станка до Ø${maximumDiameter} мм`,
      ],
      caveat:`Перед заказом проверим ${item.workingLength ? `рабочую длину ${item.workingLength}, ` : ""}материал сверла, штифт и режим резания.`,
    }));
  }
  if (product.category === "koronchatye-sverla") return selectCompatibleMachines(products, product, selectedVariant, limit);
  return [];
}

export function selectProductAlternatives(products, machine, limit = 3, selectedVariant = machine?.variants?.[0]) {
  const sourceDiameter = machineDiameter(selectedVariant);
  const sourceSpindle = getParameterValue(selectedVariant, "шпиндель");
  const sourceReverse = getParameterValue(selectedVariant, "реверс");
  const sourcePrice = selectedVariant?.price ?? machine?.priceFrom;
  if (!sourceDiameter) return [];

  const candidates = products
    .filter((product) => product.id !== machine.id && product.category === machine.category && hasProductImage(product) && isMagneticDrill(product))
    .map((product) => {
      const variant = product.variants.find((item) => isConfirmedAvailable(item) && item.price > 0)
        ?? product.variants.find((item) => item.price > 0)
        ?? product.variants[0];
      return {
        product,
        variant,
        diameter:machineDiameter(variant),
        spindle:getParameterValue(variant, "шпиндель"),
        reverse:getParameterValue(variant, "реверс"),
        mass:getParameterValue(variant, "масса"),
      };
    })
    .filter((item) => item.variant && item.diameter && item.product.priceFrom && spindleMatches(sourceSpindle, item.spindle));

  const selected = [];
  const take = (items, reason, sorter) => {
    const item = items.filter((candidate) => !selected.some((picked) => picked.product.id === candidate.product.id)).sort(sorter)[0];
    if (item && selected.length < limit) selected.push({ ...item, reason });
  };

  take(candidates.filter((item) => sourcePrice && item.product.priceFrom < sourcePrice && item.diameter >= sourceDiameter), "Ниже цена", (a, b) => Math.abs(a.diameter - sourceDiameter) - Math.abs(b.diameter - sourceDiameter) || a.product.priceFrom - b.product.priceFrom);
  take(candidates.filter((item) => sourceReverse !== "Да" && item.reverse === "Да" && item.diameter >= sourceDiameter), "С реверсом", (a, b) => Math.abs(a.diameter - sourceDiameter) - Math.abs(b.diameter - sourceDiameter) || a.product.priceFrom - b.product.priceFrom);
  take(candidates.filter((item) => item.diameter > sourceDiameter), "Больший диаметр", (a, b) => a.diameter - b.diameter || a.product.priceFrom - b.product.priceFrom);
  take(candidates, "Близкая модель", (a, b) => Math.abs(a.diameter - sourceDiameter) - Math.abs(b.diameter - sourceDiameter) || a.product.priceFrom - b.product.priceFrom);
  return selected.slice(0, limit);
}

const comparisonKeywordsByCategory = Object.freeze({
  "koronchatye-sverla":["диаметр режущей", "рабочая длина", "хвостовик", "материал режущей", "материал", "покрытие"],
  borfrezy:["форма", "диаметр режущей", "длина режущей", "диаметр хвостовика", "материал", "покрытие", "тип насечки"],
  "pilnye-diski":["диаметр диска", "посадочное отверстие", "материал", "число зубьев", "ширина пропила", "тип зубьев"],
  metchiki:["резьба", "шаг резьбы", "тип отверстия", "материал режущей", "покрытие", "тип метчика"],
  "almaznoe-burenie":["диаметр режущей", "рабочая длина", "хвостовик", "материал", "число сегментов"],
  "sverla-i-zenkovki":["диаметр режущей", "рабочая длина", "хвостовик", "диаметр хвостовика", "материал", "покрытие", "угол зенкования"],
  "kromkorezy-po-listu":["привод", "макс. ширина фаски", "угол фаски", "макс. толщина заготовки", "возможности", "тип обработки"],
  "kromkorezy-dlya-trub":["способ крепления", "мин. диаметр труб", "макс. диаметр труб", "макс. ширина фаски", "привод", "тип обработки"],
  truborezy:["мин. диаметр труб", "макс. диаметр труб", "макс. толщина стен", "материал заготовки", "напряжение"],
  "karetki-svarochnye":["положения сварки", "движение каретки", "особенности"],
  "karetki-termicheskoy-rezki":["назначение", "тип резки", "количество резаков", "мин. толщина резки", "макс. толщина резки"],
  "rezbonareznye-manipulyatory":["макс. резьба", "рабочий радиус", "охват рабочей зоны", "посадка", "автоподача"],
  kompressory:["тип", "тип смазки", "производительность", "объем ресивера", "мощность", "параметры питания"],
  "disko-otreznye-stanki":["тип", "диаметр пильного диска", "диаметр диска", "угол реза", "регулирование скорости", "тип электродвигателя"],
  "lentochnopilnye-stanki":["тип исполнения", "длина ленточного полотна", "ширина ленточного полотна", "макс. диаметр круглого профиля", "макс. высота заготовки", "макс. ширина заготовки"],
  "shlifovalnoe-i-zatochnoe-oborudovanie":["вид", "тип шлифования", "диаметр сверла", "мин. диаметр сверла", "макс. диаметр сверла", "ширина ленты", "длина ленты"],
  "magnitnaya-osnastka":["тип фиксатора", "длина", "ширина", "усилие на отрыв", "толщина материала", "подходит для труб"],
  "zahvaty-dlya-gruzov":["грузоподъемность", "толщина материала", "усилие на отрыв", "включение", "отключение магнита"],
  "svarochnye-vrashchateli-i-pozitsionery":["грузоподъемность", "мин. диаметр обечайки", "макс. диаметр обечайки", "диаметр планшайбы", "особенности"],
  "stanki-lazernoy-rezki":["мощность", "длина рабочего стола", "ширина рабочего стола", "наличие защитной кабины", "наличие сменного стола"],
  "svarochnye-roboty":["макс. охват", "доп. возможности", "количество осей"],
  "sozh-i-sots":["вид", "объем", "форма выпуска", "состав"],
});

const weakValues = new Set(["да", "нет", "есть", "отсутствует", "неуказано"]);
const requiredMatchKeywordsByCategory = Object.freeze({
  "koronchatye-sverla":["диаметр режущей"],
  borfrezy:["диаметр режущей"],
  "pilnye-diski":["диаметр диска", "посадочное отверстие"],
  metchiki:["резьба"],
  "almaznoe-burenie":["диаметр режущей", "хвостовик"],
  "sverla-i-zenkovki":["диаметр режущей"],
});

function getComparisonFacts(variant, category) {
  const seen = new Set();
  return (comparisonKeywordsByCategory[category] ?? [])
    .map((keyword) => ({ keyword, parameter:findParameter(variant, keyword) }))
    .filter(({ parameter }) => {
      if (!parameter) return false;
      const key = normalize(parameter.name);
      const value = normalize(formatParameter(parameter));
      if (!value || weakValues.has(value) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ keyword, parameter }) => ({ keyword, label:parameter.name, value:formatParameter(parameter), normalizedValue:normalize(formatParameter(parameter)) }));
}

function comparisonReason(sourceVariant, candidateVariant, matchCount) {
  const sourcePrice = sourceVariant?.price;
  const candidatePrice = candidateVariant?.price;
  if (sourcePrice > 0 && candidatePrice > 0 && candidatePrice < sourcePrice) return "Ниже цена при совпадающих параметрах";
  const modulo100 = matchCount % 100;
  const modulo10 = matchCount % 10;
  const noun = modulo100 >= 11 && modulo100 <= 14 ? "параметров" : modulo10 === 1 ? "параметр" : modulo10 >= 2 && modulo10 <= 4 ? "параметра" : "параметров";
  return `Совпадают ${matchCount} ключевых ${noun}`;
}

export function selectComparableAlternatives(products, sourceProduct, selectedVariant = sourceProduct?.variants?.[0], limit = 3) {
  if (!sourceProduct || !selectedVariant || limit <= 0) return [];
  if (sourceProduct.category === "stanki-sverlilnye" && isMagneticDrill(sourceProduct)) {
    const sourceDiameter = machineDiameter(selectedVariant);
    return selectProductAlternatives(products, sourceProduct, limit, selectedVariant).map((item) => ({
      ...item,
      evidence:[`Шпиндель: ${item.spindle}`, `Корончатое сверление: до Ø${item.diameter} мм`],
      differences:[
        item.diameter !== sourceDiameter ? `Рабочий диаметр — до Ø${item.diameter} мм` : "",
        item.reverse ? `Реверс: ${item.reverse}` : "",
      ].filter(Boolean),
    }));
  }

  const sourceFacts = getComparisonFacts(selectedVariant, sourceProduct.category);
  if (sourceFacts.length < 2) return [];
  const recommendations = [];

  for (const product of products) {
    if (product.id === sourceProduct.id || product.category !== sourceProduct.category || !hasProductImage(product)) continue;
    let best;
    for (const variant of product.variants) {
      const candidateFacts = getComparisonFacts(variant, product.category);
      const matches = sourceFacts.flatMap((sourceFact) => {
        const candidateFact = candidateFacts.find((fact) => fact.keyword === sourceFact.keyword && fact.normalizedValue === sourceFact.normalizedValue);
        return candidateFact ? [sourceFact] : [];
      });
      if (matches.length < 2) continue;
      const requiredKeywords = (requiredMatchKeywordsByCategory[sourceProduct.category] ?? []).filter((keyword) => sourceFacts.some((fact) => fact.keyword === keyword));
      if (!requiredKeywords.every((keyword) => matches.some((fact) => fact.keyword === keyword))) continue;
      const score = matches.length * 100 + Number(isConfirmedAvailable(variant)) * 10 + Number(variant.price > 0);
      if (!best || score > best.score || (score === best.score && (variant.price ?? Number.POSITIVE_INFINITY) < (best.variant.price ?? Number.POSITIVE_INFINITY))) {
        const differences = sourceFacts.flatMap((sourceFact) => {
          const candidateFact = candidateFacts.find((fact) => fact.keyword === sourceFact.keyword && fact.normalizedValue !== sourceFact.normalizedValue);
          return candidateFact ? [`${candidateFact.label}: ${candidateFact.value}`] : [];
        }).slice(0, 2);
        best = {
          product,
          variant,
          reason:comparisonReason(selectedVariant, variant, matches.length),
          evidence:matches.slice(0, 3).map((fact) => `${fact.label}: ${fact.value}`),
          differences,
          score,
        };
      }
    }
    if (best) recommendations.push(best);
  }

  return recommendations
    .sort((first, second) => second.score - first.score
      || Number(isConfirmedAvailable(second.variant)) - Number(isConfirmedAvailable(first.variant))
      || (first.variant.price ?? Number.POSITIVE_INFINITY) - (second.variant.price ?? Number.POSITIVE_INFINITY))
    .slice(0, limit);
}
