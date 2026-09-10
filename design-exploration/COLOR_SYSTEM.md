# 7TOOL color system

## Core colors

| Token | Value | Role |
|---|---|---|
| `orange-500` | `#FF5A00` | Primary CTA, selected state, signature cut |
| `black` / `gray-950` | `#0B0B0B` | Primary text, major dark fields, footer |
| `white` | `#FFFFFF` | Main page and product surfaces |

## Neutral scale

| Token | Hex | Recommended use |
|---|---|---|
| `gray-950` | `#0B0B0B` | Headline, primary text, dark brand field |
| `gray-900` | `#161616` | Footer/header alternate dark |
| `gray-800` | `#262626` | Strong secondary text |
| `gray-700` | `#3A3A3A` | Body text |
| `gray-600` | `#565656` | Secondary body |
| `gray-500` | `#737373` | Metadata on light backgrounds |
| `gray-400` | `#A0A0A0` | Disabled text and quiet captions only |
| `gray-300` | `#CACACA` | Strong border / control outline |
| `gray-200` | `#E3E3E3` | Standard divider |
| `gray-100` | `#F1F1EF` | Image field / secondary surface |
| `gray-50` | `#F8F8F6` | Page section alternate |

The slightly warm 50/100 neutrals prevent a cold SaaS feeling and work with metal, graphite, black, and manufacturer product colors.

## Semantic colors

| Token | Hex | Role |
|---|---|---|
| `success-700` | `#0A6B43` | In stock, confirmed |
| `success-50` | `#EAF6EF` | Quiet success background |
| `warning-700` | `#865100` | Lead time, attention without error |
| `warning-50` | `#FFF4DB` | Quiet warning background |
| `danger-700` | `#B42318` | Form error, unavailable failure state |
| `danger-50` | `#FDECEA` | Error background |
| `info-700` | `#1F5EA8` | Rare informational links/status |

Semantic colors must never become brand decoration.

## Distribution

- 70–75% white and light neutral.
- 20–25% graphite/black, including type and selected large sections.
- 3–5% orange.

## Orange signal protocol

1. One dominant orange focal point per viewport.
2. Primary CTA uses orange with `#0B0B0B` text; do not use white normal-size text on orange.
3. Price is black by default. Discount is graphite. Availability is semantic green.
4. Icons are neutral unless the whole control is the primary action.
5. Decorative orange may appear only when the primary action is outside the same viewport or visually subordinate.

## Page recipes

- **Listing:** 74% white/light, 23% graphite/type, 3% orange. Orange only on the main card action or active filter—not both repeatedly.
- **Product page:** 72% light, 24% graphite/type, 4% orange. Cart or Quote is primary depending on commercial state.
- **Hero:** up to 30% dark field is acceptable; orange remains below 5% and marks one action plus a tiny cut edge.
- **Article:** 82% white/light, 16% text/graphite, 2% orange for section indices or one CTA.

## Accessibility notes

- Use `gray-700` or darker for normal body text on white.
- `gray-500` is metadata only at normal sizes.
- Orange never carries state alone; pair it with text, position, or shape.
- Focus uses a 2 px `#0B0B0B` outline plus a 2 px white offset on orange controls.
