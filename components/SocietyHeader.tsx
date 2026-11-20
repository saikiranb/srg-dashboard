import Image from "next/image";
import Link from "next/link";
import NavTabs from "@/components/NavTabs";

export default function SocietyHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="mb-6 border-b border-slate-400 pb-3">
      <div className="flex items-center gap-4">
        <Link href="/" className="shrink-0">
          <Image src="/logo.png" alt="Sri Ram Garden by Jains" width={123} height={62} priority className="h-14 w-auto sm:h-16" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold uppercase leading-tight tracking-tight text-[#c8202f] sm:text-3xl">
            Sri Ram Garden Flat Owners
          </h1>
          <p className="text-xs font-bold leading-snug text-slate-900 sm:text-sm">
            Mutually Aided Cooperative Maintenance Society Limited
          </p>
          <p className="text-[11px] font-bold text-slate-900 sm:text-xs">REG.NO : TS/MLKG/MACS/2022-21/FOW &amp; M</p>
        </div>
        {right && <div className="shrink-0 self-start text-sm">{right}</div>}
      </div>
      <NavTabs />
    </header>
  );
}
