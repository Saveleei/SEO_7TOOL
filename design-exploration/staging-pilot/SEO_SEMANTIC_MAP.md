# SEO Semantic Map

| Demand cluster | Intent | Правильный тип страницы | Пример | Правило |
|---|---|---|---|---|
| Transactional | купить/цена/заказать | category/product | купить магнитный сверлильный станок | один canonical commercial page |
| Category | ассортимент класса | category | сверлильные станки | category is hub; не дублировать article |
| Product/model | точная модель | product | LENZ STEYR-35 цена | только fact-driven product page |
| Brand | ассортимент производителя | curated brand hub | станки LENZ | запускать после brand model и unique value |
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
3. Approved brand hub → brand categories → products.
4. Guide → relevant category + representative products; category → 2–4 best guides.

Programmatic pages допустимы только при: distinct intent, достаточном ассортименте, уникальном useful block, crawl budget limit, canonical self-reference and inclusion in an ownership registry.
