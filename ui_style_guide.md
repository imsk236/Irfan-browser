# UI Style Guide — Omani Manuscript Archive

A calm, Arabic first, research focused interface that feels intentional and institutionally credible. At first glance users should notice the manuscripts and data, not the UI. This guide fixes the small defaults so the design stays consistent and never drifts toward a generic dashboard look.

## Visual Character
- Minimal, quiet, archival, scholarly
- Arabic first, full RTL layout
- Strong typography and spacing instead of decoration
- Dense enough for serious data entry, never crowded
- Flat surfaces with subtle borders, not floating cards

## Color

Core palette derived from the logo:

| Role | Name | Value |
|------|------|-------|
| Primary, navigation | Deep olive | `#354E24` |
| Highlight, selected, success | Leaf green | `#7E9E36` |
| Page background | Warm ivory | `#F7F5EF` |
| Surface | White | `#FFFFFF` |
| Text | Charcoal | `#22251F` |
| Border | Muted border | `#D9DDD3` |

Semantic colors, kept earthy so they sit inside the palette:

| Role | Value |
|------|-------|
| Error, destructive | `#9B3D2E` (clay red) |
| Warning | `#B5832E` (warm amber) |
| Info | `#4A5A66` (muted slate) |

Rules:
- Olive for navigation and primary actions only.
- Leaf green only for highlights, selected states, and success.
- Never use two strong colors in the same area competing for attention.

## Spacing

All spacing comes from this fixed scale. Never use values outside it.

`4 · 8 · 12 · 16 · 24 · 32 · 48` (pixels)

Use space between sections, not a card around every section. This rule does more for a calm look than any color choice.

## Typography

One high quality Arabic UI font: **IBM Plex Sans Arabic** or **Noto Sans Arabic**.

| Use | Size | Notes |
|-----|------|-------|
| Page title | 26–30px | |
| Body | 15–16px | line height 1.7–1.8 |
| Labels, table text | 14px | |

- Avoid very bold Arabic text. Use weight and spacing carefully.
- Use tabular numerals for serials and dates.
- Cap reading text width around 70 characters so long annotation notes do not run edge to edge.

## Layout
- Fixed right side navigation for primary sections
- Main content on a clear 12 column grid
- Maximum content width around `1280px`
- Forms use one or two columns only
- Keep titles, actions, filters, and results in predictable positions
- Never center forms

## Borders and Elevation
- Separate everything with borders and space, not shadows.
- Shadows are not used anywhere except the side panel and unavoidable dropdowns.
- Border radius: `6–8px`.

## Components
- **Buttons:** compact, solid, text led. No gradients, no shadows. One primary action per screen.
- **Inputs:** clear labels above the field, visible borders, strong focus state.
- **Tables:** the default for records and search results.
- **Cards:** only for summaries, warnings, or grouped scholar results.
- **Icons:** simple outline icons, always paired with an Arabic label.
- **Dropdowns and search:** must support fast keyboard entry.

## States

Define these once, globally, and apply them identically everywhere. Inconsistent states are the clearest sign of generated UI.

| State | Treatment |
|-------|-----------|
| Hover | Slight background tint, no movement |
| Focus | Strong visible outline, olive, for keyboard use |
| Active | Pressed background, no shadow |
| Selected | Leaf green marker or tint |
| Disabled | Reduced contrast, no interaction |

## Confidence Display

Interpretation carries a confidence level and must show it in one scan line.

- Show it as a short text label (مؤكد، مرجّح، محتمل) or a small inline dot, never as a colored card.
- Keep it quiet. It informs, it does not decorate.
- Always link the claim back to its witness evidence.

## Data Entry
- Ask natural questions: **من المؤلف؟ من الناسخ؟ من المالك؟**
- Show person matches directly below the field.
- Keep "create new person" visually secondary to existing matches.
- Use progressive disclosure for optional details.
- Preserve entered data when validation fails.
- Show saved state quietly, no popups.

## Search and Trace Results
- Search dominates the scholar tracing screen.
- Group results by role using restrained headings, not colored cards.
- Show serial, work title, confidence, and evidence in one scan line.
- Open annotation evidence in a side panel to preserve context.
- Use filters only when they materially reduce results.

## Interaction Rules
- One primary action per screen.
- Destructive actions use text confirmation, in clay red.
- Avoid modal windows for routine entry. Prefer side panels for editing linked records.
- Empty states give direct guidance, not illustrations.
- Animations are nearly invisible: `120–180ms`.

## Brand Use
- Full logo on login, launch, and About screens.
- Small mark in the top navigation.
- Never repeat it as page decoration or watermark.

## Avoid
- Dashboard metric cards on every page
- Purple or blue SaaS gradients
- Excessive pill shaped controls
- Huge rounded panels
- Decorative charts with no research value
- Centered forms
- Floating action buttons
- Emoji
- Placeholder heavy layouts
- Generic headings such as "Welcome back"
- A separate card around every field

## Quality Test
The interface should resemble a refined archival research tool, not a startup landing page. The generic look comes from many small unconsidered defaults. Every rule here removes one of those defaults. When in doubt, choose the quieter option.
