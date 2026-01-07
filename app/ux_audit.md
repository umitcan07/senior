# UX/UI Audit & Fix Documentation

**Objective**: Transition the application from a "boxy", Card-heavy design to a minimalist, spacious, and modern interface inspired by ElevenLabs. Prioritize whitespace and typography over borders and containers.

## 1. Global Core Issues

- **Boxy Layouts**: Excessive use of the `Card` component for simple content grouping.
- **Heavy Borders**: Reliance on `border` and `bg-muted` to define sections.
- **Dense Grouping**: Elements are packed into containers rather than separated by whitespace.
- **Lack of "Air"**: Insufficient vertical rhythm between major sections.

## 2. Page-Specific Audit & Fixes

### 🏠 Home Page (`routes/index.tsx`)
- **Current**: Features are wrapped in `Card` components with 100% height.
- **Fix**: Remove `Card` wrapper. Use a clean grid layout.
  - **Action**: Replace `FeatureCard` implementation.
  - **Design**: Icon + Title + Description. No border, no background. Subtle hover effect on the *content group* (e.g. text color shift or icon scale), not a box shadow.

### 🎙️ Recording Page (`routes/practice/$textId.tsx`)
- **Current**:
  - Reference Voice: `border-2 border-primary/20 bg-primary/5` (Heavy box).
  - "Recent Attempts": Collapsible inside a container.
- **Fix**:
  - **Reference Voice**: Remove the box. Use a clean dropdown or minimalist list. If highlighting is needed, use a very subtle left border strip or just bold text.
  - **Recording UI**: Simplify the waveform container. Remove outer borders.
  - **Recent Attempts**: Display as a clean list table with simple dividers between rows, no outer container.

### 📊 Summary/Feed (`routes/summary.tsx`)
- **Current**:
  - `StatCard`: Each stat is in a box.
  - `CommonErrors`: Key metrics in a box.
  - `AttemptCard`: List of attempts where *every item* is a card. **(Critical "Boxy" Issue)**
- **Fix**:
  - **Stats**: Remove cards. Use a row of metrics separated by vertical dividers or simple spacing.
  - **Common Errors**: Minimalist tags/pills without a container card.
  - **Attempt List**: Convert to a flat list. Separation via `border-b` (hairline divider) or just whitespace. Hover state should be a subtle background overlay on the row.

### 📚 Learn Page (`routes/learn.tsx`)
- **Current**:
  - IPA items are "buttons" with background colors `bg-muted/20`.
  - Admin section is a gray box.
  - CTA is a gray box.
- **Fix**:
  - **IPA Grid**: Make items cleaner. Remove background color in default state, only show on hover. Use borderless grid.
  - **CTA**: Remove the gray box. Use a broad divider line and centered text, or a full-width minimal banner.

### ⚙️ Settings (`routes/settings.tsx`)
- **Current**: Generally clean, but uses dividers.
- **Fix**: Ensure consistent spacing. Ensure `AuthorSelector` uses the custom clean Select component.

## 3. Component & Design System Updates

### Divider Strategy
- **Old**: `Card` border.
- **New**: `div className="h-px bg-border/40"` (Subtle divider) or just `gap-8` / `gap-12`.

### Typography Strategy
- Increase `line-height` (leading) for body text to improve readability.
- Use `text-muted-foreground` for labels instead of colored badges where possible.

### Spacing Strategy
- Increase default section spacing from `gap-4` to `gap-8` or `gap-12`.
- "Dense UI" means information density, not cramped layout. Group related information tightly `gap-1`, but separate groups widely `gap-8`.

## 4. Implementation Plan

1. **Refactor `summary.tsx`**: High impact, currently very boxy. Convert Cards to List.
2. **Refactor `practice/$textId.tsx`**: Core workflow. De-box the reference selector and recording area.
3. **Refactor `index.tsx`**: Simple quick win.
4. **Refactor `learn.tsx`**: Clean up the grid.

---

*Verified against user feedback: "use less box, use divider or simply spacing", "modern ui with dense ui yet ample spacing".*
