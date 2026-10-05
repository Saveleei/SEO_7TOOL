# SEO Semantic Map

| Demand cluster | Intent | Правильный тип страницы | Пример | Правило |
|---|---|---|---|---|
| Transactional | купить/цена/заказать | category/product | купить магнитный сверлильный станок | один canonical commercial page |
| Category | ассортимент класса | category | сверлильные станки | category is hub; не дублировать article |
| Product/model | точная модель | product | LENZ STEYR-35 цена | только fact-driven product page |
| Brand | ассортимент производителя | brand hub | станки LENZ | 87 data-backed hubs; не публиковать пустые/случайные бренды |
| Brand × category | узкий commercial | curated landing | магнитные станки LENZ | только при ассортименте + отдельном спросе |
| Attribute | подбор по параметру | curated category landing или filter | станок Weldon 19 | filter остаётся noindex до approval |
| Application | решение задачи | task landing / guide | станок для монтажа металлоконструкций | связывать с подходящими категориями |
| Comparison | commercial investigation | comparison guide/tool | HSS или TCT | факты, ограничения, links to products |
| Problem/solution | mixed | expert guide | чем просверлить 50 мм | answer first, затем подбор |
| Informational | learn | article/glossary | что такое Weldon 19 | не каннибализировать commercial page |
| Compatibility | exact relation | product/accessory graph | коронка для Weldon 19 | публиковать только подтверждённые связи |

## Priority graph

1. Category → product → compatible/alternative product.
2. Task landing → category/family → product.
3. Brand hub → brand categories → products.
4. Guide → relevant category + representative products; category → 2–4 best guides.

Programmatic pages допустимы только при: distinct intent, достаточном ассортименте, уникальном useful block, crawl budget limit, canonical self-reference and inclusion in an ownership registry.

## Meta keywords ownership

`meta keywords` используется как дополнительный контролируемый сигнал для Яндекса, а не как замена Title, Description, H1, текста, внутренних ссылок и поведенческих факторов.

- Главная и каталог получают только общие коммерческие кластеры уровня сайта.
- Родительская категория получает общий класс товара и коммерческий интент `купить/цена`.
- Подкатегория получает только свой узкий тип, признак или сценарий применения.
- Брендовая страница получает брендовые коммерческие сочетания и сочетания `бренд × категория`.
- Карточка товара получает точное название, сочетание `бренд + модель/артикул`, модель/артикул и коммерческие модификаторы.
- Страницы с фильтрами, поисковыми параметрами, конфликтными данными и прочими состояниями `noindex` не получают `meta keywords`.
- Ввод посетителя и query string никогда не используются для построения тега.
- На странице допускается не более шести нормализованных фраз общей длиной до 420 символов.

Для `/c/stanki-sverlilnye` закреплён общий кластер: `сверлильные станки по металлу`, `сверлильные станки`, `промышленные сверлильные станки`, `станки для сверления металла`, `купить сверлильные станки по металлу`, `сверлильные станки по металлу цена`. Интенты `магнитные`, `стационарные`, `реверсивные`, `резьбонарезные`, `Weldon 19` и `бесщёточные` принадлежат отдельным посадочным страницам и исключены из родителя.
