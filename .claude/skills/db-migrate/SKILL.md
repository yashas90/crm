---
name: db-migrate
description: Run Drizzle ORM migrations (and optionally seed) against the configured DATABASE_URL. Use when pulling schema changes or setting up a fresh database.
disable-model-invocation: true
---

Run the Drizzle migration against the current DATABASE_URL:

```bash
pnpm db:migrate
```

If the user also wants seed data (fresh setup or resetting dev data), run:

```bash
pnpm db:seed
```

Remind the user that both commands require `DATABASE_URL` to be set in `packages/db/.env` (or exported in the shell). If the command fails with a connection error, check that the env var is present and the database is reachable.
