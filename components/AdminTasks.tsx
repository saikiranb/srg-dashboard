"use client";
import { useActionState, useState, useTransition } from "react";
import type { Task } from "@/lib/db";
import { STATUSES, PRIORITIES } from "@/lib/db";
import { addTask, updateTask, deleteTask, setStatus, importExcel } from "@/app/actions";

const inp = "rounded-lg border px-3 py-2 bg-white w-full";

function Fields({ t }: { t?: Task }) {
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <input name="title" required maxLength={200} defaultValue={t?.title} placeholder="Task title" className={`${inp} sm:col-span-2`} />
      <textarea name="description" maxLength={2000} defaultValue={t?.description} placeholder="Description" className={`${inp} sm:col-span-2`} rows={2} />
      <input name="category" maxLength={60} defaultValue={t?.category} placeholder="Category (e.g. Plumbing)" className={inp} />
      <input name="assignee" maxLength={100} defaultValue={t?.assignee} placeholder="Assigned to" className={inp} />
      <select name="priority" defaultValue={t?.priority ?? "Medium"} className={inp}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
      <select name="status" defaultValue={t?.status ?? "Pending"} className={inp}>{STATUSES.map((p) => <option key={p}>{p}</option>)}</select>
      <input name="due_date" type="date" defaultValue={t?.due_date ?? ""} className={inp} />
    </div>
  );
}

function Row({ t }: { t: Task }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  if (edit)
    return (
      <li className="rounded-xl border bg-white p-4">
        <form action={async (fd) => { await updateTask(fd); setEdit(false); }} className="space-y-2">
          <input type="hidden" name="id" value={t.id} />
          <Fields t={t} />
          <div className="flex gap-2">
            <button className="rounded-lg bg-slate-900 text-white px-4 py-2">Save</button>
            <button type="button" onClick={() => setEdit(false)} className="rounded-lg border px-4 py-2">Cancel</button>
          </div>
        </form>
      </li>
    );
  return (
    <li className={`rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${pending ? "opacity-60" : ""}`}>
      <div className="flex-1">
        <div className="font-medium">{t.title}</div>
        <div className="text-xs text-slate-500">{[t.category, t.assignee, t.due_date && `Due ${t.due_date}`, t.priority].filter(Boolean).join(" · ")}</div>
      </div>
      <select value={t.status} onChange={(e) => start(() => setStatus(t.id, e.target.value))} className="rounded-lg border px-2 py-1.5 bg-white">
        {STATUSES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <button onClick={() => setEdit(true)} className="rounded-lg border px-3 py-1.5">Edit</button>
      <form action={deleteTask} onSubmit={(e) => { if (!confirm("Delete this task?")) e.preventDefault(); }}>
        <input type="hidden" name="id" value={t.id} />
        <button className="rounded-lg border border-red-200 text-red-600 px-3 py-1.5">Delete</button>
      </form>
    </li>
  );
}

export default function AdminTasks({ tasks }: { tasks: Task[] }) {
  const [imp, impAction, impPending] = useActionState(importExcel, null);
  return (
    <div className="space-y-8">
      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold mb-3">Add task</h2>
        <form action={async (fd) => { await addTask(fd); }} className="space-y-2">
          <Fields />
          <button className="rounded-lg bg-slate-900 text-white px-4 py-2">Add task</button>
        </form>
      </section>
      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold mb-1">Import from Excel</h2>
        <p className="text-xs text-slate-500 mb-3">First sheet; columns: Task, Description, Category, Assigned To, Priority, Status, Due Date.</p>
        <form action={impAction} className="flex flex-wrap items-center gap-3">
          <input type="file" name="file" accept=".xlsx" />
          <label className="text-sm"><input type="checkbox" name="replace" /> Replace all existing tasks</label>
          <button disabled={impPending} className="rounded-lg bg-slate-900 text-white px-4 py-2">{impPending ? "Importing…" : "Import"}</button>
        </form>
        {imp && "ok" in imp && <p className="text-sm text-emerald-700 mt-2">{imp.ok}</p>}
        {imp && "error" in imp && <p className="text-sm text-red-600 mt-2">{imp.error}</p>}
      </section>
      <section>
        <h2 className="font-semibold mb-3">All tasks ({tasks.length})</h2>
        <ul className="space-y-3">{tasks.map((t) => <Row key={t.id} t={t} />)}</ul>
      </section>
    </div>
  );
}
