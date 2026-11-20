// Flat-code parser: "b4g" -> B-4G, "bgg" -> B-GG (Block B, Ground floor, unit G), "a6i" -> A-6I
export const BLOCKS = "AB";        // blocks in the society
export const MAX_FLOOR = 25;
export const UNITS = "ABCDEFGHIJKL"; // flat letters per floor
export const MAX_FLATS_PER_REQUEST = 20;

export type Flat = { code: string; block: string; floor: string; unit: string };

export function parseFlats(input: string): { flats: Flat[]; invalid: string[]; tooMany: boolean } {
  const tokens = input.toLowerCase().replace(/[-_./]/g, "").split(/[\s,;]+/).filter(Boolean);
  const seen = new Set<string>();
  const flats: Flat[] = [];
  const invalid: string[] = [];
  for (const t of tokens.slice(0, 200)) {
    const m = /^([a-z])(g|\d{1,2})([a-z])$/.exec(t);
    if (!m) { invalid.push(t.slice(0, 12)); continue; }
    const block = m[1].toUpperCase(), floor = m[2].toUpperCase(), unit = m[3].toUpperCase();
    const floorOk = floor === "G" || (Number(floor) >= 1 && Number(floor) <= MAX_FLOOR);
    if (!BLOCKS.includes(block) || !floorOk || !UNITS.includes(unit)) { invalid.push(t.slice(0, 12)); continue; }
    const code = `${block}-${floor}${unit}`;
    if (seen.has(code)) continue;
    seen.add(code);
    flats.push({ code, block, floor, unit });
  }
  return { flats: flats.slice(0, MAX_FLATS_PER_REQUEST), invalid, tooMany: flats.length > MAX_FLATS_PER_REQUEST };
}
