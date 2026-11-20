"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const publicTabs = [
  { href: "/", label: "Pending Works" },
  { href: "/service", label: "Service Requests" },
  { href: "/staff", label: "Staff Login" },
];
// signed-in FM / electrician / plumber only get the requests module
const staffTabs = [
  { href: "/staff", label: "My Dashboard" },
  { href: "/service", label: "Service Requests" },
];

export default function NavTabs({ staff = false }: { staff?: boolean }) {
  const path = usePathname();
  const tabs = staff ? staffTabs : publicTabs;
  return (
    <nav className={`mt-3 grid gap-2 text-xs sm:text-sm ${tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} aria-label="Main">
      {tabs.map((t) => {
        const active = t.href === "/" ? path === "/" : t.href === "/staff" ? path.startsWith("/staff") : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={`rounded-full border px-2 py-2 text-center font-medium leading-tight ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 hover:bg-slate-100"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
