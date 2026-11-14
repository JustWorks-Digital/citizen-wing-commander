# Screenshot → hauling checklist playbook

For Cursor, ChatGPT, Gemini, or any MCP client connected to Citizen Wing Commander (`/mcp`).

Use this when the user wants a **new trip** (or route update) from **Accepted** contract screenshots (or contract text).

**Do not require browser control.** Many chats cannot push chat-attached images to a remote MCP server.

## Two lanes (pick by capability)

### Lane A — push (ideal when the host can deliver image bytes)

Client can pass a reachable **`fileUrl`**, a host-readable **`filePath`**, or **`imageBase64`**.

1. `create_hauling_session` (name from user / first contract). Note `tripUrl` / `sessionId`.
2. For each shot: `store_hauling_screenshot` with `sessionId` (= batch). Prefer `fileUrl` / `filePath`; `imageBase64` fallback.
3. Extract contracts (vision on those bytes or via `get_hauling_screenshot`).
4. `apply_hauling_contracts_intake` with `contracts[].screenshots` = returned `logicalPath`s (+ optimized `legs` when ready).
5. `mark_hauling_screenshots_processed` (`sessionId`, `allPending: true` or explicit paths).
6. Confirm with `get_hauling_checklist`.

**Never** pass ChatGPT `/mnt/data/...` as `filePath` — the remote MCP server cannot read it.

### Lane B — Source handoff (universal fallback)

When push is impossible or `store_hauling_screenshot` fails:

1. Still **`create_hauling_session` immediately** (so the user has a trip to paste into).
2. Reply with **`tripUrl`**: open the trip → **Source** → paste/drop all Accepted shots → reply **continue**.
3. On continue: `list_hauling_screenshots` (`sessionId`, `status: "pending"`). If empty, ask again for Source uploads.
4. For each pending shot: `get_hauling_screenshot` (**one image per call**) → vision extract.
5. `apply_hauling_contracts_intake` with those `logicalPath`s on `contracts[].screenshots`.
6. `mark_hauling_screenshots_processed` → `get_hauling_checklist`.

Lane B is the reliable ChatGPT path. Lane A is what Cursor/Codex can do when they truly have the files.

## Goal (after shots are in the store)

1. Extract every accepted hauling contract into **`hauling_contracts_intake`** JSON (`lib/missions/haulingIntake.ts`). Example batch: `lib/fixtures/hauling-intake/hurston-covalex-2026-11-08/`.
2. **Max container SCU (required when visible):** Read the contract’s max container size from Details (wording like “Containers at most N SCU” / max crate size). In screenshots this is **usually blue highlighted text** — scan for that accent before finishing the extract. Record it on every contract as **`maxContainerScu`** (allowed sizes: 1 / 2 / 4 / 8 / 16 / 32). For catalog `create_mission`, pass the same value as **`scuMaxContainerSize`**. This caps default box splits and bay packing — do not omit it when the screenshot shows it.
3. Put each shot’s **`logicalPath`** on that contract’s **`screenshots: [...]`** (session) or **`latestScreenshotPath`** (catalog). Never invent paths. Omit screenshots **only** for text-only intake.
4. Write a **`mobiglas_contract_transcript`** (`lib/missions/mobiglasTranscript.ts`) mirroring the Contracts Manager panel and listing those logical screenshot paths when useful.
5. Resolve names against fixtures (`search_locations`, `search_commodities`, `search_ships`).
6. **Merge** contracts into an **optimized stop order** (not one row per mission) as `SessionChecklistModel`.
7. Write with **`apply_hauling_contracts_intake`** (preferred: contracts + optimized `legs`) or `replace_hauling_checklist` / local `PUT /api/checklist`.
8. Confirm with `get_hauling_checklist`. Mark Source shots processed when done.

### Accepted intake JSON

