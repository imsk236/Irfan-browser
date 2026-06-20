# UI Style Guide — Omani Manuscript Archive

This document is the visual and interaction source of truth for the desktop application. The target is a refined Arabic archival research tool: calm, dense, credible, and optimized for long research sessions. The interface should feel closer to a library catalog or scholarly desktop application than a generic dashboard.

The target reference is the approved scholar-tracing screen. All new screens must follow the same shell, spacing, typography, borders, interaction states, and information density.

---

## 1. Design principles

1. **Arabic first and RTL by default.** Layout, reading order, alignment, keyboard movement, panels, tables, and icons must be designed for RTL rather than mirrored after implementation.
2. **The research data is the visual focus.** Navigation, controls, and decoration remain quiet.
3. **Dense, not crowded.** Serious research work requires many records on screen, but every section must still have clear hierarchy and breathing room.
4. **Flat surfaces, fine borders, almost no shadows.** Use lines, spacing, and typography to create structure.
5. **One dominant task per screen.** Secondary tools remain available without competing with the main task.
6. **Evidence remains visible.** Whenever an interpretation is selected, its witness text, image location, confidence, and source should be easy to inspect without losing the current context.
7. **Generated UI patterns are not acceptable.** Avoid oversized cards, large empty areas, exaggerated rounded corners, floating action buttons, and decorative dashboard elements.

---

## 2. Visual character

The application should feel:

- archival
- scholarly
- institutional
- calm
- precise
- lightweight
- desktop-native
- trustworthy

It should not feel:

- like a startup landing page
- like a generic admin dashboard
- playful or decorative
- heavily branded
- card-heavy
- mobile-first stretched onto desktop

---

## 3. Design tokens

All screens must use shared tokens. Do not introduce arbitrary values inside individual components.

### 3.1 Color tokens

| Token | Purpose | Value |
|---|---|---|
| `--color-primary-700` | Primary action, active marker, important accent | `#526B2D` |
| `--color-primary-600` | Hover and selected emphasis | `#667F3A` |
| `--color-primary-100` | Selected row or active navigation tint | `#F1F4EA` |
| `--color-page` | Main application background | `#FAF9F5` |
| `--color-surface` | Panels, tables, forms, sidebar | `#FFFFFF` |
| `--color-surface-muted` | Quiet headers, filters, inactive areas | `#F7F6F2` |
| `--color-text` | Main Arabic text | `#252720` |
| `--color-text-muted` | Secondary labels and metadata | `#7D8076` |
| `--color-border` | Standard dividers and input borders | `#DDDED8` |
| `--color-border-strong` | Stronger structural dividers | `#C9CBC3` |
| `--color-danger` | Destructive actions and errors | `#9B3D2E` |
| `--color-warning` | Warnings | `#B5832E` |
| `--color-info` | Informational state | `#56636A` |

### 3.2 Color usage rules

- The primary olive is an **accent**, not a background for large application regions.
- The right navigation is white or warm-white, matching the target reference.
- The active navigation item uses a quiet tinted background and a narrow olive marker on the outer right edge.
- Primary buttons may use solid olive.
- Selected table tabs use an olive underline, not a filled pill.
- Confidence may use small olive and neutral dots, but color must never be the only meaning.
- Do not use gradients.
- Do not introduce bright blue, purple, teal, or neon colors.
- Never use two strong colors in the same local area.

### 3.3 Spacing tokens

Use only this spacing scale:

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48`

Suggested CSS variables:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 48px;
}
```

Do not use large empty areas to create hierarchy. Use clear section structure and controlled spacing.

### 3.4 Radius tokens

| Token | Value | Use |
|---|---:|---|
| `--radius-sm` | `4px` | table cells, compact controls |
| `--radius-md` | `6px` | inputs, buttons, dropdowns |
| `--radius-lg` | `8px` | larger grouped panels only |

Avoid pill-shaped controls unless the content is genuinely a compact status token.

### 3.5 Motion tokens

- Fast interaction: `120ms`
- Standard transition: `160ms`
- Maximum routine transition: `180ms`
- Use opacity and background-color transitions only.
- No bouncing, sliding cards, scaling, or decorative animation.

---

## 4. Typography

### 4.1 Font

Use one high-quality Arabic interface family throughout:

1. **IBM Plex Sans Arabic**, preferred
2. **Noto Sans Arabic**, fallback

