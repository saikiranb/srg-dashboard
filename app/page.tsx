import Link from "next/link";
import { getTasks } from "@/lib/db";
import TaskBoard from "@/components/TaskBoard";
import SocietyHeader from "@/components/SocietyHeader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tasks = await getTasks().catch(() => null);
  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <SocietyHeader right={<Link href="/admin" className="text-slate-500 underline">Admin</Link>} />
      <h2 className="text-lg font-bold uppercase tracking-wide text-center">Pending Works</h2>
      <p className="text-sm text-slate-500 text-center mb-5">Live status of pending and completed works</p>
      {tasks ? <TaskBoard tasks={tasks} /> : <p className="text-red-600">Unable to load tasks right now.</p>}
      <footer className="mt-10 border-t border-slate-300 pt-3 text-center text-xs text-slate-500">
        Sri Ram Garden, Sy.No.85, Suchitra Circle, Beside Suchitra Academy,<br />
        Jeedimatla (V), Quthbullapur (M), Medchal - Malkajgiri (D) - 500067
      </footer>
    </main>
  );
}
