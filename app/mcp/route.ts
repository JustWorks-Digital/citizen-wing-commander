import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  toolGetHaulingChecklist,
  toolReplaceHaulingChecklist,
  toolSearchCommodities,
  toolSearchLocations,
  toolSearchShips,
  toolSetLegCompleted,
  toolSetSessionName,
  toolSetSessionShips,
} from "@/lib/mcp/tools";

const distanceUnitSchema = z.enum(["m", "km", "Mm", "Gm", "AU"]);

const shipStorageSchema = z
  .enum(["front", "middle", "rear"])
  .describe("Cargo bay zone: front (bow), middle, or rear (aft).");

const cargoLineSchema = z.object({
  commodity: z
    .string()
    .describe("Commodity name, code, or fixture slug (e.g. Ice, AGRI, scrap)"),
  scu: z.number().int().nonnegative(),
  role: z
    .enum(["pickup", "delivery"])
    .optional()
    .describe(
      "Required on legKind both: whether this cargo line is picked up or delivered at the stop.",
    ),
  shipStorageLocation: shipStorageSchema
    .optional()
    .describe(
      "Bay zone for this cargo line. Required on legKind both when pickup and delivery use different zones; otherwise falls back to the leg shipStorageLocation.",
    ),
});

const legSchema = z.object({
  id: z.string().optional().describe("Stable row id; auto-generated if omitted"),
  legKind: z.enum(["pickup", "delivery", "both"]),
  location: z
    .string()
    .describe("Star Citizen location name or fixture slug (e.g. Area18)"),
  cargo: z.array(cargoLineSchema).optional().default([]),
  shipStorageLocation: shipStorageSchema.describe(
    "Default cargo bay zone for the leg (used when cargo lines omit shipStorageLocation).",
  ),
  distanceToNext: z
    .object({
      value: z.number(),
      unit: distanceUnitSchema,
    })
    .nullable()
    .optional(),
  isCompleted: z.boolean().optional().default(false),
});

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_hauling_checklist",
      {
        title: "Get hauling checklist",
        description:
          "Use this when you need the current Citizen Wing Commander hauling checklist session (legs, cargo, completion).",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => toolGetHaulingChecklist(),
    );

    server.registerTool(
      "set_session_name",
      {
        title: "Set session name",
        description:
          "Use this when renaming the active hauling session shown in the app.",
        inputSchema: z.object({
          sessionName: z.string().min(1),
        }),
        annotations: { idempotentHint: true },
      },
      async ({ sessionName }) => toolSetSessionName(sessionName),
    );

    server.registerTool(
      "replace_hauling_checklist",
      {
        title: "Replace hauling checklist",
        description:
          "Use this after reading mission screenshots or contract text to fully replace the active checklist with structured legs. Prefer search_locations / search_commodities first when names are ambiguous. Do not invent locations or commodities that are not in fixtures.",
        inputSchema: z.object({
          sessionName: z.string().optional(),
          ships: z
            .array(z.string())
            .optional()
            .describe(
              "Optional ship names/slugs for the crew (e.g. C2 Hercules, Freelancer MAX).",
            ),
          legs: z.array(legSchema).min(1),
        }),
        annotations: { destructiveHint: true },
      },
      async (input) => toolReplaceHaulingChecklist(input),
    );

    server.registerTool(
      "set_session_ships",
      {
        title: "Set session ships",
        description:
          "Use this when the user or crew tells you which ship(s) they are flying for the hauling session. Prefer search_ships first when the name is ambiguous. Ship cargo SCU from fixtures will drive storage capacity later.",
        inputSchema: z.object({
          ships: z
            .array(z.string())
            .min(1)
            .describe("One or more ship names or fixture slugs"),
        }),
        annotations: { idempotentHint: true },
      },
      async ({ ships }) => toolSetSessionShips(ships),
    );

    server.registerTool(
      "set_leg_completed",
      {
        title: "Set leg completed",
        description:
          "Use this to mark a checklist leg done or not done by row id from get_hauling_checklist.",
        inputSchema: z.object({
          rowId: z.string(),
          isCompleted: z.boolean(),
        }),
        annotations: { idempotentHint: true },
      },
      async (input) => toolSetLegCompleted(input),
    );

    server.registerTool(
      "search_locations",
      {
        title: "Search locations",
        description:
          "Use this to resolve Star Citizen starmap location names to fixture slugs before writing checklist legs.",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(25).optional().default(10),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ query, limit }) => toolSearchLocations(query, limit),
    );

    server.registerTool(
      "search_commodities",
      {
        title: "Search commodities",
        description:
          "Use this to resolve cargo type names to fixture slugs before writing checklist legs.",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(25).optional().default(10),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ query, limit }) => toolSearchCommodities(query, limit),
    );

    server.registerTool(
      "search_ships",
      {
        title: "Search ships",
        description:
          "Use this to resolve Star Citizen ship names to fixture slugs and cargo SCU before set_session_ships.",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(25).optional().default(10),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ query, limit }) => toolSearchShips(query, limit),
    );
  },
  {
    serverInfo: {
      name: "citizen-wing-commander",
      version: "0.1.0",
    },
    instructions: [
      "Citizen Wing Commander manages hauling session checklists.",
      "When the user shares mission screenshots or contract details: extract ships, pickup/delivery stops, cargo amounts, ship storage zones, and distances.",
      "Resolve names with search_locations, search_commodities, and search_ships; then call set_session_ships and/or replace_hauling_checklist.",
      "Location, commodity, and ship names must match fixtures (Wiki starmap + UEX). Prefer fixture names over inventing labels.",
      "shipStorageLocation must be front, middle, or rear. On both stops, set per-cargo shipStorageLocation so pickup/delivery bay zones can differ and render as separate colored lines.",
      "After writes, the web UI reads the same active checklist store.",
    ].join(" "),
  },
);

export { handler as GET, handler as POST, handler as DELETE };
