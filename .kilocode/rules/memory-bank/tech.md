# Technical Context: Quill AI

## Technology Stack

| Technology | Version | Purpose |
| ---------- | ------- | ------- |
| Next.js | 16.x | React framework with App Router |
| React | 19.x | UI library |
| TypeScript | 5.9.x | Type-safe JavaScript |
| Tailwind CSS | 4.x | Utility-first CSS |
| Neon | - | Serverless PostgreSQL database |
| Drizzle ORM | 0.45.x | Type-safe database ORM |
| Better Auth | 1.5.x | Authentication and session handling |
| AI SDK | 6.x | Model-agnostic streaming chat primitives |

## Development Environment

### Prerequisites

- Node.js 20+
- npm

### Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript type checking
npm run db:generate # Generate Drizzle migrations
npm run db:push    # Push schema to Neon database
npm run db:studio  # Open Drizzle Studio
```

## Project Configuration

### Next.js Config (`next.config.ts`)

- App Router project
- Security headers configured

### TypeScript Config (`tsconfig.json`)

- Strict mode enabled
- Path alias: `@/*` → `src/*`
- Target: ESNext

### Tailwind CSS 4 (`postcss.config.mjs`)

- Uses `@tailwindcss/postcss` plugin
- Theme tokens are defined in `src/app/globals.css`

### ESLint (`eslint.config.mjs`)

- Uses `eslint-config-next`
- Flat config format

## Key Dependencies

### Production Dependencies (key)

```json
{
  "next": "^16.1.3", // Framework
  "react": "^19.2.3", // UI library
  "react-dom": "^19.2.3", // React DOM
  "drizzle-orm": "^0.45.2", // Database ORM
  "@neondatabase/serverless": "^1.0.2", // Neon PostgreSQL driver
  "better-auth": "^1.5.6", // Authentication
  "@ai-sdk/google": "^3.0.53", // AI SDK (Google)
  "@ai-sdk/openai": "^3.0.48", // OpenRouter-compatible provider client
  "@ai-sdk/react": "^3.0.143", // AI SDK (React)
  "ai": "^6.0.141" // AI SDK core
}
```

### Dev Dependencies

```json
{
  "typescript": "^5.9.3",
  "@types/node": "^24.10.2",
  "@types/react": "^19.2.7",
  "@types/react-dom": "^19.2.3",
  "@tailwindcss/postcss": "^4.1.17",
  "tailwindcss": "^4.1.17",
  "drizzle-kit": "^0.31.10",
  "eslint": "^9.39.1",
  "eslint-config-next": "^16.0.0",
  "sharp": "latest"             // SVG→PNG icon generation (scripts/generate-icons.mjs)
}
```

### Optional Dependencies (cross-platform CI)

Linux-native Rust binaries that Windows lockfiles never install. Listed in `optionalDependencies` and force-installed in CI:

```json
{
  "lightningcss-linux-x64-gnu": "1.32.0",
  "lightningcss-linux-x64-musl": "1.32.0",
  "@tailwindcss/oxide-linux-x64-gnu": "4.2.2",
  "@tailwindcss/oxide-linux-x64-musl": "4.2.2"
}
```

## File Structure

```text
src/
  app/
    agent/page.tsx
scripts/
  generate-icons.mjs    # Renders public/favicon.svg → all PNG icon sizes via sharp
                        # Re-run whenever favicon.svg changes
```
    api/chat/route.ts
    api/chats/route.ts
    api/chats/[chatId]/route.ts
    api/generate-image/route.ts
  components/
    layout/Sidebar.tsx
    agent/*
  lib/
    auth/client.ts
    auth/server.ts
    db-helpers.ts
  db/
    index.ts
    schema.ts
```

## Technical Constraints

### Product Constraints

- Authenticated persistence is required for history features.
- Guest users are intentionally restricted in tier access.
- Daily usage limits are environment-driven.

### Browser Support

- Modern browsers (ES2020+)
- No IE11 support

## Performance Considerations

### Image Optimization

- Use Next.js `Image` component for optimization
- Place images in `public/` directory

### Bundle Size

- Tree-shaking enabled by default
- Tailwind CSS purges unused styles

### Core Web Vitals

- Server Components reduce client JavaScript
- Streaming and Suspense for better UX

## Deployment

### Build Output

- Server-rendered pages by default.
- API routes depend on runtime env configuration.

### Environment Variables

- `DATABASE_URL` (required)
- `BETTER_AUTH_SECRET` (required)
- `BETTER_AUTH_URL` (required)
- `GOOGLE_GENERATIVE_AI_API_KEY` (required for Think/Pro, image generation, and Google fallback for fast mode)
- `FREE_DAILY_MESSAGES`, `THINK_DAILY_MESSAGES`, `PRO_DAILY_MESSAGES` (optional quotas)
- `OPENROUTER_API_KEY`, `OPENROUTER_FREE_MODEL` (optional fast-mode routing)
- `FAST_MODEL_OVERRIDE`, `THINKING_MODEL_OVERRIDE`, `ADVANCED_MODEL_OVERRIDE` (optional per-tier routing overrides)
- `HEALTH_CHECK_TIMEOUT_MS` (optional readiness probe timeout)
- `PRICE_GEMINI_25_FLASH_LITE_INPUT_PER_1M_USD`, `PRICE_GEMINI_25_FLASH_LITE_OUTPUT_PER_1M_USD` (optional telemetry cost inputs)
- `PRICE_GEMINI_25_FLASH_INPUT_PER_1M_USD`, `PRICE_GEMINI_25_FLASH_OUTPUT_PER_1M_USD` (optional telemetry cost inputs)
- `PRICE_GEMINI_25_PRO_INPUT_PER_1M_USD`, `PRICE_GEMINI_25_PRO_OUTPUT_PER_1M_USD` (optional telemetry cost inputs)
- `PRICE_IMAGEN_4_FAST_PER_IMAGE_USD` (optional telemetry cost input)
