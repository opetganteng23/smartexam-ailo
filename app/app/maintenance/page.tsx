import Image from "next/image";
import { getMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Under maintenance | Smartexam by AILO", robots: { index: false } };

// Ditampilkan middleware (rewrite) untuk semua halaman non-admin selama mode pemeliharaan aktif.
export default async function MaintenancePage() {
  const m = await getMaintenance().catch(() => ({ message: "" }));
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 brand-panel brand-page px-6 py-16 text-center">
      <span className="logo-card rounded-2xl bg-white px-4 py-2"><Image src="/brand/logo.png" alt="Smartexam by AILO" width={693} height={666} priority className="h-24 w-auto" /></span>
      <h1 className="max-w-xl font-display text-3xl font-extrabold leading-tight sm:text-[42px]">We are doing some maintenance.</h1>
      <p className="bp-muted max-w-lg text-lg leading-relaxed text-mist">{m.message || "The site is temporarily unavailable while we improve it. Please check back soon. Your data and progress are safe."}</p>
      <p className="bp-muted text-sm text-[#BFE3EC]">Thank you for your patience.</p>
    </main>
  );
}
