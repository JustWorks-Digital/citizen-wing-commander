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

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js app |
| `npm run storybook` | Design system / UI workshop |
| `npm run build-storybook` | Static Storybook build |
| `npm run lint` | ESLint |
