// Flat-code parser: "b4g" -> B-4G, "bgg" -> B-GG (Block B, Ground floor, unit G), "a6i" -> A-6I
export const BLOCKS = "AB";        // blocks in the society
export const MAX_FLOOR = 25;
export const UNITS = "ABCDEFGHIJKL"; // flat letters per floor
export const MAX_FLATS_PER_REQUEST = 20;

export type Flat = { code: string; block: string; floor: string; unit: string };

// Tolerant parsing: "b4g", "B4G", "b 4 g", "a6 i", "A-6-I", "b4g,a6i", "b4g a6i", "b4g and a6i" all work.
// Inside each chunk (split on comma / semicolon / new line / "and" / "&" / "+") spaces and dashes are ignored,
// then the text is read as a stream of  BLOCK + FLOOR + LETTER  codes, so "b4g a6i" and "b4ga6i" both give two flats.
export function parseFlats(input: string): { flats: Flat[]; invalid: string[]; tooMany: boolean } {
  const chunks = input.toLowerCase().slice(0, 600).split(/[,;\n\r&+]+|\band\b/).map((c) => c.replace(/[\s\-_./]+/g, "")).filter(Boolean);
  const seen = new Set<string>();
  const flats: Flat[] = [];
  const invalid: string[] = [];

  const readOne = (s: string): { flat: Flat; len: number } | null => {
    // try 2-digit floor first (10-25), then 1-digit, then ground ("g")
    const tries = [/^([a-z])(\d{2})([a-z])/, /^([a-z])(\d)([a-z])/, /^([a-z])(g)([a-z])/];
    for (const re of tries) {
      const m = re.exec(s);
      if (!m) continue;
      const block = m[1].toUpperCase(), unit = m[3].toUpperCase();
      const floor = m[2] === "g" ? "G" : String(Number(m[2]));
      const floorOk = floor === "G" || (Number(floor) >= 1 && Number(floor) <= MAX_FLOOR);
      if (BLOCKS.includes(block) && floorOk && UNITS.includes(unit))
        return { flat: { code: `${block}-${floor}${unit}`, block, floor, unit }, len: m[0].length };
    }
    return null;
  };

  for (const chunk of chunks) {
    let rest = chunk;
    while (rest) {
      const r = readOne(rest);
      if (!r) { invalid.push(rest.slice(0, 12)); break; }
      rest = rest.slice(r.len);
      if (!seen.has(r.flat.code)) { seen.add(r.flat.code); flats.push(r.flat); }
    }
  }
  return { flats: flats.slice(0, MAX_FLATS_PER_REQUEST), invalid, tooMany: flats.length > MAX_FLATS_PER_REQUEST };
}
