import { getQueue } from "@/lib/service";
import { getStaff, ROLE_LABEL } from "@/lib/staff";
import { staffLogoutAction } from "@/app/service-actions";
import SocietyHeader from "@/components/SocietyHeader";
import StaffLogin from "@/components/StaffLogin";
import RaiseRequest from "@/components/RaiseRequest";
import QueueSection from "@/components/QueueList";
import AutoRefresh from "@/components/AutoRefresh";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff · Sri Ram Garden", robots: { index: false, follow: false } };

export default async function Staff() {
  const me = await getStaff();
  if (!me) {
    return (<main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-6"><SocietyHeader /><StaffLogin /></main>);
  }
  const reqs = (await getQueue(me.id).catch(() => null)) ?? [];
  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-6">
      <SocietyHeader />
      <div className="mb-5 flex items-center gap-3 text-sm">
        <div className="flex-1"><b>{me.name}</b> · {ROLE_LABEL[me.role]}</div>
        {me.role === "fm" && <Link href="/staff/analytics" className="underline">Analytics</Link>}
        <form action={staffLogoutAction}><button className="underline text-slate-500">Log out</button></form>
      </div>
      {me.role === "fm" ? (
        <>
          <RaiseRequest allowed={["electrician", "plumber"]} />
          <QueueSection kind="electrician" reqs={reqs} mode="fm" />
          <QueueSection kind="plumber" reqs={reqs} mode="fm" />
        </>
      ) : (
        <>
          <RaiseRequest allowed={[me.role]} />
          <QueueSection kind={me.role} reqs={reqs} mode={me.role} />
        </>
      )}
      <AutoRefresh seconds={15} />
    </main>
  );
}
