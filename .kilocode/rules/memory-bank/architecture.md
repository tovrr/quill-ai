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

## Key Design Patterns

### 1. App Router Pattern

Uses Next.js App Router with file-based routing:

```text
src/app/
├── page.tsx           # Route: /
├── about/page.tsx     # Route: /about
├── blog/
│   ├── page.tsx       # Route: /blog
│   └── [slug]/page.tsx # Route: /blog/:slug
└── api/
    └── route.ts       # API Route: /api
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
- Directories: kebab-case (`api-routes/`) or lowercase (`components/`)

## State Management

- Local UI state via `useState`/`useMemo` in client components.
- Chat state handled through AI SDK hooks and transport layer.
- Persistent state (history/messages) via server routes + Drizzle.
