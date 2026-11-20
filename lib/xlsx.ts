import { readSheet } from "read-excel-file/node";

// Hardened .xlsx reading shared by every import (pending works, residents).
const MAX_FILE = 1_000_000;      // 1 MB upload
const MAX_UNZIPPED = 20_000_000; // zip-bomb guard

// Sum declared uncompressed sizes from the zip central directory before parsing.
function zipLooksSafe(b: Buffer) {
  if (b.length < 22 || b.readUInt32LE(0) !== 0x04034b50) return false;
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--)
    if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return false;
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  if (count > 1000) return false;
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > b.length || b.readUInt32LE(p) !== 0x02014b50) return false;
    total += b.readUInt32LE(p + 24);
    p += 46 + b.readUInt16LE(p + 28) + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
    if (total > MAX_UNZIPPED) return false;
  }
  return true;
}

export async function readXlsx(file: unknown, maxRows: number): Promise<{ data: unknown[][] } | { error: string }> {
  if (!(file instanceof File) || !file.size) return { error: "Choose an .xlsx file" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "Only .xlsx files are accepted" };
  if (file.size > MAX_FILE) return { error: "File too large (max 1 MB)" };
  const buf = Buffer.from(await file.arrayBuffer());
  if (!zipLooksSafe(buf)) return { error: "Not a valid .xlsx file" };
  let data: unknown[][];
  try { data = (await readSheet(buf)) as unknown[][]; } catch { return { error: "Could not read the spreadsheet" }; }
  if (data.length < 2) return { error: "No data rows found" };
  if (data.length - 1 > maxRows) return { error: `Too many rows (max ${maxRows})` };
  return { data };
}

// strip control chars, normalise, trim, cap length
export const clean = (v: unknown, max: number) =>
  String(v ?? "").normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);

export function cell(v: unknown, max: number): string {
  if (v instanceof Date) return isNaN(+v) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return clean(v, max);
  return "";
}

export function colIndex(header: string[], ...names: string[]) {
  return header.findIndex((h) => names.includes(h));
}
