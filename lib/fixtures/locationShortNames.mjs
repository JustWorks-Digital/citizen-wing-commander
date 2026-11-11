/**
 * Derive a unique one-word `shortName` per starmap location by stripping
 * words that repeat across the catalog (Station, Port, Clinic, …) and
 * keeping the rarest distinctive token.
 */

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "at",
  "to",
  "for",
  "in",
  "on",
  "de",
  "la",
  "le",
  "les",
  "du",
  "uninitialized",
  "placeholder",
]);

/** Facility / org words that are rarely the useful short label. */
const GENERIC_WORDS = new Set([
  "station",
  "clinic",
  "facility",
  "outpost",
  "base",
  "entrance",
  "platform",
  "post",
  "center",
  "centre",
  "claim",
  "mining",
  "logistics",
  "extraction",
  "security",
  "breaker",
  "cluster",
  "asteroid",
  "derelict",
  "harbor",
  "harbour",
  "port",
  "point",
  "workcenter",
  "distribution",
  "private",
  "event",
  "jump",
  "gateway",
  "sun",
  "sakura",
  "covalex",
  "shubin",
  "hdpc",
  "rmb",
  "qv",
  "rsi",
  "hdrso",
  "securitycenter",
  "opcenter",
  "mt",
  "mic",
  "cru",
  "arc",
  "hun",
  "pyr1",
  "pyr2",
  "pyr3",
  "pyr4",
  "pyr5",
  "pyr6",
  "admin",
  "new",
]);

/**
 * @param {string} name
 * @returns {string[]}
 */
