# Quill AI — Design System

> Single source of truth for visual language, component patterns, AI-state UX, and implementation guidance. Aligned with the 7 design trends shaping AI/web products in 2026.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Color Tokens](#2-color-tokens)
3. [Typography](#3-typography)
4. [Spacing & Layout](#4-spacing--layout)
5. [Component Layer](#5-component-layer)
6. [Animation System](#6-animation-system)
7. [AI-State UX (Streaming & Agent Patterns)](#7-ai-state-ux)
8. [Glassmorphism & Surface Hierarchy](#8-glassmorphism--surface-hierarchy)
9. [Mobile-First Rules](#9-mobile-first-rules)
10. [Design-to-Code Contract (Agent-Readable)](#10-design-to-code-contract)
11. [Trend Implementation Roadmap](#11-trend-implementation-roadmap)
12. [Governance](#12-governance)

---

## 1. Design Principles

### Core Values

| Principle                         | What it means for Quill                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Calm intelligence**             | The UI recedes so the AI's output is the hero. Minimal chrome, max content.                                    |
| **State transparency**            | Every AI operation (thinking, streaming, complete, failed) has a distinct, honest visual. Never fake progress. |
| **Durable by default**            | Sessions persist. UI reconnects. Users never lose context on page reload or tab close.                         |
| **Mobile-first, desktop-capable** | Touch targets, safe areas, and collapsed panels are the baseline — desktop expands on top.                     |
| **Agent-readable semantics**      | Token names, class names, and component structure are meaningful to both humans and coding agents.             |

---

## 2. Color Tokens

All tokens are defined as CSS custom properties in `src/app/globals.css` via Tailwind v4 `@theme`.

### Dark Theme (Default)

```css
/* Backgrounds */
--color-quill-bg: #0e1015 /* page root */ --color-quill-surface: #171a20 /* cards, panels, bubbles */
  --color-quill-surface-2: #1d2128 /* nested surfaces, hover states */ /* Borders */ --color-quill-border: #272b33
  /* default borders */ --color-quill-border-2: #343944 /* stronger borders, separators */ /* Accent (brand red) */
  --color-quill-accent: #ef4444 /* primary CTAs, active states, AI indicators */ --color-quill-accent-2: #f87171
  /* softer accent, gradient endpoint */ --color-quill-accent-glow: rgba(239, 68, 68, 0.15) /* glow backgrounds */
  /* Text */ --color-quill-text: #d4d4d8 /* primary readable text */ --color-quill-muted: #838387
  /* labels, meta, secondary text */ /* Semantic */ --color-quill-green: #34d399 /* success, complete */
  --color-quill-yellow: #fbbf24 /* warning, pending */ --color-quill-red: #ef4444 /* error, destructive */
  --color-quill-orange: #f87171 /* caution */;
```

### Light Theme (opt-in via `data-theme="light"` or `.light`)

```css
--color-quill-bg: #f5f3ed --color-quill-surface: #faf9f4 --color-quill-surface-2: #f0eee8 --color-quill-border: #e2dfd9
  --color-quill-border-2: #d6d3cd --color-quill-accent: #dc2626 --color-quill-accent-2: #ef4444
  --color-quill-text: #1a1a1a --color-quill-muted: #5c5c5c;
```

### Usage Rules

- **Never hardcode hex** in component files. Always use `quill-*` tokens.
- Accent color (`quill-accent`) is reserved for: primary buttons, active nav items, streaming indicators, AI "working" states.
- Use `quill-accent-glow` as a subtle background on AI-generated content to signal provenance.
- `quill-muted` for timestamps, labels, metadata — anything secondary to the content.

---

## 3. Typography

| Role                | Class / Token        | Weight  | Size        |
| ------------------- | -------------------- | ------- | ----------- |
| Base                | `font-sans` → Inter  | 400     | `14px`      |
| UI labels           | `text-xs`            | 400     | `12px`      |
| Meta/chips          | `text-[10px]`        | 500     | `10px`      |
| Headings            | `text-lg`–`text-2xl` | 600–700 | `18px–24px` |
| Code                | `font-mono`          | 400     | `13px`      |
| Gradient brand text | `.gradient-text`     | any     | any         |

```css
/* .gradient-text */
background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

**Rules:**

- Body text: `text-quill-text` on dark, `text-[#1a1a1a]` on light.
- Badges/chips: `tracking-[0.12em] uppercase text-[10px] font-medium` — consistent for all status tags.
- No custom font sizes outside the Tailwind scale except `10px`, `11px`, `13px` (established exceptions).

---

## 4. Spacing & Layout

### Surface Elevation Model

```
quill-bg (lowest) → quill-surface → quill-surface-2 (highest)
```

Use surface elevation to communicate depth/nesting, not shadows.

### Border Radius Scale

| Use                            | Radius                                                                 |
| ------------------------------ | ---------------------------------------------------------------------- |
| Input / text area container    | `rounded-2xl`                                                          |
| Message bubbles                | `rounded-2xl rounded-tl-sm` (AI) or `rounded-2xl rounded-tr-sm` (user) |
| Chips / badges                 | `rounded-full`                                                         |
| Cards / panels                 | `rounded-xl`                                                           |
| Small items (tool cards, tags) | `rounded-lg`                                                           |
| Icon buttons                   | `rounded-lg` or `rounded-full`                                         |

### Canvas / Workspace Layout

```
┌─ Sidebar (collapsible, 240px) ──┬─ Main Canvas ─────────────────┐
│ Navigation, chat history        │ Chat thread or artifact canvas │
│ Collapses to icon rail on mobile│ Mobile: full screen            │
└─────────────────────────────────┴────────────────────────────────┘
```

- Sidebar width: `w-60` (240px) desktop, hidden on mobile behind overlay.
- Chat input is always docked to bottom, sticky with `pb-safe` for iOS notch.
- Canvas header: dense on mobile (`h-10`), expanded on desktop (`h-12`).

---

## 5. Component Layer

All shared primitives live in `src/components/ui/`. Prefer these over raw HTML elements.

| Primitive   | File                | Notes                             |
| ----------- | ------------------- | --------------------------------- |
| Button      | `button.tsx`        | Variants: default, ghost, outline |
| Input       | `input.tsx`         |                                   |
| Textarea    | `textarea.tsx`      |                                   |
| Dialog      | `dialog.tsx`        |                                   |
| Select      | `select.tsx`        |                                   |
| Switch      | `switch.tsx`        |                                   |
| Card        | `card.tsx`          |                                   |
| Badge       | `badge.tsx`         | Use for status, tier, tags        |
| Sheet       | `sheet.tsx`         | Mobile drawers / overlays         |
| Dropdown    | `dropdown-menu.tsx` |                                   |
| Tabs        | `tabs.tsx`          |                                   |
| Separator   | `separator.tsx`     |                                   |
| ScrollArea  | `scroll-area.tsx`   | Use for long lists/chats          |
| Collapsible | `collapsible.tsx`   | Mobile status bar                 |
| Tooltip     | `tooltip.tsx`       |                                   |

### Icon Policy

- **Allowed:** `@heroicons/react/16/solid`, `@heroicons/react/20/solid`, `@heroicons/react/24/outline`
- **Prohibited:** `lucide-react`, `@radix-ui/react-icons`, inline SVGs (except `QuillLogo.tsx`)
- Default icon size: 16px for inline UI, 20px for nav/actions, 24px for empty states.

---

## 6. Animation System

All animations are defined in `globals.css`. Use via utility classes — never duplicate keyframes inline.

### Available Animations

| Class                   | Duration   | Use                               |
| ----------------------- | ---------- | --------------------------------- |
| `animate-fade-in`       | 0.25s      | Page/section entry, modals        |
| `animate-slide-in-left` | 0.25s      | Sidebar panels, drawers           |
| `animate-slide-up`      | 0.25s      | Bottom sheets, toasts             |
| `animate-pulse-glow`    | 2s loop    | Active AI session border          |
| `animate-typing-dot`    | 1.2s loop  | AI thinking indicator (3 dots)    |
| `animate-spin-slow`     | 2s loop    | Loading spinners                  |
| `animate-shimmer`       | 2s loop    | Skeleton loaders (red shimmer)    |
| `animate-quill-writing` | 0.95s loop | Quill icon during generation      |
| `composer-working-glow` | 2.6s loop  | Chat input while AI is responding |

### Animation Rules

- Entry animations (`fade-in`, `slide-up`) max duration: **250ms** — fast enough to feel responsive, not jarring.
- Loop animations on AI states use the **accent color glow** — connects motion to AI identity.
- Never animate layout properties (`width`, `height`) on mobile — use `opacity` + `transform` only.
- Respect `prefers-reduced-motion`: wrap looping animations in `@media (prefers-reduced-motion: reduce)`.

---

## 7. AI-State UX

> **Finding #1 (Agent-aware UI)** + **Finding #4 (AI-transparent design)** in practice.

AI operations have four distinct states. Each requires a different visual treatment.

### State Matrix

| State              | Visual Signal                          | Component          | Animation                                   |
| ------------------ | -------------------------------------- | ------------------ | ------------------------------------------- |
| **Idle**           | Normal border (`quill-border`)         | Chat input default | None                                        |
| **Thinking**       | Pulsing glow border + typing dots      | `MessageBubble`    | `animate-typing-dot` + `animate-pulse-glow` |
| **Streaming**      | Working glow on composer + token flow  | Input container    | `composer-working-glow`                     |
| **Complete**       | Border resets, content fades in        | Message bubble     | `animate-fade-in`                           |
| **Error / Failed** | Red border + `quill-red` text, no glow | Error card         | None                                        |

### Typing Indicator (Thinking State)

```tsx
// Three dots, staggered delay — defined in MessageBubble.tsx
<div className="flex gap-1.5 px-4 py-3">
  {[0, 150, 300].map((delay) => (
    <span
      key={delay}
      className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-typing-dot"
      style={{ animationDelay: `${delay}ms` }}
    />
  ))}
</div>
```

### Streaming / Working Composer

```tsx
// Applied to the chat input container while AI is generating
<div className={`rounded-2xl bg-quill-surface border overflow-hidden transition-all duration-300
  ${isWorking ? "composer-working-glow border-[rgba(239,68,68,0.3)]" : "border-quill-border"}`}>
```

### Durable Streams (Finding #2)

When implementing resumable sessions:

- Show a subtle "Reconnecting..." badge (`quill-yellow`) on reconnect, auto-dismiss on success.
- Never reset the scroll position on reconnect — user returns to where they were.
- If stream resumes from a previous session, show a faint divider: `Session resumed · [time]`.

### Agent Status Badge Pattern

```tsx
// Consistent badge for agent states — track in RealMessageBubble.tsx
<span
  className="rounded-full border border-quill-border bg-quill-surface
  px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-quill-muted"
>
  {status} {/* "THINKING" | "RUNNING" | "COMPLETE" | "FAILED" */}
</span>
```

---

## 8. Glassmorphism & Surface Hierarchy

> **Finding #8 (our existing visual language)** — keep intentional, don't overuse.

### The `.glass` Class

```css
.glass {
  background: rgba(17, 17, 24, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

**Use only on:** floating elements that overlay content (nav bar, mobile sheet overlays, tooltips). Not for cards or panels that live in the normal flow.

### Glow Classes

```css
/* Accent glow border — for AI-active elements */
.glow-border {
  border: 1px solid rgba(239, 68, 68, 0.4);
  box-shadow:
    0 0 16px rgba(239, 68, 68, 0.1),
    inset 0 0 16px rgba(239, 68, 68, 0.05);
}
```

**Use on:** active chat sessions, selected workspace, AI-generated artifact panels. Max 1–2 glowing elements visible at a time.

### Surface Nesting Rules

```
Page bg:    quill-bg         (#0e1015)
Panels:     quill-surface    (#171a20) + border quill-border
Nested:     quill-surface-2  (#1d2128) + border quill-border-2
Hover:      quill-surface-2 with opacity transition (150ms)
```

Never go deeper than 3 surface levels.

---

## 9. Mobile-First Rules

> **Finding #3 (mobile workspace patterns)** already implemented; rules to maintain.

### Tap Targets

- Minimum **44×44px** for all interactive elements (`globals.css` enforces this via media query).
- Icon-only buttons use `icon-btn` class to override (padding-based sizing instead).

### Safe Area

Use `.pb-safe`, `.pt-safe`, `.pl-safe`, `.pr-safe` for any element touching screen edges (chat input, nav bar, modals).

### Mobile Layout Checklist

- [ ] Sidebar collapses to overlay, not push-aside.
- [ ] Chat input is sticky bottom with `pb-safe`.
- [ ] Code blocks have horizontal scroll indicator (`.scroll-indicator` pattern).
- [ ] Status bars are collapsible (`Collapsible` component from shadcn).
- [ ] Canvas header is compact (`h-10`, icon-only actions) on `< md`.
- [ ] No `hover:` styles as primary affordances — every interactive state needs a non-hover equivalent.

### Keyboard Hints

```css
/* Hidden on touch devices automatically */
.keyboard-hint {
  @media (hover: none), (pointer: coarse) {
    display: none;
  }
}
```

---

## 10. Design-to-Code Contract

> **Finding #5 (agent-readable design systems)** — tokens and semantics that coding agents can follow without human translation.

### Token Naming Convention

Token names follow `quill-[role]-[variant?]`. The role is semantic, not visual:

```
quill-bg         → page background (not "dark navy")
quill-surface    → card/panel surface (not "dark grey")
quill-accent     → brand/AI action color (not "red")
quill-muted      → secondary text (not "grey")
```

This means an agent can correctly use `quill-accent` for any AI-indicator element without knowing the underlying hex.

### Component Composability Contract

When building new components:

1. Use `quill-*` tokens for all color values.
2. Use animation classes from `globals.css` — never define new `@keyframes` in component files.
3. Follow the surface elevation model (`bg` → `surface` → `surface-2`).
4. Wrap interactive elements in the `button.tsx` / `input.tsx` primitives from `src/components/ui/`.
5. AI-state transitions must have explicit `idle → working → complete` class sets.

### Figma MCP Integration (Future)

When Figma MCP is active, ensure component names in code match Figma component names exactly. This lets agents read Figma designs and map directly to code components without translation overhead.

---

## 11. Trend Implementation Roadmap

Based on the 7 findings from the April 2026 AI/web design audit:

### Finding 1 — Agent-Aware UI / Human-Agent Interaction ✅ In Progress

**Status:** `MessageBubble`, `TaskInput`, `ToolCallCard` partially implement this.

**Next steps:**

- [ ] Standardize agent status badges across all views (use the pattern from §7).
- [ ] Add agent "intent preview" before long operations: a one-line summary of what the agent is about to do.
- [ ] Show confidence indicator on AI-generated content (low/medium/high signal).

### Finding 2 — Streaming & Durable Session UX ✅ Backend ready, UI pending

**Status:** Streaming works. Durable reconnect is infrastructure-ready (E2B sandbox, CLI sessions).

**Next steps:**

- [ ] Reconnection badge (`quill-yellow`) for restored sessions.
- [ ] Scroll position preservation on reconnect.
- [ ] "Session resumed" divider in chat thread.
- [ ] Background-run indicator in tab title: `"Quill (running…)"`.

### Finding 3 — Expressive / Emotional Design 🔴 Not started

**Status:** Current design is calm and minimal (correct). But lacks expressive moments.

**Next steps:**

- [ ] Animate the Quill logo on hover on the home page (`animate-quill-writing` already exists).
- [ ] Success micro-animation when artifact is generated (scale pop + glow fade).
- [ ] Empty states: replace blank panels with illustrated/animated placeholder that matches brand.
- [ ] Onboarding: first-run experience with personality (brand voice, not just functional copy).

### Finding 4 — AI-Transparent States ✅ In Progress

**Status:** Typing dots + composer glow implemented. Gaps in agent workspace.

**Next steps:**

- [ ] `ToolCallCard` needs streaming state (currently shows result, not process).
- [ ] Token usage indicator (progress bar, not just raw numbers) for budget awareness.
- [ ] Model badge on each response: show which model responded and in which mode.

### Finding 5 — Vibe Coding / Context-First Generation ✅ Core product

**Status:** Quill's builder is the product. Design tokens are already agent-readable.

**Next steps:**

- [ ] Add `data-component` attributes to major layout regions for MCP targeting.
- [ ] Document token mapping in this file (done above in §10) so agents can self-reference.
- [ ] Ensure `quill-*` token names appear in error messages and dev tools for debuggability.

### Finding 6 — Design Skills & Critique Layer 🟡 Cultural

**Status:** No tooling exists — this is a practice, not a feature.

**Next steps:**

- [ ] Add a `design-review` label to PRs that touch `globals.css`, `ui/`, or layout components.
- [ ] Monthly design review: compare component usage against this DESIGN.md.
- [ ] Track visual debt in `UI_STANDARDS_BASELINE.md` (already automated via `npm run audit:ui-standards`).

### Finding 7 — Tailwind v4 + CSS-Native Tokens ✅ Done

**Status:** Already on Tailwind v4 `@theme` — tokens are CSS custom properties.

**Next steps:**

- [ ] Expose `quill-*` tokens as `var(--color-quill-*)` in Storybook / dev tools for visibility.
- [ ] Consider adding text shadow utilities (Tailwind v4.1) for the `gradient-text` heading variant.
- [ ] Review if any `text-shadow` opportunities exist on hero sections (currently using `filter: blur` glow instead).

---

## 12. Governance

### Update Protocol

| Change type                           | Who reviews  | Required checks                |
| ------------------------------------- | ------------ | ------------------------------ |
| New token                             | Design + eng | `npm run typecheck`            |
| New animation                         | Eng          | Test on reduced-motion         |
| New primitive in `src/components/ui/` | Eng          | `npm run enforce:ui-standards` |
| `globals.css` changes                 | Design + eng | Full build + visual review     |
| This DESIGN.md                        | Anyone       | PR with `design-review` label  |

### Baseline Artifacts

- `UI_STANDARDS_BASELINE.md` — auto-generated audit (run `npm run audit:ui-standards`)
- `UI_STANDARDS.md` — enforcement rules and phase roadmap
- `.ui-standards-baseline.json` — machine-readable baseline for CI

### Quality Gates

Run before any design-system change lands:

```bash
npm run guardrails:check
npm run typecheck
npm run audit:ui-standards
```

---

_Last updated: April 2026 — aligned with Figma State of Designer 2026, Vercel Agentic Infrastructure, Google M3 Expressive, shadcn v2, Tailwind v4.1_
