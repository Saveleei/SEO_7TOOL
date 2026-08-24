const API = "https://platform-api2.max.ru";
const token = process.env.MAX_BOT_TOKEN?.trim();

if (!token) {
  console.error("MAX_BOT_TOKEN не задан. Добавьте токен в .env.production и повторите команду.");
  process.exit(1);
}

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: token,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    throw new Error(`MAX API HTTP ${response.status}: ${typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

try {
  const me = await api("/me");
  console.log(`Бот доступен: ${me.name || me.username || "без имени"} (ID ${me.user_id})`);

  if (process.argv.includes("--send-test")) {
    const chatId = process.env.MAX_CHAT_ID?.trim();
    const userId = process.env.MAX_USER_ID?.trim();
    const recipient = chatId ? ["chat_id", chatId] : userId ? ["user_id", userId] : null;
    if (!recipient) throw new Error("Для теста задайте MAX_CHAT_ID или MAX_USER_ID");
    const query = new URLSearchParams({ [recipient[0]]: recipient[1] });
    await api(`/messages?${query}`, {
      method: "POST",
      body: JSON.stringify({ text: "✅ 7TOOL: тестовые уведомления MAX работают", notify: true }),
    });
    console.log("Тестовое уведомление отправлено.");
    process.exit(0);
  }

  const result = await api("/updates?limit=100&timeout=0");
  const updates = Array.isArray(result?.updates) ? result.updates : [];
  if (!updates.length) {
    console.log("Событий пока нет. Откройте бота в MAX, нажмите «Начать» и сразу повторите npm run max:setup.");
    process.exit(0);
  }

  const candidates = [];
  for (const update of updates) {
    const userId = update?.user?.user_id ?? update?.message?.sender?.user_id;
    const chatId = update?.chat_id ?? update?.message?.recipient?.chat_id;
    if (userId != null) candidates.push({ type: "MAX_USER_ID", id: String(userId), event: update.update_type });
    if (chatId != null) candidates.push({ type: "MAX_CHAT_ID", id: String(chatId), event: update.update_type });
  }
  const unique = [...new Map(candidates.map((item) => [`${item.type}:${item.id}`, item])).values()];
  if (!unique.length) {
    console.log("Последнее событие не содержит ID получателя. Напишите боту сообщение и повторите команду.");
  } else {
    console.log("Найдены получатели (добавьте нужную строку в .env.production):");
    for (const item of unique) console.log(`${item.type}=${item.id}  # событие ${item.event}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