```json
{
  "kind": "hauling_contracts_intake",
  "version": 1,
  "sessionName": "Hurston Covalex run",
  "ships": [],
  "startLocation": "Everus Harbor",
  "contracts": [
    {
      "title": "Junior Rank - Direct Medium Cargo Haul",
      "contractor": "Covalex Independent Contractors",
      "rewardAuec": 56750,
      "from": ["HDPC-Cassillo"],
      "to": ["Everus Harbor"],
      "cargo": [{ "commodity": "Waste", "scu": 58 }],
      "maxContainerScu": 8
    }
  ]
}
```

Multi-pickup contracts use `from: [...]` plus optional `pickupSplits` when totals are shared across sites.

Always include **`maxContainerScu`** on each intake contract when Details shows a max crate size (common: 1, 4, or 8). Skipping it makes box-split defaults and packing assume the wrong cap.

Catalog missions (`create_mission`) should pass **`scuSplits[]`** for each Primary Objective line (`kind`, `from`, `to`, `commodity`, `scu`) — sibling of **`scuTotal`** — and **`scuMaxContainerSize`** for the same max-crate value. Optional **`objectives[]`** are screenshot-style text bullets (derived from splits when omitted). Aggregated `cargo` / `from` / `to` can be omitted and will be derived.

Link evidence on each contract:

```json
{
  "id": "contract-01-stims",
  "screenshots": ["hurston-covalex-2026-11-08/01-stims-96-everus-lorville.png"],
  "transcript": "transcripts/contract-01-stims.json"
}
```

### Screenshots via MCP (temp)

| Tool | Purpose |
| --- | --- |
| `create_hauling_session` | New trip; returns `tripUrl` for Lane B Source handoff |
| `store_hauling_screenshot` | Lane A: push bytes → `.data/mcp-screenshots/<sessionId>/` |
| `list_hauling_screenshots` | List Source shots (`status`: pending / processed / all; default pending) |
| `get_hauling_screenshot` | Pull one image (base64) for vision — prefer one call per shot |
| `mark_hauling_screenshots_processed` | After apply — clear pending Source badge |
| `set_mission_screenshots` | Attach logical paths to an existing mission without rewriting the route |
| `set_mission_scu_box_splits` | Correct crate sizes from freight elevator / hangar UI (`boxes: [{ size, count }]`) |
| `clear_hauling_screenshots` | Delete a batch’s temp images |

Web UI **Source** uploads land as **pending**. AI marks them **processed** after intake.

**Soft gate (not a hard fail):** `apply_hauling_contracts_intake` and `create_mission` still succeed when screenshot paths are missing, but return `screenshotsMissing: true` plus `warning` / `next`. Fix with store / Source list paths / `set_mission_screenshots` — prefer attach-after over rebuilding the route.

Railway without a volume: store is wiped on redeploy (same as checklist `.data`).

### MobiGlas transcript

Store under the batch as `transcripts/<id>.json` (+ `.md` text layout):

- `kind: "mobiglas_contract_transcript"`
- `screenshots: [...]` (MCP logical paths)
- `screenshotStore: ".data/mcp-screenshots"`
- `mobiglas`: `tab`, `acceptedCount`, `category`, `title`, `contractor`, `rewardAuec`, `timeRemaining`, `deadline`, `details`, `contact`, `objectives[]`

Use `formatMobiglasTranscript()` for the boxed text view that mirrors the in-game panel.

## Screenshot intake checklist

Open every Accepted contract detail pane (not just the sidebar list).

Per contract, capture:

| Field | Where in UI | Notes |
| --- | --- | --- |
| Rank / title | Header | e.g. Junior Rank – Direct Medium Cargo Haul |
| Reward | Header / list | Optional; for session naming only |
| Pickup location(s) | Details + objectives | Freight elevator sites |
| Delivery location(s) | Details + objectives | |
| Commodity + SCU | Primary objectives | Prefer exact labels: `Iron (Ore)`, `Quartz (Raw)` |
| Max container SCU | Details text (often **blue highlight**) | **Required when shown** — e.g. “Containers at most 8 SCU”. Map to `maxContainerScu` (intake) / `scuMaxContainerSize` (catalog). Allowed: 1 / 2 / 4 / 8 / 16 / 32 |
| Multi-stop | “any order” / multiple Collect lines | Split cargo across pickup rows when totals are shared |