System fallbacks may follow, but mixing multiple Arabic families inside the application is not allowed.

### 4.2 Type scale

| Use | Size | Weight | Line height |
|---|---:|---:|---:|
| Application/page title | `26px` | `600` | `1.4` |
| Section title | `18px` | `600` | `1.5` |
| Panel title | `16px` | `600` | `1.5` |
| Body | `15px` | `400` | `1.75` |
| Form label | `14px` | `500` | `1.6` |
| Table text | `14px` | `400` | `1.55` |
| Metadata/helper text | `12–13px` | `400` | `1.6` |

### 4.3 Typography rules

- Avoid extra-bold Arabic text.
- Page titles should be clear but not oversized.
- Use weight and spacing before increasing size.
- Long witness text should remain readable and should not stretch across the full window.
- Cap prose and annotation text at approximately 65–75 Arabic characters per line.
- Use tabular numerals for serials and dates.
- Serial numbers, file paths, and technical identifiers must use `dir="ltr"` to prevent hyphen reversal.
- LTR identifiers may remain right-aligned inside RTL forms.

---

## 5. Desktop application shell

The application shell is a fixed desktop layout based on the approved reference.

### 5.1 Global structure

From right to left:

1. **Primary navigation sidebar**
2. **Main research workspace**
3. **Optional filter or secondary tool panel** on the far left

A thin utility header spans the top above the workspace.

### 5.2 Recommended dimensions

| Region | Width / height |
|---|---|
| Utility header | `72–84px` high |
| Right navigation | `220–240px` wide |
| Left filter panel | `240–280px` wide |
| Evidence/detail lower panel | `280–340px` high when open |
| Main workspace | fills remaining width |
| Minimum supported viewport | `1180 × 720` |
| Preferred design viewport | `1440 × 900` or larger |

At widths below `1180px`, secondary filters may collapse into a side panel. The main navigation must not shrink into unreadable text.

### 5.3 Window and surface treatment

- Main app surface is white or warm-white.
- The page background may be warm ivory.
- Structural regions are separated with `1px` borders.
- Do not use a dark, full-height green sidebar.
- The application must not leave large unused empty columns when meaningful content is available.

---

## 6. Top utility header

The target reference includes a quiet, horizontal utility bar.

### 6.1 Contents

Right side:

- archive logo and Arabic product name
- optional English subtitle beneath the Arabic name

Center or left-center:

- active repository/library selector
- language selector
- contextual utility controls

Far left:

- user avatar or initials
- user name
- compact account menu

### 6.2 Rules

- Header background is white.
- Use vertical dividers between utility groups.
- Icons are small outline icons.
- Text remains muted unless interactive.
- The logo should not exceed approximately `150–180px` total width.
- The header must not compete visually with the page title.

---

## 7. Primary navigation sidebar

### 7.1 Appearance

- White background.
- Fixed to the right side.
- Thin left divider separating it from the workspace.
- Navigation items are vertically stacked with generous but controlled spacing.
- Each item has a simple outline icon and Arabic label.

### 7.2 Navigation item specification

- Height: `58–64px`
- Horizontal padding: `20–24px`
- Icon size: `22–26px`
- Gap between icon and label: `12–16px`
- Default text: muted charcoal
- Hover: subtle warm-gray tint
- Active: very light olive tint, olive text/icon, and `3px` right-edge marker
- No filled dark background
- No rounded card around each item

### 7.3 Bottom utilities

Settings and help may sit at the bottom of the navigation with the same item pattern but lower visual emphasis.

---

## 8. Page header and main task area

Every screen begins with a compact page header in the upper-right of the workspace.

### 8.1 Page header structure

- Page title
- One short explanatory sentence below it
- Primary task immediately beneath or aligned nearby

Example:

```text
تتبع العلماء
ابحث عن عالم، وتتبع أدواره في المخطوطات والتقييدات
```

### 8.2 Rules

- Page title should not exceed `30px`.
- Explanatory text uses muted color and smaller size.
- Avoid generic text such as “مرحبًا بك”.
- Do not wrap the header in a card.
- Main search or primary action should be visually connected to the page title.

---

## 9. Search and autocomplete

Search is the dominant control on the scholar-tracing screen.

### 9.1 Search field

