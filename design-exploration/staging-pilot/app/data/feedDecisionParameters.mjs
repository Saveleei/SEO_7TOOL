const decimalPattern = String.raw`\d+(?:[.,]\d+)?`;

export function getFeedDecisionParameters(product, variant) {
  const rawParameters = Array.isArray(variant?.params) ? variant.params : [];
  const derived = product?.category === "sverla-i-zenkovki"
    ? deriveDrillParameters(product, variant)
    : product?.category === "truborezy"
      ? derivePipeCutterParameters(product, variant)
      : [];
  return mergeParameters(rawParameters, derived);
}

function deriveDrillParameters(product, variant) {
  const text = sourceText(product, variant);
  const parameters = [];
  const range = text.match(new RegExp(`[Ø⌀∅]\\s*(${decimalPattern})\\s*[-–—]\\s*(${decimalPattern})\\s*мм`, "iu"));
  const dimensions = text.match(new RegExp(`[Ø⌀∅]\\s*(${decimalPattern})\\s*[xх×]\\s*(${decimalPattern})(?:\\s*(?:/|[xх×])\\s*(${decimalPattern}))?\\s*мм`, "iu"));
  const taperDimensions = text.match(new RegExp(`к\\s*/\\s*х\\s*(?:d\\s*)?(${decimalPattern})\\s*[xх×]\\s*(${decimalPattern})(?:\\s*(?:/|[xх×])\\s*(${decimalPattern}))?\\s*мм`, "iu"));
  const diameter = dimensions?.[1]
    ?? taperDimensions?.[1]
    ?? (!range ? text.match(new RegExp(`[Ø⌀∅]\\s*(${decimalPattern})\\s*мм`, "iu"))?.[1] : undefined)
    ?? text.match(new RegExp(`к\\s*/\\s*х\\s*(?:d\\s*)?(${decimalPattern})\\s*мм`, "iu"))?.[1];
  const statedLength = dimensions?.[2] ?? taperDimensions?.[2];
  const overallLength = dimensions?.[3] ?? taperDimensions?.[3];

  if (range) {
    parameters.push(measurement("Минимальный диаметр", range[1]), measurement("Максимальный диаметр", range[2]));
  } else if (diameter) {
    parameters.push(measurement("Диаметр режущей части", diameter));
  }
  if (statedLength) parameters.push(measurement(overallLength ? "Рабочая длина" : "Длина по наименованию", statedLength));
  if (overallLength) parameters.push(measurement("Общая длина", overallLength));

  const shank = drillShank(text);
  if (shank) parameters.push({ name:"Хвостовик", value:shank, derivedFromTitle:true });
  const cuttingMaterial = drillCuttingMaterial(text);
  if (cuttingMaterial) parameters.push({ name:"Материал режущей части", value:cuttingMaterial, derivedFromTitle:true });
  const coating = drillCoating(text);
  if (coating) parameters.push({ name:"Покрытие", value:coating, derivedFromTitle:true });
  const standard = text.match(/(?:\bDIN\s*\d+[A-Z-]*|ГОСТ\s*\d+(?:-\d+)?)/iu)?.[0];
  if (standard) parameters.push({ name:"Стандарт", value:standard.replace(/\s+/gu, " ").trim(), derivedFromTitle:true });
  const setQuantity = /набор/iu.test(text) ? text.match(/\b(\d+)\s*шт\.?(?=$|\s|,)/iu)?.[1] : undefined;
  if (setQuantity) parameters.push({ name:"Количество в наборе", value:setQuantity, unit:"шт.", derivedFromTitle:true });
  return parameters;
}

