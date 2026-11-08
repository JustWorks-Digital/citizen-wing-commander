# Contributing

## Visual language

Use RSI / Spectrum design tokens from `app/globals.css` (`--rsi-*` / Tailwind `rsi-*`). See `.cursor/rules/rsi-theme.mdc`.

## Storybook gate

Any new UI element must be represented in Storybook **before commit**.

```bash
npm run storybook
```

- Stories live beside components (`components/**/*.stories.tsx`) or under `stories/foundation/`.
- You do not need to update Storybook on every mid-iteration tweak while coding, but Storybook must be up to date at commit time.
- A Husky pre-commit hook runs `scripts/check-storybook-gate.sh` and fails if UI sources are staged without story changes. Bypass intentionally with `SKIP_STORYBOOK_GATE=1`.

## Cursor rules

Project conventions live in `.cursor/rules/` (index: `.cursor/rules/README.md`). Add new rules there as the team invents them.

## Database

Postgres + Drizzle. See `.cursor/rules/database.mdc`.

```bash
cp .env.example .env.local   # set DATABASE_URL
npm run db:generate          # after schema edits → drizzle/*.sql
npm run db:upgrade           # apply pending migrations (deploy-safe)
```

Production / staging deploys: set `DATABASE_URL` and run `npm run db:upgrade` (same script as local).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js app |
| `npm run storybook` | Design system / UI workshop |
| `npm run build-storybook` | Static Storybook build |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate SQL from `db/schema.ts` |
| `npm run db:upgrade` | Apply pending migrations (`scripts/db-upgrade.mjs`) |
| `npm run db:migrate` | Alias for `db:upgrade` |
| `npm run db:studio` | Drizzle Studio |