- Full width of the main content column.
- Height: `44–48px`.
- Border: `1px solid var(--color-border)`.
- Focus border: primary olive.
- Search icon at the logical reading end.
- Clear button at the opposite end when populated.
- No oversized shadow.

### 9.2 Autocomplete panel

- Opens directly beneath the field.
- Same width as the field.
- White background with fine border.
- Maximum height approximately `240px`, then scroll.
- Each result shows the preferred name first and compact distinguishing metadata after it.
- Exact and stronger matches may use slightly stronger text weight.
- Keyboard navigation is required.
- “Create new person” is visually secondary and must appear only after existing candidates.

### 9.3 Match behavior

The interface must clearly distinguish:

- exact written-form match
- normalized match
- likely fuzzy match
- new-person action

The UI must never auto-merge identities.

---

## 10. Filter panel

The left filter panel is a quiet secondary region, not a competing sidebar.

### 10.1 Appearance

- White surface.
- Fine border around the panel.
- Width approximately `250px`.
- Compact heading with filter icon.
- Sections separated by spacing, not cards.

### 10.2 Controls

- Standard dropdown for repository/library.
- Paired date inputs for historical range.
- Compact checkboxes for roles.
- “Clear filters” action anchored near the bottom.

### 10.3 Rules

- Filter labels use muted text.
- Checkboxes use olive when selected.
- Date fields remain compact and aligned.
- Avoid chips and pill filters unless space constraints require them.
- The panel should not be taller than the visible workspace without internal scrolling.

---

## 11. Tabs and role grouping

Results are grouped by role using understated tabs.

### 11.1 Tab appearance

- Text-only tabs with counts in parentheses.
- Equal or content-based width depending on available space.
- Active tab uses olive text and a `2–3px` underline.
- Inactive tabs use muted text.
- No filled pills.
- No strong background blocks.

### 11.2 Behavior

- Tabs must preserve selected filters.
- Switching tabs should not reset search.
- Counts update with the current filter set.
- Keyboard navigation is required.

---

## 12. Tables and result lists

Tables are the default presentation for structured records.

### 12.1 Table specification

- Header height: `42–46px`
- Row height: `38–44px`
- Header background: white or very light muted surface
- Horizontal separators: `1px solid var(--color-border)`
- Vertical separators only where they materially improve scanning
- No zebra striping unless data density requires it
- Hover: very subtle background tint
- Selected row: light olive tint plus narrow right marker

### 12.2 Column behavior

For scholar trace results, columns should include:

- serial number
- work title
- confidence
- evidence count or evidence action

The serial number should be compact and rendered LTR. Work title receives the most flexible width.

### 12.3 Sorting

- Sorting indicator is a small outline chevron.
- Do not use oversized arrows.
- Sort state must remain visible but quiet.

### 12.4 Evidence action

Evidence should be shown as a compact icon plus count or short Arabic label. Opening evidence must preserve the current search and table context.

---

## 13. Confidence display

Confidence represents interpretation and must be readable in one scan.

Preferred pattern:

- Arabic text label: `عالية`, `متوسطة`, `منخفضة`
- Three small dots beside it
- Filled olive dots represent confidence strength
- Remaining dots use a neutral gray

Rules:

- Dots are supplemental; the text label is mandatory.
- Do not use large colored badges.
- Do not use red for low confidence unless it also indicates an actual error.
- Confidence must link back to evidence.

---

## 14. Lower evidence and editing workspace

The target layout uses the lower portion of the page for context-preserving evidence inspection and relationship editing.

### 14.1 Structure

The lower workspace may contain three adjacent regions:

1. **Role/person assignment form**
2. **Annotation metadata and witness text**
3. **Manuscript image preview**

### 14.2 Behavior

- Selecting a table result opens its evidence below without navigating away.
- The selected result remains visibly selected.
- The lower workspace may be collapsible.
- Resizing is optional, but fixed proportions must remain balanced.
- Unsaved edits must be protected before changing selection.

### 14.3 Person-role form

Ask natural questions:

- من المؤلف؟
- من الناسخ؟
- من المالك؟
- مذكور في موضع آخر؟

Each answer control:

- uses autocomplete
- prioritizes existing identities
- shows a quiet dropdown arrow
- does not expose database terminology such as “relationship record”

Primary save action:

- compact olive button
- positioned at the logical end of the form
- no modal confirmation after routine save

### 14.4 Annotation metadata

Display:

