#!/usr/bin/env bash
# Soft Storybook gate: warn when UI sources are staged without Storybook updates.
set -euo pipefail

UI_PATTERN='^(components/|app/.*\.(tsx|jsx)$|app/globals\.css$)'
STORY_PATTERN='(\.stories\.(tsx|ts|jsx|js|mdx)$|^stories/)'

staged="$(git diff --cached --name-only --diff-filter=ACMR || true)"
if [[ -z "${staged}" ]]; then
  exit 0
fi

ui_changed=0
story_changed=0

while IFS= read -r file; do
  [[ -z "${file}" ]] && continue
  if [[ "${file}" =~ ${UI_PATTERN} ]]; then
    ui_changed=1
  fi
  if [[ "${file}" =~ ${STORY_PATTERN} ]]; then
    story_changed=1
  fi
done <<< "${staged}"

if [[ "${ui_changed}" -eq 1 && "${story_changed}" -eq 0 ]]; then
  cat <<'EOF'
[storybook-gate] UI sources are staged without Storybook story changes.
  Before committing new/changed UI, add or update stories (components/**/*.stories.tsx or stories/**).
  Mid-iteration tweaks are fine while coding; Storybook must be current at commit time.
  Override intentionally with: SKIP_STORYBOOK_GATE=1 git commit ...
EOF
  if [[ "${SKIP_STORYBOOK_GATE:-}" == "1" ]]; then
    echo "[storybook-gate] SKIP_STORYBOOK_GATE=1 set — continuing."
    exit 0
  fi
  exit 1
fi

exit 0