export function tokenizeLocationName(name) {
  const cleaned = String(name ?? "")
    .replace(/^["']+|["']+$/g, "")
    .replace(/[<=>]/g, " ")
    .trim();
  if (!cleaned) return [];

  /** Prefer keeping codes like SM0-13 / S1DC06 as one token. */
  const parts = cleaned.split(/[\s/_]+/).filter(Boolean);
  const tokens = [];
  for (const part of parts) {
    if (/^[A-Za-z]*\d[\w-]*$/.test(part) || /^[A-Z]{2,}(?:-\d+)+$/i.test(part)) {
      tokens.push(part.replace(/[^a-zA-Z0-9-]/g, ""));
      continue;
    }
    for (const bit of part.split("-")) {
      const token = bit.replace(/[^a-zA-Z0-9']/g, "");
      if (token) tokens.push(token);
    }
  }
  return tokens.filter(Boolean);
}

/**
 * @param {string} token
 */
function isStopOrGeneric(token) {
  const key = token.toLowerCase();
  if (STOP_WORDS.has(key) || GENERIC_WORDS.has(key)) return true;
  if (/^l[1-5]$/i.test(key)) return true;
  if (/^[a-d]$/i.test(key)) return true;
  return false;
}

/**
 * @param {string} token
 */
function titleCaseToken(token) {
  // Codes like S1DC06 / SM0-13 stay uppercase; mixed names like Area18 keep shape.
  if (/^[A-Za-z]*\d[\w-]*$/.test(token) && token === token.toUpperCase()) {
    return token;
  }
  if (/^[A-Za-z]*\d[\w-]*$/.test(token) && /[a-z]/.test(token)) {
    return token.charAt(0).toUpperCase() + token.slice(1);
  }
  if (/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(token) && /\d/.test(token)) {
    return token.toUpperCase();
  }
  if (token === token.toUpperCase() && token.length <= 5) return token;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/**
 * @param {Array<{ slug: string, name: string }>} locations
 * @returns {Map<string, string>} slug → shortName
 */
export function computeLocationShortNames(locations) {
  /** Dedupe identical slugs (wiki fixture sometimes repeats rows). */
  const bySlugInput = new Map();
  for (const location of locations) {
    if (!bySlugInput.has(location.slug)) {
      bySlugInput.set(location.slug, location);
    }
  }
  const rows = [...bySlugInput.values()].map((location) => ({
    slug: location.slug,
    name: location.name,
    tokens: tokenizeLocationName(location.name),
  }));

  /** @type {Map<string, number>} */
  const documentFrequency = new Map();
  for (const row of rows) {
    const seen = new Set();
    for (const token of row.tokens) {
      const key = token.toLowerCase();
      if (seen.has(key) || isStopOrGeneric(token)) continue;
      seen.add(key);
      documentFrequency.set(key, (documentFrequency.get(key) ?? 0) + 1);
    }
  }

  /**
   * @param {{ slug: string, name: string, tokens: string[] }} row
   * @returns {string[]}
   */
  function candidatesFor(row) {
    const content = row.tokens.filter((token) => !isStopOrGeneric(token));
    const pool =
      content.length > 0
        ? content
        : row.tokens.filter((token) => !STOP_WORDS.has(token.toLowerCase()));
    const ranked = [...pool].sort((a, b) => {
      const da = documentFrequency.get(a.toLowerCase()) ?? 9999;
      const db = documentFrequency.get(b.toLowerCase()) ?? 9999;
      if (da !== db) return da - db;
      if (b.length !== a.length) return b.length - a.length;
      return a.localeCompare(b);
    });

    const slugBits = row.slug.split("-").filter(Boolean);
    const contentSlugBits = slugBits.filter(
      (bit) => !isStopOrGeneric(bit) && !STOP_WORDS.has(bit),
    );
    const slugTail = contentSlugBits[contentSlugBits.length - 1];
    const numbered = row.slug.match(/(\d+)$/)?.[1];

    /** @type {string[]} */
    const out = [];
    const push = (value, format = true) => {
      if (!value) return;
      const formatted = format ? titleCaseToken(value) : value;
      const key = formatted.toLowerCase();
      if (out.some((entry) => entry.toLowerCase() === key)) return;
      out.push(formatted);
    };

    for (const token of ranked) push(token);
    if (slugTail) push(slugTail);
    if (numbered) push(numbered);
    // Compound leftover slug bits into one CamelCase word when singles collide.
    if (slugBits.length >= 2) {
      push(slugBits.map((bit) => titleCaseToken(bit)).join(""));
    }
    push(row.slug, false);
    return out;
  }

  /** Prefer exact one-token names (systems/cities) so compounds take a rarer word. */
  rows.sort((a, b) => {
    const aExact = a.tokens.length === 1 ? 0 : 1;
    const bExact = b.tokens.length === 1 ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const ac = a.tokens.filter((token) => !isStopOrGeneric(token)).length;
    const bc = b.tokens.filter((token) => !isStopOrGeneric(token)).length;
    if (ac !== bc) return ac - bc;
    return a.slug.localeCompare(b.slug);
  });

  /** @type {Map<string, string>} lower short → slug */
  const reserved = new Map();
  /** @type {Map<string, string>} */
  const bySlug = new Map();

  for (const row of rows) {
    const candidates = candidatesFor(row);
    let chosen = null;
    for (const candidate of candidates) {
      const key = candidate.toLowerCase();
      const owner = reserved.get(key);
      if (owner && owner !== row.slug) continue;
      chosen = candidate;
      reserved.set(key, row.slug);
      break;
    }
    if (!chosen) {
      chosen = titleCaseToken(row.slug);
      reserved.set(chosen.toLowerCase(), row.slug);
    }
    bySlug.set(row.slug, chosen);
  }

  return bySlug;
}

/**
 * @template {{ slug: string, name: string }} T
 * @param {T[]} locations
 * @returns {Array<T & { shortName: string }>}
 */
export function withLocationShortNames(locations) {
  const shortBySlug = computeLocationShortNames(locations);
  return locations.map((location) => ({
    ...location,
    shortName: shortBySlug.get(location.slug) ?? location.slug,
  }));
}
