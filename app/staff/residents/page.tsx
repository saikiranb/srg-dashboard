import { redirect } from "next/navigation";
import Link from "next/link";
import { ensureTable, sql } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getStaff } from "@/lib/staff";
import SocietyHeader from "@/components/SocietyHeader";
import ResidentsAdmin, { type ResidentRow } from "@/components/ResidentsAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Residents · Sri Ram Garden", robots: { index: false, follow: false } };

export default async function Residents() {
  const admin = await isAdmin();
  const me = await getStaff();
  if (!admin && me?.role !== "fm") redirect("/staff");
  await ensureTable();
  const rows = (await sql()`SELECT id, name, mobile, flat FROM residents ORDER BY flat, name`) as ResidentRow[];
  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-6">
      <SocietyHeader right={<Link href={admin ? "/admin" : "/staff"} className="underline text-slate-500">Back</Link>} />
      <h2 className="mb-4 text-center text-lg font-bold uppercase tracking-wide">Residents &amp; mobile numbers</h2>
      <ResidentsAdmin residents={rows} />
    </main>
  );
}
