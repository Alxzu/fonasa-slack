Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads .env, so don't use dotenv.
- Use `Bun.sql` for PostgreSQL (no external pg driver needed).
- Use `Bun.file` over `node:fs` readFile/writeFile where possible.

## Testing

```ts
import { test, expect, describe } from "bun:test";
```

## Database

Use `Bun.sql` tagged template literals for all queries (parameterized by default).
Never use string concatenation for SQL.