- annotation type
- witness text exactly as written
- date
- image position
- confidence
- source record

Witness text should be visually distinct from interpretation fields but not decorative. Use a full-width multiline field where editing is permitted.

### 14.5 Image preview

- Maintain manuscript aspect ratio.
- Use a neutral background.
- Provide previous/next navigation and current image count.
- No heavy frame or shadow.
- Zoom controls may appear on hover or in a compact toolbar.

---

## 15. Forms

### 15.1 General layout

- Labels always appear above or to the logical right of controls in a consistent RTL arrangement.
- Forms use one or two columns only.
- Long witness text always spans the full available width.
- Required fields are marked consistently.
- Optional detail uses progressive disclosure.
- Fields follow the researcher’s workflow, not database column order.

### 15.2 Dimensions

| Component | Standard size |
|---|---|
| Input/select height | `40–44px` |
| Textarea minimum height | `96px` |
| Primary button height | `40–44px` |
| Compact button height | `34–36px` |
| Label-to-input gap | `6–8px` |
| Field-to-field gap | `16px` |
| Section gap | `24–32px` |

### 15.3 Validation

- Validation appears directly beneath the relevant control.
- Entered values remain intact after validation failure.
- Technical exception text is never shown directly to the user.
- Errors should explain what happened and how to correct it.
- The first invalid field receives focus.

### 15.4 Generated values

Serial numbers and other generated identifiers:

- remain visible
- are clearly read-only
- use LTR rendering
- are never styled like editable inputs unless correction is explicitly permitted through component fields

---

## 16. Buttons and actions

### 16.1 Primary button

- Solid olive background
- White text
- Compact width based on label
- Radius `6px`
- No gradient or shadow
- One primary action per screen or local workflow

### 16.2 Secondary button

- White surface
- Standard border
- Charcoal text
- Olive border on hover/focus

### 16.3 Destructive action

- Clay-red text or border
- Requires clear text confirmation for irreversible actions
- Never placed directly beside the primary save action without separation

### 16.4 Icon buttons

- Use only when the meaning is universally clear
- Provide accessible Arabic labels
- Minimum hit area `36 × 36px`
- Avoid unlabeled icon-only actions for domain-specific functions

---

## 17. Component states

All states must be defined globally and reused.

| State | Treatment |
|---|---|
| Hover | Slight warm or olive tint, no movement |
| Focus | `2px` olive outline with `2px` offset |
| Active | Slightly darker pressed background, no shadow |
| Selected | Light olive tint and narrow right-edge marker |
| Disabled | Reduced contrast, no pointer interaction |
| Loading | Restrained skeleton rows or inline status |
| Saving | Disable repeat submission; show quiet inline status |
| Saved | Brief subtle confirmation, no popup |
| Error | Inline Arabic message with retry where appropriate |
| Empty | Short explanation plus direct next action |
| Unsaved | Warn before closing, navigating, or changing record |

Color must not be the sole indicator for any state.

---

## 18. Empty states

Empty states must explain both the condition and the next action.

Bad:

```text
لا توجد بيانات
```

Preferred:

```text
لا توجد مجلدات في جهة الحفظ هذه.
أضف المجلد الأول لبدء الفهرسة.
[إضافة مجلد]
```

Rules:

- No illustrations.
- No oversized icons.
- Keep empty states inside the relevant content region.
- Do not center the entire application around a small empty message when navigation and context should remain visible.

---

## 19. List-detail screens

Screens such as volumes, persons, and annotations should use a reusable list-detail pattern.

### 19.1 List panel

- Width: `320–380px`
- Own header and create action
- Search/filter controls when needed
- Scrolls independently
- Selected item uses light olive tint and right-edge marker
- Rows show only the most useful summary fields

### 19.2 Detail panel

- Fills remaining width
- Begins with compact record header
- Header groups title/serial, metadata, and edit action
- Related records appear as tables or structured sections
- Avoid large blank regions
- Editing should preferably occur in-place or in a side panel

---

## 20. Side panels and modals

### 20.1 Side panels

Use side panels for:

- editing linked records
- inspecting annotation evidence
- adding optional person details
- viewing source metadata without losing context

Specification:

- Opens from the left in RTL when it should not cover primary navigation
- Width: `420–520px`, maximum `45vw`
- White surface
- Single subtle shadow allowed
- Header remains fixed
- Actions remain visible at the bottom when the form is long

