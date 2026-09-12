import Image from "next/image";

export function PilotFooter() {
  return (
    <footer className="footer">
      <div className="container footer-row">
        <Image src="/brand/7tool-inverse.svg" alt="7TOOL" width={135} height={42} />
        <p>Локальный тестовый пилот. Внешняя отправка заявок отключена.</p>
        <a href="mailto:info@7tool.ru">info@7tool.ru</a>
      </div>
    </footer>
  );
}
