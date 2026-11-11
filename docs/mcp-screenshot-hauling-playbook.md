# Screenshot → hauling checklist playbook

For Cursor, ChatGPT, Gemini, or any MCP client connected to Citizen Wing Commander (`/mcp`).

Use this when the user pastes or uploads **Accepted** contract screenshots (or contract text) and wants the shared checklist / route updated.

## Goal

1. Extract every accepted hauling contract into **`hauling_contracts_intake`** JSON (`lib/missions/haulingIntake.ts`). Example batch: `lib/fixtures/hauling-intake/hurston-covalex-2026-11-08/`.
2. **Screenshot attachment rule (critical):** If the user attached or pasted contract image(s), you **must** call **`store_hauling_screenshot`**. Prefer **`fileUrl`** (http/https the MCP server can download) or **`filePath`** when the MCP host can read it; keep **`imageBase64`** as a fallback. **ChatGPT `/mnt/data/...` paths are not reachable by a remote MCP server** — do not pass them; use a publicly reachable URL or base64. Pass **`sessionId`** (batch folder = session UUID). When the mission already exists, pass **`missionId`** to store + auto-attach in one call; otherwise put each returned `logicalPath` on that contract’s **`screenshots: [...]`** (session) or **`latestScreenshotPath`** (catalog `create_mission`). Omit screenshots **only** when the user provided no images (text-only). Never invent paths. If you already wrote the checklist without shots, call **`store_hauling_screenshot`** with `missionId` or **`set_mission_screenshots`** — do not rebuild the whole route just to attach evidence. Files go to `.data/mcp-screenshots/<batchId>/` — **not git**.
3. Write a **`mobiglas_contract_transcript`** (`lib/missions/mobiglasTranscript.ts`) mirroring the Contracts Manager panel and listing those logical screenshot paths. Keep a MobiGlas-layout `.md` next to the JSON in the batch folder.
4. Resolve names against fixtures (`search_locations`, `search_commodities`, `search_ships`).
5. **Merge** contracts into an **optimized stop order** (not one row per mission) as `SessionChecklistModel`.
6. Write with **`apply_hauling_contracts_intake`** (preferred: contracts + optimized `legs`) or `replace_hauling_checklist` / local `PUT /api/checklist`.
7. Confirm with `get_hauling_checklist`. Use `list_hauling_screenshots` / `clear_hauling_screenshots` to manage the temp store.

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

Catalog missions (`create_mission`) should pass **`scuSplits[]`** for each Primary Objective line (`kind`, `from`, `to`, `commodity`, `scu`) — sibling of **`scuTotal`**. Optional **`objectives[]`** are screenshot-style text bullets (derived from splits when omitted). Aggregated `cargo` / `from` / `to` can be omitted and will be derived.

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
| `store_hauling_screenshot` | Save base64/data-URL image → `.data/mcp-screenshots/<batchId>/` (prefer batchId = sessionId) |
| `list_hauling_screenshots` | List stored files for a batch |
| `set_mission_screenshots` | Attach logical paths to an existing mission without rewriting the route |
| `clear_hauling_screenshots` | Delete a batch’s temp images |

**Soft gate (not a hard fail):** `apply_hauling_contracts_intake` and `create_mission` still succeed when screenshot paths are missing, but return `screenshotsMissing: true` plus `warning` / `next`. Treat that as a defect to fix **in the same turn** when the user had images (`store_hauling_screenshot` → `set_mission_screenshots` or re-`create_mission` with `latestScreenshotPath`).

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
| Max container SCU | Details text | Optional context |
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
3. At hubs (e.g. Everus), use `legKind: "both"` with per-line `role: "pickup" | "delivery"`.
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
      "legKind": "pickup",
      "location": "HDMS-Lathan",
      "shipStorageLocation": "rear",
      "cargo": [{ "commodity": "Iron (Ore)", "scu": 2 }],
      "distanceToNext": { "value": 200, "unit": "km" },
      "isCompleted": false
    },
    {
      "legKind": "both",
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
- On `legKind: "both"`, every cargo line needs `role`.
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

- Keep a short extract table (contract → cargo → from → to) before routing.
- When the user sends a new zip/batch: re-extract all Accepted details, rebuild the full route, then `replace_hauling_checklist` (full replace, not patch).
- Call `get_hauling_intake_playbook` on the MCP server if available so remote clients load this same text.
