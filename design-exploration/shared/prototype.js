const params = new URLSearchParams(window.location.search);
if (params.get("gray") === "1") document.documentElement.classList.add("grayscale");
if (params.get("brand") === "0") document.documentElement.classList.add("brandless");

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.querySelectorAll("form").forEach((form) => {
  form.addEventListener("submit", (event) => event.preventDefault());
});
