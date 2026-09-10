# 7TOOL product image standard

Product photography is a catalog-quality system, not decoration. Every source image is classified before use; mixed formats are normalized at presentation time and flagged for asset replacement when quality is insufficient.

## A — Catalog

| Attribute | Standard |
|---|---|
| Background | White `#FFFFFF` or warm light gray `#F1F1EF`; one background per listing |
| Crop | Entire product visible; no cut handles, cables, bases, or tooling |
| Camera angle | Preferred three-quarter front; front/side allowed when technically clearer |
| Lighting | Soft, neutral, readable material texture; no crushed black housings |
| Shadow | Soft contact shadow only, 8–16% opacity, 12–24 px visual blur |
| Contrast | Product fully separated from field; preserve black and metallic detail |
| Padding | Subject bounds occupy 68–78% of image stage; 10–14% safe area |
| Product scale | Normalize by visible bounding box and class, not source canvas size |
| Allowed environment | None; isolated product only |
| Forbidden effects | Gradient halo, glow, reflection floor, dramatic vignette, manufacturer badge collage, watermark |

Class-specific alignment:

- Vertical machines: common baseline, optical center at 52% image width.
- Horizontal tooling: common horizontal center, at least 8% end clearance.
- Circular tooling: center by geometry, normalize diameter to 68–74% of stage.
- Large cells/robots: full base visible; allow 6–10% more breathing room.

## B — Hero

| Attribute | Standard |
|---|---|
| Background | Controlled light neutral or one dark graphite field; never a generic orange panel |
| Crop | Product may approach or cross one edge if no critical functional part is lost |
| Camera angle | Three-quarter, slightly low or eye-level; geometry must remain credible |
| Lighting | Directional but realistic; clean edge definition on dark parts |
| Shadow | Grounding shadow or real environmental shadow; no floating object |
| Contrast | High subject separation with retained material detail |
| Padding | 6–14% around the subject, adapted to the signature cut |
| Product scale | 65–82% of the visual field; one dominant product |
| Allowed environment | Controlled workshop/metal surface, architectural factory context, neutral studio |
| Forbidden effects | Sparks, smoke overlays, neon, speed blur, fake blueprints, composite tool piles |

## C — Application

| Attribute | Standard |
|---|---|
| Background | Real production environment with readable context and controlled clutter |
| Crop | Show tool, workpiece, and action relationship; operator only when informative |
| Camera angle | Observer or operator perspective; avoid heroic automotive angles |
| Lighting | Available industrial light corrected for color; protect highlight detail on metal |
| Shadow | Natural only |
| Contrast | Subject/action clearly dominant; background one stop quieter where possible |
| Padding | Editorial; reserve clean space only when copy is intentionally planned |
| Product scale | Equipment and processed metal together occupy at least 55% of frame |
| Allowed environment | Workshop, fabrication line, field installation, warehouse, QA bench |
| Forbidden effects | Staged stock-worker smiles, unsafe PPE, impossible sparks, visibly composited equipment, unrelated factory |

## D — Detail / Macro

| Attribute | Standard |
|---|---|
| Background | Dark neutral, light neutral, or real metal/workpiece surface |
| Crop | Intentionally close: edge, flute, tooth, weld, spindle, bearing, control, machined finish |
| Camera angle | Perpendicular for evidence; grazing angle for surface/material detail |
| Lighting | Raking controlled light that reveals geometry and finish |
| Shadow | Natural micro-shadow; never a heavy ecommerce drop shadow |
| Contrast | High local contrast without HDR halos or oversharpening |
| Padding | 4–10%; macro subject may intentionally leave frame |
| Product scale | Detail occupies 65–95% of frame |
| Allowed environment | Actual machine/workpiece context |
| Forbidden effects | Abstract metal textures with no product meaning, fake sparks, extreme color grading |

## Aspect ratios

- Product card: `4:5` media stage; source is contained, never distorted.
- Category card: `4:3` or `3:2` depending on span; a single class per row.
- Product gallery: `1:1` primary stage; thumbnails `1:1`.
- Hero: desktop `6:5` visual zone; mobile `4:5`.
- Application/editorial: `16:9` wide or `4:3` documentary.
- Detail: `1:1` or `4:3`.

## Normalization pipeline

1. Read source dimensions, alpha, background, and visible subject bounds.
2. Assign image class: vertical machine, horizontal tool, circular tool, large equipment, detail, or application.
3. Remove only accidental empty canvas; never erase real cables, accessories, or contact shadows.
4. Place subject into the standard stage by visible bounds and class baseline.
5. Apply a consistent neutral background when transparent; treat white-background JPEGs with a matching white field.
6. Apply one shared contact-shadow recipe only when the source lacks grounding.
7. Export responsive AVIF/WebP plus source-quality fallback; preserve at least 2× rendered dimensions.
8. Flag, do not cosmetically hide, inadequate source assets.

## Automated rejection flags

- Long edge below 900 px for primary product/gallery use.
- Effective subject occupies below 38% or above 94% of source canvas.
- Visible watermark, manufacturer promo copy, badge, border, or unrelated logo.
- Non-neutral background in a catalog image.
- Clipped functional part.
- Strong compression, blown highlights, crushed dark detail, or perspective distortion.
- Aspect ratio incompatible with class without destructive crop.

## Listing consistency rule

A single product listing must not visibly mix white background, warehouse photography, manufacturer renders, low-resolution images, and arbitrary aspect ratios. If source replacement is not immediately possible, place every asset inside the same neutral stage, normalize subject bounds, and label insufficient assets for content remediation.
