const configuredId = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || "109097461");

/**
 * Public counter id. The verified project counter is the safe fallback so a
 * missing build-time NEXT_PUBLIC variable cannot silently remove Metrika.
 */
export const YANDEX_METRIKA_ID = Number.isInteger(configuredId) && configuredId > 0
  ? configuredId
  : 109097461;

export const YANDEX_ECOMMERCE_LAYER = "dataLayer";
