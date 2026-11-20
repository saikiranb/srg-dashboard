import type { Engagement } from "@/lib/service";

const LABEL = { electrician: "Electrician", plumber: "Plumber" } as const;
const ICON = { electrician: "⚡", plumber: "🚰" } as const;

// Shown to everyone when the FM has marked the electrician/plumber as busy with society common work.
export default function BusyBanner({ items }: { items: Engagement[] }) {
  if (!items.length) return null;
  return (
    <div className="mb-4 space-y-2">
      {items.map((e) => (
        <div key={e.kind} role="status" className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
          <div className="font-bold">🚧 {ICON[e.kind]} {LABEL[e.kind]} is on society work</div>
          <div className="mt-0.5">{e.note}</div>
          <div className="mt-0.5 text-xs text-orange-800">
            Since {e.since}{e.until && ` · expected free by ${e.until}`} · flat requests are queued and will be attended after this.
          </div>
        </div>
      ))}
    </div>
  );
}
