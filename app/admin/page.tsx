import Link from "next/link";
import { getTasks } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { logoutAction } from "@/app/actions";
import AdminTasks from "@/components/AdminTasks";
import SocietyHeader from "@/components/SocietyHeader";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Apartment Tasks", robots: { index: false, follow: false } };

export default async function Admin() {
  const admin = await isAdmin();
  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <SocietyHeader right={
        <div className="flex gap-4">
          <Link href="/" className="underline text-slate-500">View site</Link>
          {admin && <form action={logoutAction}><button className="underline text-slate-500">Log out</button></form>}
        </div>
      } />
      <h2 className="text-lg font-bold uppercase tracking-wide text-center mb-5">Admin</h2>
      {admin ? <AdminTasks tasks={await getTasks()} /> : <LoginForm />}
    </main>
  );
}