**Coverage rule:** Sidebar count (e.g. Accepted 9/10) must match detail screenshots. If a contract was only scrolled past in the list, ask for that detail shot or skip it and say so.

Ignore unrelated screenshots (chat UIs, guides, etc.).

## Fixture resolution (required)

Never invent location / commodity / ship labels.

```
search_locations({ query })
search_commodities({ query })
search_ships({ query })   # only if ship is known from user/UI
```

Use returned **names** (or slugs) in `replace_hauling_checklist` / `set_session_ships`.

Common Hurston mappings:

| Contract text | Prefer |
| --- | --- |
| Everus Harbor above Hurston | Everus Harbor |
| Teasa Spaceport in Lorville | Lorville |
| HDPC-Cassillo / Farnesway | HDPC-Cassillo / HDPC-Farnesway |
| HDMS-Lathan / Bezdek on Arial | HDMS-Lathan / HDMS-Bezdek |
| Iron (Ore) / Quartz (Raw) | those exact fixture names |
| Stims, Tin, Silicon, Tungsten, Quartz | exact fixture names |

## Route optimization rules

Optimize **geography**, not contract order.

1. Cluster by body: moon outposts (Arial) → Hurston surface HDPCs → Everus (orbit) → remaining surface drops → city spaceport last when it only receives.
2. Visit a stop **once** when possible. If a site both supplies and receives different cargo at different times (need cargo from Everus first), allow a second visit.
3. At hubs (e.g. Everus), use `routeAction: "both"` with per-line `role: "pickup" | "delivery"`.
4. Merge same-stop same-direction cargo from multiple contracts into one row’s `cargo[]`.
5. Multi-site pickups that share a total SCU (e.g. Lathan + Bezdek for 4 SCU iron): split totals across sites when exact per-site amounts are unknown; note the split in the session name or tool message.
6. `shipStorageLocation` (and per-cargo overrides on `both` stops): group by destination bay — e.g. city drops `front`, HDPC drops `middle`, moon/small `rear`.
7. `distanceToNext`: fill when known/reasonable; `null` on the final stop.

## `replace_hauling_checklist` shape

```json
{
  "sessionName": "Hurston Covalex run",
  "ships": ["C2 Hercules"],
  "legs": [
    {
      "routeAction": "pickup",
      "location": "HDMS-Lathan",
      "shipStorageLocation": "rear",
      "cargo": [{ "commodity": "Iron (Ore)", "scu": 2 }],
      "distanceToNext": { "value": 200, "unit": "km" },
      "isCompleted": false
    },
    {
      "routeAction": "both",
      "location": "Everus Harbor",
      "shipStorageLocation": "front",
      "cargo": [
        {
          "commodity": "Iron (Ore)",
          "scu": 85,
          "role": "delivery",
          "shipStorageLocation": "middle"
        },
        {
          "commodity": "Stims",
          "scu": 96,
          "role": "pickup",
          "shipStorageLocation": "front"
        }
      ],
      "distanceToNext": { "value": 12, "unit": "Mm" }
    }
  ]
}
```

Rules:

- `legs` currently requires **≥ 1** row (empty clear is via checklist API / future clear tool).
- On `routeAction: "both"`, every cargo line needs `role`.
- Prefer different `shipStorageLocation` on pickup vs delivery lines so the table shows separate colored bay lines.
- After write: `get_hauling_checklist` and sanity-check stop order, SCU totals, and fixture names.

## Table / UI expectations

The web checklist is one row per **stop**, not per contract:

- Location badge + leg kind (pickup / delivery / both)
- Cargo lines with SCU (merged commodities)
- Ship storage zone(s)
- Distance to next
- Completion checkbox

Do not create parallel rows that only restate the same stop for a second contract—merge cargo into that stop.

## Iteration tips

- Keep a short extract table (contract → cargo → from → to → maxContainerScu) before routing.
- When the user sends a new zip/batch: re-extract all Accepted details, rebuild the full route, then `replace_hauling_checklist` (full replace, not patch).
- Call `get_hauling_intake_playbook` on the MCP server if available so remote clients load this same text.
