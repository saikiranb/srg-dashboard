// Flat-code parser: "b4g" -> B-4G, "bgg" -> B-GG (Block B, Ground floor, unit G), "a6i" -> A-6I
// Society layout.
//  A block: residential floors 6-12 only (lower floors are commercial, not ours), flats A-I on each floor.
//  B block: ground floor GA, GB, GC, GD, GE, GF, GG, GI (no GH); floors 1-14 have flats A-J.
type BlockLayout = { ground: string; min: number; max: number; units: string };
export const LAYOUT: Record<string, BlockLayout> = {
  A: { ground: "", min: 6, max: 12, units: "ABCDEFGHI" },
  B: { ground: "ABCDEFGI", min: 1, max: 14, units: "ABCDEFGHIJ" },
};
export const BLOCKS = Object.keys(LAYOUT).join("");
// Duplex flats: one flat over two floors. Any request for the upper code goes to the entrance flat.
export const DUPLEX: Record<string, string> = { "B-4E": "B-3E" }; // B-3E + B-4E duplex, entrance from 3E
export const LAYOUT_HINT = "A block: floors 6–12, flats A–I · B block: ground GA–GG & GI, floors 1–14 flats A–J";

export function flatExists(block: string, floor: string, unit: string) {
  const l = LAYOUT[block];
  if (!l) return false;
  if (floor === "G") return l.ground.includes(unit);
  const f = Number(floor);
  return f >= l.min && f <= l.max && l.units.includes(unit);
}

// Every valid flat code, e.g. for counting / checks
export function allFlats(): string[] {
  const out: string[] = [];
  for (const [b, l] of Object.entries(LAYOUT)) {
    for (const u of l.ground) out.push(`${b}-G${u}`);
    for (let f = l.min; f <= l.max; f++) for (const u of l.units) if (!DUPLEX[`${b}-${f}${u}`]) out.push(`${b}-${f}${u}`);
  }
  return out;
}

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
      if (flatExists(block, floor, unit))
      {
        const raw = `${block}-${floor}${unit}`;
        const code = DUPLEX[raw] ?? raw; // e.g. b4e -> B-3E (duplex entrance)
        const [, f2, u2] = /^[A-Z]-(G|\d{1,2})([A-Z])$/.exec(code)!;
        return { flat: { code, block, floor: f2, unit: u2 }, len: m[0].length };
      }
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
