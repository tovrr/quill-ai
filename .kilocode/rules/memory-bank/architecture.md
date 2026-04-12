# System Patterns: Quill AI

## Architecture Overview

```text
src/
├── app/                    # Next.js App Router
│   ├── agent/page.tsx      # Main agent chat experience
│   ├── pricing/page.tsx    # Pricing and plan messaging
│   ├── docs/page.tsx       # Product documentation page
│   └── api/*               # Chat/auth/utility endpoints
├── components/             # UI and feature components
├── lib/                    # Auth/data/provider helpers
└── db/                     # Drizzle schema and DB client
```

Chat backend decomposition (anti-hallucination critical):

```text
src/app/api/chat/route.ts                # Orchestration-only flow
src/lib/chat/request-utils.ts            # Request parsing + message normalization
src/lib/chat/model-selection.ts          # Mode limits + provider/model resolution
src/lib/chat/access-gates.ts             # Entitlement and quota gates
src/lib/chat/policy-runtime.ts           # Killer permission + sandbox runtime derivation
src/lib/chat/two-pass-builder.ts         # Two-pass builder streaming path
```

## Key Design Patterns

### 1. App Router Pattern

Uses Next.js App Router with file-based routing:

```text
src/app/
├── page.tsx                    # Route: /
├── agent/page.tsx              # Route: /agent
├── login/page.tsx              # Route: /login
├── docs/page.tsx               # Route: /docs
├── pricing/page.tsx            # Route: /pricing
└── api/
  ├── chat/route.ts           # API Route: /api/chat
  ├── chats/route.ts          # API Route: /api/chats
  └── generate-image/route.ts # API Route: /api/generate-image
```

### 2. Component Organization Pattern

```text
src/components/
├── ui/                # Reusable UI components (Button, Card, etc.)
├── layout/            # Layout components (Header, Footer)
└── agent/             # Agent-specific UI (status, canvas, messages)
```

### 3. Server Components by Default

All components are Server Components unless marked with `"use client"`:

```tsx
// Server Component (default) - can fetch data, access DB
export default function Page() {
  return <div>Server rendered</div>;
}

// Client Component - for interactivity
"use client";
export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### 4. Layout Pattern

Layouts wrap pages and can be nested:

```tsx
// src/app/layout.tsx - Root layout
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

// src/app/dashboard/layout.tsx - Nested layout
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
```

## Styling Conventions

### Tailwind CSS Usage

- Utility classes directly on elements
- Component composition for repeated patterns
- Responsive: `sm:`, `md:`, `lg:`, `xl:`

### Common Patterns

```tsx
// Container
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// Flexbox centering
<div className="flex items-center justify-center">
```

## File Naming Conventions

- Components: PascalCase (`Button.tsx`, `Header.tsx`)
- Utilities: camelCase (`utils.ts`, `helpers.ts`)
- Pages/Routes: lowercase (`page.tsx`, `layout.tsx`)
- Directories: route-segment lowercase for App Router, lowercase for library folders

## State Management

- Local UI state via `useState`/`useMemo` in client components.
- Chat state handled through AI SDK hooks and transport layer.
- Persistent state (history/messages) via server routes + Drizzle.

## Chat Route Editing Rules

1. Keep `src/app/api/chat/route.ts` orchestration-first: parse -> policy runtime -> access gates -> prompt build -> stream.
2. Add logic to the owner module in `src/lib/chat/*` instead of re-inlining in route.
3. Re-run both `npm run typecheck` and `npm run build` after chat backend edits.
