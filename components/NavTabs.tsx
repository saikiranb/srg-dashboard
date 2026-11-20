"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Pending Works" },
  { href: "/service", label: "Service Requests" },
  { href: "/staff", label: "Staff Login" },
];

export default function NavTabs() {
  const path = usePathname();
  return (
    <nav className="mt-3 flex gap-2 overflow-x-auto text-sm" aria-label="Main">
      {tabs.map((t) => {
        const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 font-medium ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 hover:bg-slate-100"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
