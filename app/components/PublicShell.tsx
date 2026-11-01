import Link from "next/link";
import { Logo } from "./Logo";
import { LangSwitch } from "./LangProvider";
import { NusaBand } from "./NusaDecor";
import { getT } from "@/lib/i18n-server";

export function PublicHeader() {
  const t = getT();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <NusaBand />
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Logo dark />
        <div className="flex items-center gap-2"><LangSwitch /><Link href="/sign-in" className="hidden min-h-[40px] items-center px-3 text-sm font-semibold text-navy hover:text-brand sm:inline-flex">{t("Sign in")}</Link><Link href="/register" className="btn-solid !min-h-[40px] !px-4">{t("Create account")}</Link></div>
      </div>
    </header>
  );
}

export function PublicFooter({ email, whatsapp }: { email?: string; whatsapp?: string }) {
  return (
    <footer className="brand-panel brand-page">
      <NusaBand tumpal />
      <div className="bp-muted mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="text-sm leading-relaxed">Smartexam by AILO: an online exam and analysis platform for partner institutions, with AI analysis and an AI counselor, by AILO Telkom University.</p>
        </div>
        <FooterCol title="PROGRAM" links={[["How it works", "/#how"], ["AI Counselor", "/#counselor"], ["For institutions", "/#institutions"], ["FAQ", "/#faq"]]} />
        <FooterCol title="HELP" links={[["Sign in", "/sign-in"], ["Create account", "/register"], ["Forgot password", "/forgot-password"], ["Privacy Policy", "/privacy"], ["Terms & Conditions", "/terms"]]} />
        <div className="flex flex-col gap-2 text-sm">
          <p className="bp-muted text-xs font-semibold tracking-wider text-[#8FC6D4]">CONTACT</p>
          {email && <a href={`mailto:${email}`} className="hover:text-white">{email}</a>}
          {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="hover:text-white">WhatsApp {whatsapp}</a>}
        </div>
      </div>
      <div className="border-t border-navy-700 px-4 py-4 text-center text-xs sm:px-6">
        © {new Date().getFullYear()} AILO Telkom University. All rights reserved.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="bp-muted text-xs font-semibold tracking-wider text-[#8FC6D4]">{title}</p>
      {links.map(([l, h]) => <Link key={h} href={h} className="hover:text-white">{l}</Link>)}
    </div>
  );
}