### 20.2 Modals

Use modals only for:

- destructive confirmation
- short blocking decisions
- rare system-level alerts

Routine data entry must not be placed inside nested modals.

---

## 21. Icons

- Use one consistent outline icon family.
- Stroke width should remain visually uniform.
- Standard size: `20–24px`.
- Navigation icons may use `24–26px`.
- Icons are paired with Arabic labels except for universally understood compact actions.
- Do not use emoji.
- Do not mix filled and outline icon families.

---

## 22. Accessibility

- All functionality must be keyboard accessible.
- Focus indication must never be removed.
- Text and controls must meet WCAG AA contrast.
- Inputs must have programmatically associated labels.
- Icon-only controls require accessible Arabic labels.
- Error messages should be announced to assistive technology.
- Tables must use proper header semantics.
- Autocomplete must expose active option and selection state.
- Color must not be the only indicator of role, confidence, status, or selection.

---

## 23. Responsive and window-resize behavior

This is a desktop-first application, but it must remain usable when resized.

### 23.1 Wide desktop: `1440px+`

- Full navigation
- Main workspace
- Left filter panel visible
- Lower evidence workspace visible when selected

### 23.2 Medium desktop: `1180–1439px`

- Navigation remains full width or reduces slightly
- Filter panel may narrow
- Table columns may hide secondary metadata
- Lower evidence sections may stack two-plus-one

### 23.3 Narrow desktop: below `1180px`

- Filter panel becomes a temporary side panel
- List-detail screens may become two-step navigation
- Primary navigation remains readable
- No horizontal page scrollbar

The application does not need a phone layout in v1.

---

## 24. Brand use

- Full logo appears in the top utility header, launch screen, and About screen.
- Logo is not repeated as decoration.
- No watermark.
- Branding remains secondary to research content.
- The English subtitle may appear beneath the Arabic product name at a much smaller size.

---

## 25. Prohibited patterns

Do not use:

- dark solid navigation occupying a large portion of the screen
- dashboard metric cards on every page
- purple or blue SaaS gradients
- excessive pills and badges
- huge rounded containers
- floating action buttons
- oversized empty areas
- centered forms
- centered application layouts when content is tabular or relational
- decorative charts without research value
- generic headings such as “Welcome back”
- a separate card around every field
- strong drop shadows
- animated page transitions
- inconsistent selected states
- unlabeled technical identifiers
- database terminology exposed directly in the UI

---

## 26. Implementation requirements

The frontend must define reusable primitives for:

- application shell
- top utility header
- navigation item
- page header
- search/autocomplete
- filter section
- role tabs
- data table
- confidence indicator
- empty state
- list-detail layout
- evidence workspace
- side panel
- input/select/textarea
- primary, secondary, and destructive buttons

Do not recreate these styles separately in each feature.

All component styling must consume shared design tokens. New hardcoded colors, spacing values, radii, shadows, or transition durations require an explicit update to this guide.

---

## 27. Acceptance checklist

A screen is visually acceptable only when all relevant statements are true:

- The interface is fully RTL.
- The right navigation is white and quiet, not a large dark block.
- The current section is visible through a tint and right-edge olive marker.
- The top utility header contains branding and contextual selectors without dominating the page.
- The page title, explanation, and main task form one clear hierarchy.
- The screen uses fine borders instead of floating cards.
- Main content uses available space without large meaningless gaps.
- Tables are compact and readable.
- Serial numbers render correctly in LTR.
- Search and autocomplete support keyboard use.
- Filters remain visually secondary.
- Confidence includes text, not color alone.
- Evidence can be inspected without losing search context.
- Empty states provide a next action.
- Focus states are visible.
- No arbitrary colors, spacing, shadows, or radii were introduced.
- The screen resembles the approved archival reference rather than the current generic prototype.

---

## 28. Final quality test

Before approving a screen, ask:

1. Does this look like a serious archival research application?
2. Is the scholar, manuscript, work, annotation, or evidence more visually important than the UI around it?
3. Can the researcher scan many records quickly?
4. Can the researcher understand the selected record and its evidence without navigating away?
5. Does the layout remain balanced at the target desktop size?
6. Is every state consistent with the rest of the application?
7. Would removing a border, card, color, or decoration make the screen clearer?

When uncertain, choose the quieter and more structured option.
