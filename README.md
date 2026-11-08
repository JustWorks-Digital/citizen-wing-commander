# Citizen Wing Commander

Star Citizen companion app (Next.js + Tailwind v4 + Storybook) themed after RSI / Spectrum.

## Scripts

```bash
npm run dev          # app at http://localhost:3000
npm run storybook    # design system at http://localhost:6006
npm run lint
npm run build
```

## Theme

RSI / Spectrum tokens live in `app/globals.css` as `--rsi-*` CSS variables and Tailwind `rsi-*` utilities. See `.cursor/rules/rsi-theme.mdc` and Storybook → **Foundation/Colors**.

## Storybook gate

New UI must have stories before commit. See `CONTRIBUTING.md` and `.cursor/rules/storybook-gate.mdc`.
