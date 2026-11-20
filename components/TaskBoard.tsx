"use client";
import { useMemo, useState } from "react";
import type { Task } from "@/lib/db";

const badge: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-emerald-100 text-emerald-800",
};
const prio: Record<string, string> = {
  High: "text-red-600", Medium: "text-amber-600", Low: "text-slate-500",
};

export default function TaskBoard({ tasks }: { tasks: Task[] }) {
  const [status, setStatus] = useState("All");
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const cats = useMemo(() => ["All", ...Array.from(new Set(tasks.map((t) => t.category).filter(Boolean)))], [tasks]);
  const count = (s: string) => tasks.filter((t) => t.status === s).length;
  const today = new Date().toISOString().slice(0, 10);
  const shown = tasks.filter((t) =>
    (status === "All" || t.status === status) &&
    (cat === "All" || t.category === cat) &&
    (t.title + t.description + t.assignee).toLowerCase().includes(q.toLowerCase()));
  const pct = tasks.length ? Math.round((count("Completed") / tasks.length) * 100) : 0;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[["All", tasks.length], ["Pending", count("Pending")], ["In Progress", count("In Progress")], ["Completed", count("Completed")]].map(([s, n]) => (
          <button key={s} onClick={() => setStatus(s as string)}
            className={`rounded-xl border p-4 text-left bg-white hover:shadow ${status === s ? "ring-2 ring-slate-900" : ""}`}>
            <div className="text-2xl font-semibold">{n}</div>
            <div className="text-sm text-slate-500">{s === "All" ? "Total tasks" : s}</div>
          </button>
        ))}
      </div>
      <div className="mb-4 h-2 rounded bg-slate-200 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
      <p className="text-sm text-slate-500 mb-4">{pct}% complete</p>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="flex-1 rounded-lg border px-3 py-2 bg-white" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border px-3 py-2 bg-white">
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <ul className="space-y-3">
        {shown.map((t) => (
          <li key={t.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">{t.title}</h3>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge[t.status]}`}>{t.status}</span>
            </div>
            {t.description && <p className="text-sm text-slate-600 mt-1">{t.description}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {t.category && <span>📁 {t.category}</span>}
              {t.assignee && <span>👤 {t.assignee}</span>}
              <span className={prio[t.priority]}>● {t.priority} priority</span>
              {t.due_date && <span className={t.status !== "Completed" && t.due_date < today ? "text-red-600 font-medium" : ""}>📅 Due {t.due_date}{t.status !== "Completed" && t.due_date < today ? " (overdue)" : ""}</span>}
            </div>
          </li>
        ))}
        {!shown.length && <li className="text-center text-slate-500 py-10">No tasks found.</li>}
      </ul>
    </div>
  );
}
