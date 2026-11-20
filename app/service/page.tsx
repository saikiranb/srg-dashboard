import { getQueue, type Kind } from "@/lib/service";
import SocietyHeader from "@/components/SocietyHeader";
import QueueSection from "@/components/QueueList";
import AutoRefresh from "@/components/AutoRefresh";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Service Requests · Sri Ram Garden" };

export default async function Service({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const reqs = await getQueue().catch(() => null);
  const kinds: Kind[] = kind === "electrician" ? ["electrician"] : kind === "plumber" ? ["plumber"] : ["electrician", "plumber"];
  const tab = (href: string, label: string, active: boolean) => (
    <Link href={href} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${active ? "bg-slate-900 text-white" : "bg-white"}`}>{label}</Link>
  );
  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-6">
      <SocietyHeader />
      <h2 className="text-center text-lg font-bold uppercase tracking-wide">Service Requests</h2>
      <p className="mb-4 text-center text-sm text-slate-500">Live queue for electrician &amp; plumber — updates automatically</p>
      <div className="mb-5 flex flex-wrap justify-center gap-2">
        {tab("/service", "All", kinds.length === 2)}
        {tab("/service?kind=electrician", "⚡ Electrician", kind === "electrician")}
        {tab("/service?kind=plumber", "🚰 Plumber", kind === "plumber")}
      </div>
      {reqs ? kinds.map((k) => <QueueSection key={k} kind={k} reqs={reqs} mode="public" />) : <p className="text-red-600">Unable to load requests right now.</p>}
      <AutoRefresh seconds={20} />
      <p className="mt-6 text-center text-xs text-slate-500">To raise a request, please contact the Facility Manager.</p>
    </main>
  );
}
