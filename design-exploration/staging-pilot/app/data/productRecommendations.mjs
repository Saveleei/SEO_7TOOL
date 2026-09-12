function normalize(value = "") {
  return String(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, "");
}

export function getParameterValue(variant, keyword) {
  const normalizedKeyword = normalize(keyword);
  const parameter = variant?.params?.find((item) => normalize(item.name).includes(normalizedKeyword));
  if (!parameter) return "";
  return `${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ""}`.trim();
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

function spindleMatches(first, second) {
  const a = normalize(first);
  const b = normalize(second);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

function machineDiameter(variant) {
  return getParameterNumber(variant, "макс. диаметр корончатого") ?? getParameterNumber(variant, "макс. диаметр отверстия");
}

export function selectCompatibleAccessories(products, machine, limit = 3) {
  const machineVariant = machine?.variants?.[0];
  const spindle = getParameterValue(machineVariant, "шпиндель");
  const maximumDiameter = machineDiameter(machineVariant);
  if (!spindle || !maximumDiameter) return [];

  const candidates = products
    .filter((product) => product.category === "koronchatye-sverla" && product.images?.some(Boolean))
    .flatMap((product) => product.variants.map((variant) => ({
      product,
      variant,
      diameter:getParameterNumber(variant, "диаметр"),
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

export function selectProductAlternatives(products, machine, limit = 3) {
  const sourceVariant = machine?.variants?.[0];
  const sourceDiameter = machineDiameter(sourceVariant);
  const sourceSpindle = getParameterValue(sourceVariant, "шпиндель");
  const sourceReverse = getParameterValue(sourceVariant, "реверс");
  const sourcePrice = machine?.priceFrom;
  if (!sourceDiameter) return [];

  const candidates = products
    .filter((product) => product.id !== machine.id && product.category === machine.category && product.images?.some(Boolean) && /(магнит|электромагнит)/i.test(product.title) && !/(приспособлен|креплен|стойк|оснастк)/i.test(product.title))
    .map((product) => {
      const variant = product.variants.find((item) => item.price > 0) ?? product.variants[0];
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
