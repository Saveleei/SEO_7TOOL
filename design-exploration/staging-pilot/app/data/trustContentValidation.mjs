const CARD_IDS = ["applicability", "documents", "terms", "picking", "dispatch", "selection"];
const LEGACY_CARD_IDS = CARD_IDS.slice(0, 3);
const ASSET_PATTERN = /^trust-[0-9a-f]{64}\.(?:png|jpg|webp)$/u;

export function validateTrustContentSettings(input) {
  const revision = integer(input?.revision, 0, Number.MAX_SAFE_INTEGER);
  if (revision == null) return fail("Обновите страницу и повторите сохранение.");

  const sectionEyebrow = text(input?.sectionEyebrow, 70);
  const sectionTitle = text(input?.sectionTitle, 110);
  const sectionIntro = text(input?.sectionIntro, 320);
  if (sectionEyebrow.length < 3 || sectionTitle.length < 5 || sectionIntro.length < 10) return fail("Заполните заголовок и пояснение блока доверия.");

  if (!Array.isArray(input?.cards) || (input.cards.length !== CARD_IDS.length && input.cards.length !== LEGACY_CARD_IDS.length)) return fail("Блок доверия должен содержать шесть фотосюжетов.");
  const expectedIds = input.cards.length === LEGACY_CARD_IDS.length ? LEGACY_CARD_IDS : CARD_IDS;
  const cards = [];
  for (let index = 0; index < expectedIds.length; index += 1) {
    const raw = input.cards[index];
    const id = text(raw?.id, 30).toLocaleLowerCase("ru-RU");
    if (id !== expectedIds[index]) return fail("Состав и порядок карточек доверия изменены. Обновите страницу.");
    const card = {
      id,
      kicker:text(raw?.kicker, 60),
      title:text(raw?.title, 100),
      text:text(raw?.text, 300),
      outcome:text(raw?.outcome, 170),
      imageAssetId:text(raw?.imageAssetId, 90).toLocaleLowerCase("ru-RU"),
      imageAlt:text(raw?.imageAlt, 160),
    };
    if (card.kicker.length < 2 || card.title.length < 4 || card.text.length < 10 || card.outcome.length < 6 || card.imageAlt.length < 5) return fail(`Заполните все текстовые поля карточки «${card.title || index + 1}».`);
    if (card.imageAssetId && !ASSET_PATTERN.test(card.imageAssetId)) return fail("Загруженное изображение указано некорректно.");
    cards.push(card);
  }

  return { ok:true, value:{ revision, sectionEyebrow, sectionTitle, sectionIntro, cards } };
}

function integer(value, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

function text(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, max);
}

function fail(message) {
  return { ok:false, message };
}
