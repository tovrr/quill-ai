# Recipe: Add Database

Add PostgreSQL schema/data support with Drizzle ORM in this Quill AI codebase.

## When to Use

- User needs to store data (users, posts, comments, etc.)
- Application requires authentication with user accounts
- Any feature requiring persistent state

## Prerequisites

- Base template already set up
- Understanding of the data model needed

## Environment

Database credentials are provided through `DATABASE_URL`.

## Setup Steps

### Step 1: Install Dependencies

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

### Step 2: Create All Required Files

⚠️ **Important**: Create ALL files before running generate. Setup fails if any are missing.

#### `src/db/schema.ts` - Table definitions (PostgreSQL)

```typescript
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add more tables as needed
```

#### `src/db/index.ts` - Database client

```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
```

#### `drizzle.config.ts` - Drizzle configuration (project root)

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
```

### Step 3: Add Package Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

### Step 4: Generate Migrations

```bash
npm run db:generate
npm run db:push
```

### Step 5: Commit and Push

```bash
npm run typecheck && npm run lint && git add -A && git commit -m "Add database support" && git push
```

Run `db:push` only when `DATABASE_URL` is correctly configured.

## Usage Examples

Database operations only work in Server Components and Server Actions.

```typescript
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Select all users
const allUsers = await db.select().from(users);

// Select by ID
const user = await db.select().from(users).where(eq(users.id, 1));

// Insert new user
await db.insert(users).values({ name: "John", email: "john@example.com" });

// Update user
await db.update(users).set({ name: "Jane" }).where(eq(users.id, 1));

// Delete user
await db.delete(users).where(eq(users.id, 1));
```

## Memory Bank Updates

After implementing, update `.kilocode/rules/memory-bank/context.md`:

- Add database to "Recently Completed" section
- Document the schema tables created
- Note any API routes or server actions added

Also update `.kilocode/rules/memory-bank/tech.md`:

- Add Drizzle ORM to dependencies
- Document database file structure