function derivePipeCutterParameters(product, variant) {
  const text = sourceText(product, variant);
  const parameters = [];
  const explicitRange = text.match(new RegExp(`[Ø⌀∅]\\s*(${decimalPattern})\\s*[-–—]\\s*(${decimalPattern})\\s*мм`, "iu"));
  const contextualRange = text.match(new RegExp(`(?:для\\s+)?труб(?:ы|ам|ах)?[^\\d]{0,32}(${decimalPattern})\\s*[-–—]\\s*(${decimalPattern})\\s*мм`, "iu"));
  const rawRange = rawTubeRange(variant);
  const range = explicitRange ?? contextualRange ?? rawRange;
  if (range) {
    parameters.push(measurement("Мин. диаметр труб", range[1]), measurement("Макс. диаметр труб", range[2]));
  }
  const drive = /пневмопривод|пневматическ/iu.test(text)
    ? "Пневматический"
    : /гидропривод|гидравлическ/iu.test(text)
      ? "Гидравлический"
      : /электропривод|электрическ/iu.test(text)
        ? "Электрический"
        : undefined;
  if (drive) parameters.push({ name:"Тип привода", value:drive, derivedFromTitle:true });
  const control = /автоматическ/iu.test(text) ? "Автоматическое" : /ручн/iu.test(text) ? "Ручное" : undefined;
  if (control) parameters.push({ name:"Управление", value:control, derivedFromTitle:true });
  if (/фаскосним|снят(?:ие|ия) фаск|резк[аи].*фаск/iu.test(text)) {
    parameters.push({ name:"Возможности", value:"Резка и снятие фаски", derivedFromTitle:true });
  }
  return parameters;
}

function rawTubeRange(variant) {
  for (const parameter of variant?.params ?? []) {
    if (!/диапазон\s+труб/iu.test(String(parameter?.name ?? ""))) continue;
    const match = String(parameter?.value ?? "").match(new RegExp(`(${decimalPattern})\\s*[-–—]\\s*(${decimalPattern})`, "u"));
    if (match) return match;
  }
  return undefined;
}

function sourceText(product, variant) {
  return [variant?.name, product?.title].filter(Boolean).join(" ");
}

function measurement(name, value) {
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  return { name, value:Number.isFinite(parsed) ? String(parsed) : String(value), unit:"мм", derivedFromTitle:true };
}

function drillShank(text) {
  const morse = text.match(/[КK]М\s*([1-6])\b/iu)?.[1];
  if (morse) return `КМ${morse}`;
  const weldon = text.match(/\bWeldon\s*(\d+(?:[.,]\d+)?)\b/iu)?.[1];
  if (weldon) return `Weldon ${weldon.replace(",", ".")}`;
  if (/ц\s*\/\s*х/iu.test(text)) return "Цилиндрический";
  if (/к\s*\/\s*х|\bDIN\s*345\b/iu.test(text)) return "Конический";
  return undefined;
}

function drillCuttingMaterial(text) {
  const patterns = [
    [/\bHSSE[-\s]?Co\s*8\b/iu, "HSSE-Co8"],
    [/\bHSS[-\s]?Co\s*8\b/iu, "HSS-Co8"],
    [/\bHSSE[-\s]?Co\s*5\b/iu, "HSSE-Co5"],
    [/\bHSS[-\s]?Co\s*5\b/iu, "HSS-Co5"],
    [/\bHSS[-\s]?XE\b/iu, "HSS-XE"],
    [/\bHSSE\b/iu, "HSSE"],
    [/\bHSS\b/iu, "HSS"],
    [/Р6М5К5/iu, "Р6М5К5"],
    [/Р6М5/iu, "Р6М5"],
    [/твердосплав|тверд(?:ый|ого)\s+сплав/iu, "Твёрдый сплав"],
  ];
  return patterns.find(([pattern]) => pattern.test(text))?.[1];
}

function drillCoating(text) {
  if (/\bTiN[-\s]?GOLD\b/iu.test(text)) return "TiN-GOLD";
  if (/\bTiN\b/iu.test(text)) return "TiN";
  return undefined;
}

function mergeParameters(rawParameters, derivedParameters) {
  const merged = [...rawParameters];
  for (const parameter of derivedParameters) {
    if (merged.some((candidate) => parameterNamesOverlap(candidate.name, parameter.name))) continue;
    merged.push(parameter);
  }
  return merged;
}

function parameterNamesOverlap(first, second) {
  const left = normalize(first);
  const right = normalize(second);
  if (left === right) return true;
  if (/^(?:хвостовик|тип хвостовика)$/u.test(left) && /^(?:хвостовик|тип хвостовика)$/u.test(right)) return true;
  if (/^мин\. диаметр труб/u.test(left) && /^мин\. диаметр труб/u.test(right)) return true;
  if (/^макс\. диаметр труб/u.test(left) && /^макс\. диаметр труб/u.test(right)) return true;
  return false;
}

function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/\s+/gu, " ");
}
