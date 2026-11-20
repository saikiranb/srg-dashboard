import { getResident } from "@/lib/resident";
import { getQueue, fmtAge, KIND_LABEL, type Req } from "@/lib/service";
import { residentLogoutAction, cancelResidentRequest } from "@/app/resident-actions";
import SocietyHeader from "@/components/SocietyHeader";
import ResidentLogin from "@/components/ResidentLogin";
import ResidentRaise from "@/components/ResidentRaise";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "Raise a request · Sri Ram Garden", robots: { index: false, follow: false } };

const pill: Record<string, string> = { Open: "bg-amber-100 text-amber-800", "In Progress": "bg-blue-100 text-blue-800", Closed: "bg-emerald-100 text-emerald-800" };

export default async function ResidentPage() {
  const me = await getResident();
  if (!me) return (<main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-6"><SocietyHeader /><ResidentLogin /></main>);

  const all = (await getQueue({ mobile: me.mobile }).catch(() => null)) ?? [];
  const mine = all.filter((r) => r.mine);
  const position = (r: Req) => all.filter((x) => x.kind === r.kind && x.status === "Open").findIndex((x) => x.id === r.id) + 1;
  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-6">
      <SocietyHeader />
      <div className="mb-4 flex items-center gap-3 text-sm">
        <div className="flex-1">Hello, <b>{me.name}</b> · {me.flats.join(", ")}</div>
        <form action={residentLogoutAction}><button className="text-slate-500 underline">Not you?</button></form>
      </div>
      <ResidentRaise flats={me.flats} />
      <h2 className="mb-2 mt-8 font-bold">Your requests today</h2>
      {mine.length === 0 && <p className="rounded-xl border bg-white p-4 text-center text-sm text-slate-500">No requests yet.</p>}
      <ul className="space-y-2">
        {mine.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-white p-3">
            <div className="min-w-0 flex-1 basis-32">
              <div className="font-bold">{r.kind === "electrician" ? "⚡" : "🚰"} {KIND_LABEL[r.kind]} · {r.flat}</div>
              <div className="text-xs text-slate-500">
                Raised {r.created}
                {r.status === "Open" && ` · you are #${position(r)} in the queue · waiting ${fmtAge(r.age_min)}`}
                {r.status === "In Progress" && r.attended && ` · being attended since ${r.attended}`}
                {r.status === "Closed" && r.closed && ` · closed ${r.closed}`}
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pill[r.status]}`}>{r.status}</span>
            {r.status === "Open" && (
              <form action={cancelResidentRequest}><input type="hidden" name="id" value={r.id} />
                <button className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600">Cancel</button></form>
            )}
          </li>
        ))}
      </ul>
      <AutoRefresh seconds={20} />
    </main>
  );
}
