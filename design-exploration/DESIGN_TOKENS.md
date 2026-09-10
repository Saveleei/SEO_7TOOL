# 7TOOL design tokens

These are direction-ready tokens for the recommended hybrid, not production code.

## Color

```css
:root {
  --color-signal: #ff5a00;
  --color-ink: #0b0b0b;
  --color-gray-900: #161616;
  --color-gray-800: #262626;
  --color-gray-700: #3a3a3a;
  --color-gray-600: #565656;
  --color-gray-500: #737373;
  --color-gray-400: #a0a0a0;
  --color-gray-300: #cacaca;
  --color-gray-200: #e3e3e3;
  --color-gray-100: #f1f1ef;
  --color-gray-50: #f8f8f6;
  --color-white: #ffffff;
  --color-success: #0a6b43;
  --color-warning: #865100;
  --color-danger: #b42318;
}
```

## Typography

```css
:root {
  --font-display: "Golos Text", Arial, sans-serif;
  --font-body: "Golos Text", Arial, sans-serif;
  --font-technical: "IBM Plex Mono", monospace;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-extrabold: 800;
}
```

Type styles:

| Token | Desktop | Mobile | Weight |
|---|---|---|---:|
| `display-1` | 72/70 | 44/43 | 800 |
| `heading-1` | 48/50 | 34/37 | 800 |
| `heading-2` | 40/43 | 30/34 | 700 |
| `heading-3` | 24/29 | 21/26 | 700 |
| `card-title` | 19/25 | 17/23 | 600 |
| `body-lg` | 18/28 | 17/26 | 400 |
| `body` | 16/24 | 16/24 | 400 |
| `ui` | 14/20 | 14/20 | 600 |
| `meta` | 12/16 | 12/16 | 500 |
| `technical` | 12/16 | 12/16 | 500 mono |
| `price` | 32/34 | 28/31 | 800 |

## Spacing

Base 4 px. Only these values are allowed unless a documented optical exception is required.

| Token | Value |
|---|---:|
| `space-1` | 4 px |
| `space-2` | 8 px |
| `space-3` | 12 px |
| `space-4` | 16 px |
| `space-6` | 24 px |
| `space-8` | 32 px |
| `space-12` | 48 px |
| `space-16` | 64 px |
| `space-24` | 96 px |
| `space-32` | 128 px |

Recommended application:

- Inline label gap: 8 px.
- Control internal padding: 12/16 or 16/20 px.
- Card body: 20–24 px desktop, 16 px mobile.
- Grid gap: 16–24 px desktop, 10–16 px mobile.
- Major section: 96 px desktop, 64 px mobile.
- Hero top/bottom: 96–128 px desktop, 56–72 px mobile.

## Grid and width

- Desktop: 12 columns.
- Tablet: 8 columns.
- Mobile: 4 columns.
- Recommended max content width: **1344 px** for dense catalog and **1312 px** for editorial/product pages; use a shared outer alignment.
- Outer gutter: 32 px at 1280, fluid to a centered max width, 16 px at 390.
- Catalog card columns: 4 at 1280–1920, 3 when a 240–272 px filter rail is visible, 2 on tablet, 1 composed split-card at 390.

Measured prototype verification:

| Viewport | A container | B container | C container | Overflow |
|---:|---:|---:|---:|---|
| 1280 | 1201 px | 1201 px | 1201 px | None |
| 1440 | 1312 px | 1344 px | 1320 px | None |
| 1600 | 1312 px | 1344 px | 1320 px | None |
| 1920 | 1312 px | 1344 px | 1320 px | None |
| 390 | 358 px content in exact 390 px capture | same | same | None |

The max width prevents sparse 1600/1920 layouts while retaining strong outer margins. Hero and proof imagery may use full-bleed section backgrounds, but content remains aligned to the grid.

## Radius and borders

```css
--radius-none: 0;
--radius-sm: 2px;
--radius-control: 3px;
--radius-card: 4px;
--border-hairline: 1px;
--border-emphasis: 2px;
```

No pills except real status tags with short content. No radius above 8 px in the commercial UI.

## Shadows

- Default surfaces: no shadow; use a 1 px neutral divider.
- Product grounding: `0 16px 28px rgba(11,11,11,.10)` or equivalent drop shadow around the isolated subject.
- Floating overlays/drawers only: `0 18px 50px rgba(11,11,11,.18)`.
- No colored, glowing, or multilayer decorative shadows.

## Motion

| Token | Value | Use |
|---|---:|---|
| `motion-fast` | 150 ms | Hover, underline, icon state |
| `motion-base` | 200 ms | Menu, image scale, control transition |
| `motion-slow` | 250 ms | Drawer, selected cut reveal |
| `ease-standard` | `cubic-bezier(.2,.8,.2,1)` | Default |

Image hover is capped at `scale(1.02)`. Respect `prefers-reduced-motion`.

## Control sizing

- Desktop compact control: 40 px.
- Default action/search: 48 px.
- Mobile touch target: minimum 44 × 44 px.
- Search: full tool-like field, never under 280 px desktop; full width on mobile.
- Primary action: one orange control per action group.
- Secondary: white/graphite outline.
- Tertiary: text link or icon with visible label where meaning is not universal.

## Image stages

- Card media: 4:5, warm gray-50/100.
- Gallery main: 1:1, warm gray-50.
- Category: 4:3 or 3:2 by span.
- Hero: controlled cut, one subject, 65–82% visible bounds.

## Form system

- Labels always visible; placeholders supplement rather than replace them.
- Field height 48 px; textarea minimum 120 px.
- Related fields share one unboxed section; avoid a card around every field group.
- Error is text + icon + red, never color alone.
- Quote form progress is expressed by content and heading, not ornamental steps.
