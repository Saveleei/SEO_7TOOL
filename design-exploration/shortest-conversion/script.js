const productImage = "../assets/lenz-steyr-35.jpg";

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function resultMarkup(query) {
  const exact = /steyr|35/i.test(query);
  const title = exact ? "Магнитный сверлильный станок LENZ STEYR-35" : `Результаты для «${escapeHTML(query)}»`;
  const code = exact ? "Точное совпадение · LENZ · STEYR-35" : "Подходящие товары и категории";
  return `
    <div class="result-top"><b>${code}</b><a href="#stock">Все результаты →</a></div>
    <div class="result-product">
      <img src="${productImage}" alt="">
      <div><a class="result-title" href="#product">${title}</a><span class="result-spec">Ø35 мм · Weldon 19 · 1 100 Вт</span><span class="result-stock">В наличии · отгрузка сегодня</span></div>
      <div class="result-price"><b>47 999 ₽</b><span>с НДС</span></div>
      <button class="result-buy" type="button">В корзину</button>
    </div>`;
}

document.querySelectorAll(".find-shell").forEach((shell) => {
  const form = shell.querySelector(".find-form");
  const input = shell.querySelector(".find-input");
  const result = shell.querySelector(".instant-result");
  const show = () => {
    const query = input.value.trim();
    if (query.length < 2) {
      result.hidden = true;
      return;
    }
    result.innerHTML = resultMarkup(query);
    result.hidden = false;
    const buy = result.querySelector(".result-buy");
    buy.addEventListener("click", () => {
      buy.textContent = "Добавлено ✓";
      buy.classList.add("added");
    });
  };
  input.addEventListener("input", show);
  input.addEventListener("focus", show);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    show();
  });
});

document.querySelectorAll("[data-query]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.querySelector(".hero-find .find-input");
    input.value = button.dataset.query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  });
});

const taskCounts = {
  "Сверление металла": "64 модели",
  "Обработка кромки": "48 моделей",
  "Резка труб": "36 моделей",
  "Автоматизация сварки": "15 решений"
};

document.querySelectorAll(".task").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".task").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    document.getElementById("task-title").textContent = button.dataset.task;
    document.getElementById("result-count").textContent = taskCounts[button.dataset.task];
  });
});

document.querySelectorAll(".diameters button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".diameters button").forEach((item) => item.setAttribute("aria-pressed", "false"));
    button.setAttribute("aria-pressed", "true");
  });
});

document.querySelectorAll("form").forEach((form) => {
  if (!form.classList.contains("find-form")) form.addEventListener("submit", (event) => event.preventDefault());
});
