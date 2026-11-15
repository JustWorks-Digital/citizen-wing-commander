/**
 * Derive a unique `shortName` per starmap location.
 *
 * Rules:
 * - shortName must be an exact contiguous substring of `name` (only remove
 *   characters / spans — never rewrite, retitle, or CamelCase-invent).
 * - shortName must be unique across the catalog (case-insensitive).
 * - Prefer a rare single word, then a longer exact span from the name.
 * - When nothing unique fits, fall back to the full `name` (for review).
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
  "hur",
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
 * Exact whitespace-delimited spans from `name` (no rewriting).
 * @param {string} name
 * @returns {Array<{ text: string, start: number, end: number }>}
 */
export function wordSpansFromName(name) {
  const spans = [];
  const re = /\S+/g;
  let match;
  while ((match = re.exec(String(name ?? "")))) {
    spans.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return spans;
}

/**
 * @param {string} name
 * @returns {string[]}
 */
export function tokenizeLocationName(name) {
  return wordSpansFromName(name).map((span) => span.text);
}

/**
 * @param {string} token
 */
function isStopOrGeneric(token) {
  const key = token.toLowerCase();
  if (STOP_WORDS.has(key) || GENERIC_WORDS.has(key)) return true;
  // Lagrange / orbit markers as whole tokens: L1, HUR-L4, CRU-L5, …
  if (/^l[1-5]$/i.test(key)) return true;
  if (/^[a-z]{2,3}-l[1-5](?:-[a-z0-9]+)?$/i.test(key)) return true;
  if (/^[a-d]$/i.test(key)) return true;
  return false;
}

/** "Station" is too common for badges — never keep it in a shortName. */
function containsStationWord(value) {
  return /\bstation\b/i.test(String(value ?? ""));
}

/**
 * Exact substrings of `name` that are candidate short labels, shortest/rarest first.
 * @param {string} name
 * @param {Map<string, number>} documentFrequency
 * @returns {string[]}
 */
function candidatesFromName(name, documentFrequency) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return [];

  const spans = wordSpansFromName(trimmed);
  /** @type {string[]} */
  const out = [];
  const seen = new Set();

  const pushExact = (value) => {
    if (!value) return;
    // Must appear exactly in the original name (delete-only rule).
    if (!trimmed.includes(value)) return;
    // Drop labels that still contain the common word "Station".
    if (containsStationWord(value)) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(value);
  };

  /** Single-word candidates ranked by rarity then length. */
  const singles = spans
    .map((span) => span.text)
    .filter(
      (token) =>
        !containsStationWord(token) &&
        !isStopOrGeneric(token) &&
        !STOP_WORDS.has(token.toLowerCase()),
    );
  const pool =
    singles.length > 0
      ? singles
      : spans
          .map((span) => span.text)
          .filter(
            (token) =>
              !containsStationWord(token) &&
              !STOP_WORDS.has(token.toLowerCase()),
          );

  const rankedSingles = [...pool].sort((a, b) => {
    const da = documentFrequency.get(a.toLowerCase()) ?? 9999;
    const db = documentFrequency.get(b.toLowerCase()) ?? 9999;
    if (da !== db) return da - db;
    if (b.length !== a.length) return b.length - a.length;
    return a.localeCompare(b);
  });
  for (const token of rankedSingles) pushExact(token);

  /** Multi-word exact spans from the name — prefer content-only, then shorter. */
  /** @type {Array<{ text: string, wordCount: number, contentCount: number, genericCount: number }>} */
  const multi = [];
  for (let wordCount = 2; wordCount <= spans.length; wordCount++) {
    for (let i = 0; i + wordCount <= spans.length; i++) {
      const text = trimmed.slice(spans[i].start, spans[i + wordCount - 1].end);
      if (containsStationWord(text)) continue;
      const parts = wordSpansFromName(text).map((span) => span.text);
      const genericCount = parts.filter((token) => isStopOrGeneric(token)).length;
      const contentCount = parts.length - genericCount;
      if (contentCount === 0) continue;
      multi.push({
        text,
        wordCount,
        contentCount,
        genericCount,
      });
    }
  }
  multi.sort((a, b) => {
    // Prefer zero generics ("Melodic Fields") over noisier spans.
    if (a.genericCount !== b.genericCount) return a.genericCount - b.genericCount;
    if (a.wordCount !== b.wordCount) return a.wordCount - b.wordCount;
    if (a.text.length !== b.text.length) return a.text.length - b.text.length;
    return a.text.localeCompare(b.text);
  });
  for (const entry of multi) pushExact(entry.text);

  return out;
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
    name: String(location.name ?? "").trim(),
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

  /** Stations claim scarce words before clinics (avoids "Seraphim Station" leftovers). */
  function facilityClaimRank(name) {
    if (/\bstation\b/i.test(name)) return 0;
    if (/\bclinic\b/i.test(name)) return 2;
    return 1;
  }

  /** Prefer exact one-token names so multi-word places take a rarer word. */
  rows.sort((a, b) => {
    const aExact = a.tokens.length === 1 ? 0 : 1;
    const bExact = b.tokens.length === 1 ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const af = facilityClaimRank(a.name);
    const bf = facilityClaimRank(b.name);
    if (af !== bf) return af - bf;
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
    const candidates = candidatesFromName(row.name, documentFrequency);
    const withoutStation = containsStationWord(row.name)
      ? row.name
          .replace(/\bstation\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
    // Prefer the name with "Station" deleted when that span still appears exactly.
    if (
      withoutStation &&
      row.name.includes(withoutStation) &&
      !containsStationWord(withoutStation)
    ) {
      candidates.push(withoutStation);
    }
    // Full name only when it does not contain Station.
    if (row.name && !containsStationWord(row.name)) {
      candidates.push(row.name);
    }

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
      // Duplicate / exhausted labels: share the longest Station-free exact span.
      // Never keep the word "Station" in a shortName.
      const pool = candidatesFromName(row.name, documentFrequency);
      chosen =
        [...pool].sort((a, b) => b.length - a.length)[0] ??
        (withoutStation && row.name.includes(withoutStation)
          ? withoutStation
          : null);
      if (!chosen || containsStationWord(chosen)) {
        const parts = wordSpansFromName(row.name)
          .map((span) => span.text)
          .filter((token) => !containsStationWord(token));
        chosen = parts.join(" ").trim() || row.name || row.slug;
        // Joined parts may not be a contiguous substring when Station was in
        // the middle — fall back to the longest single Station-free token.
        if (!row.name.includes(chosen)) {
          chosen =
            [...parts].sort((a, b) => b.length - a.length)[0] ||
            row.name ||
            row.slug;
        }
      }
      const key = chosen.toLowerCase();
      if (!reserved.has(key)) reserved.set(key, row.slug);
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
  return locations.map((location) => {
    const name = String(location.name ?? "").trim();
    const shortName = shortBySlug.get(location.slug) ?? name ?? location.slug;
    return {
      ...location,
      shortName,
    };
  });
}
