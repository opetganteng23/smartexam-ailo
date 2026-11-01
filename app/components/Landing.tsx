import Link from "next/link";
import { getT } from "@/lib/i18n-server";
import { Logo } from "./Logo";
import { PublicFooter } from "./PublicShell";
import { BhinnekaSection } from "./BhinnekaSection";
import { BatikLayer, NusaBand } from "./NusaDecor";
import { Reveal, HeaderShell } from "./LandingFx";
import { DesktopNav, MobileMenu } from "./LandingNav";
import { NusantaraScene } from "./NusantaraScene";
import { TextMarquee, LogoMarquee } from "./Marquee";
import { LANDING_DEFAULTS, type LandingSettings } from "@/lib/landing-settings";

// Landing publik (desain Redesign Website). Tanpa harga, pendaftaran, atau free trial:
// akses hanya lewat institusi mitra, jadi CTA = Sign in + kontak untuk institusi.

const Check = ({ color = "#1D6B3F" }: { color?: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);

const Eyebrow = ({ children, className = "text-accent-dark" }: { children: React.ReactNode; className?: string }) => (
  <span className={`text-sm font-semibold tracking-[1.5px] ${className}`}>{children}</span>
);

const STEPS = [
  { n: 1, bg: "bg-brand", t: "Take the exam", d: "Timed sections in a secure test room that records tab switches and fullscreen exits." },
  { n: 2, bg: "bg-accent-dark", t: "Get your results", d: "Estimated score, score per section, and a proctoring summary right after you submit." },
  { n: 3, bg: "bg-success", t: "Understand your answers", d: "Analysis shows your error patterns per question type and the reasons behind your score." },
  { n: 4, bg: "bg-navy", t: "Report to your institution", d: "Group results, PDF and Excel reports, and an executive summary for every exam day." },
];

const AUDIENCE = [
  ["High school students", "Preparing for graduation, scholarships, and further study."],
  ["University students", "Graduation requirements, master's programs, and scholarships."],
  ["Professionals", "Recruitment requirements, promotions, and global careers."],
  ["Government agencies", "Competency development for civil servants and officials."],
  ["Companies", "Mapping your employees' skills and competencies."],
  ["Campuses & schools", "Measuring and improving the quality of graduates."],
];

const FAQ = [
  ["What is Smartexam?", "Smartexam by AILO combines online exams with detailed analysis of every section and question type. Scores are estimates from the exam you took and are reported to your institution."],
  ["How do I get access?", "Access is provided through partner institutions. Create an account with the institution code you received, or use the invitation email from your institution. You can sign in with your password or with a one-time code sent to your email."],
  ["What device do I need?", "A laptop or PC with headphones and a stable connection. The test room runs in fullscreen, and leaving the test tab is recorded."],
  ["Is my data safe?", "Your data is used only for your learning and your institution's reports. The AI receives scores and answers without your name or contact details. You can download your data or request deletion from your profile."],
  ["I forgot my password. What should I do?", "Use Forgot password on the sign-in page and we will email you a link to set a new one. You can also sign in with a one-time email code: use the code from the newest email, shown in the email subject and valid for 5 minutes."],
  ["My institution wants to join. How?", "Contact us using the details at the bottom of this page. We will set up your institution, participant seats, and test schedules."],
];

export function Landing({ email, whatsapp, settings = LANDING_DEFAULTS }: { email?: string; whatsapp?: string; settings?: LandingSettings }) {
  const t = getT();
  const hero = settings;
  const dark = hero.theme === "dark";
  const contact = email ? `mailto:${email}?subject=${encodeURIComponent("Smartexam by AILO for our institution")}` : whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : "/support";
  return (
    <div className="bg-canvas text-ink">
      <NusaBand />
      <noscript><style>{".reveal,.fx-fade-up,.fx-pop,.chat-in{opacity:1!important;transform:none!important;animation:none!important}"}</style></noscript>
      <HeaderShell className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur transition-shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Logo dark />
          <DesktopNav />
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="hidden min-h-[44px] items-center px-3 text-[15px] font-semibold text-navy hover:text-brand sm:inline-flex">{t("Sign in")}</Link>
            <Link href="/register" className="btn-solid btn-lift !min-h-[44px] !px-5">{t("Create account")}</Link>
            <MobileMenu />
          </div>
        </div>
      </HeaderShell>

      <main>
        {/* Hero (judul, deskripsi, dan latar dapat diatur admin di Settings) */}
        <section className={`relative overflow-hidden ${dark ? "bg-navy text-white" : "bg-white"}`}>
          {hero.bgImageId ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/assets/${hero.bgImageId}`} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0" style={{ background: dark ? `rgba(10,66,86,${hero.overlay / 100})` : `rgba(255,255,255,${hero.overlay / 100})` }} aria-hidden />
            </>
          ) : (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <div className="fx-drift absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-brand/10 blur-3xl" />
              <div className="fx-drift absolute -bottom-32 right-1/3 h-[360px] w-[360px] rounded-full bg-accent/20 blur-3xl" style={{ animationDelay: "-6s" }} />
              <div className="fx-drift absolute right-[-80px] top-10 h-[300px] w-[300px] rounded-full bg-brand/10 blur-3xl" style={{ animationDelay: "-10s" }} />
            </div>
          )}
          <BatikLayer pattern="kawung" tone={dark ? "w" : "d"} />
          <div className={`relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 py-10 sm:px-6 md:py-14 lg:gap-14 lg:px-10 lg:py-16 lg:py-24`}>
            <div className="flex flex-1 flex-col gap-7">
              {hero.badge && (
                <span className={`fx-fade-up inline-flex items-center gap-2 self-start rounded-full px-3.5 py-2 text-[13px] font-semibold ${dark ? "bg-white/15 text-white" : "bg-brand-tint text-brand-dark"}`}>
                  <span className="fx-ring h-2 w-2 rounded-full bg-accent" />{hero.badge}
                </span>
              )}
              <h1 className={`fx-fade-up font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[58px] ${dark ? "text-white" : "text-navy"}`} style={{ "--d": "120ms" } as React.CSSProperties}>{hero.title}</h1>
              {hero.subtitle && <p className={`fx-fade-up max-w-xl text-lg leading-relaxed sm:text-[19px] ${dark ? "text-[#D9F0F5]" : "text-[#3F565F]"}`} style={{ "--d": "240ms" } as React.CSSProperties}>{hero.subtitle}</p>}
              <div className="fx-fade-up flex flex-col gap-3 sm:flex-row sm:items-center" style={{ "--d": "360ms" } as React.CSSProperties}>
                <Link href="/register" className="btn-lift inline-flex h-14 items-center justify-center rounded-xl bg-brand px-7 text-[17px] font-semibold text-white hover:bg-brand-dark">{t("Create account")}</Link>
                <Link href="/sign-in" className={`btn-lift inline-flex h-14 items-center justify-center rounded-xl border-[1.5px] px-7 text-[17px] font-semibold hover:border-brand ${dark ? "border-white/50 bg-white/10 text-white" : "border-line-strong bg-white text-navy"}`}>{t("Sign in")}</Link>
                <a href="#institutions" className={`btn-lift inline-flex h-14 items-center justify-center rounded-xl border-[1.5px] px-7 text-[17px] font-semibold hover:border-brand ${dark ? "border-white/50 bg-white/10 text-white" : "border-line-strong bg-white text-navy"}`}>{t("For institutions")}</a>
              </div>
              <div className={`fx-fade-up flex flex-wrap gap-x-5 gap-y-1 text-sm ${dark ? "text-[#D9F0F5]" : "text-ink-soft"}`} style={{ "--d": "480ms" } as React.CSSProperties}>
                <span>{t("Register with your institution code")}</span><span className="opacity-40" aria-hidden>|</span><span>{t("Password or email code")}</span>
              </div>
            </div>
          </div>
        </section>

        <NusantaraScene />

        {/* Mitra: logo berjalan (nama dan logo diatur admin di Settings) */}
        <LogoMarquee partners={hero.partners} label={t("DEVELOPED AND OWNED BY")} />

        {/* Cara kerja */}
        <section id="how" className="mx-auto flex max-w-7xl scroll-mt-20 flex-col gap-12 px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end lg:gap-10">
            <div className="flex max-w-3xl flex-col gap-4">
              <Eyebrow>{t("HOW IT WORKS")}</Eyebrow>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-navy sm:text-[42px]">{t("Take the exam. Understand the result.")}</h2>
            </div>
            <p className="max-w-[460px] leading-relaxed text-[#3F565F]">{t("Every result comes with an explanation of where points were lost, so you know exactly what to work on next.")}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 100} className="h-full"><div className="hover-lift group flex h-full flex-col gap-3 rounded-2xl border border-line bg-white p-7">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white transition-transform duration-300 group-hover:scale-110 ${s.bg}`}>{s.n}</span>
                <span className="text-xl font-semibold text-navy">{t(s.t)}</span>
                <span className="text-[15px] leading-relaxed text-ink-soft">{t(s.d)}</span>
              </div></Reveal>
            ))}
          </div>
        </section>

        <TextMarquee items={hero.marquee} tone="navy" />

        {/* Institusi */}
        <section id="institutions" className="scroll-mt-20 bg-navy text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-12 sm:px-6 lg:flex-row lg:gap-16 lg:px-10 lg:py-16">
            <div className="flex flex-1 flex-col gap-6">
              <Eyebrow className="text-[#F3D68A]">{t("FOR INSTITUTIONS")}</Eyebrow>
              <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-[42px]">{t("Campuses, agencies & companies.")}</h2>
              <p className="max-w-xl text-[17px] leading-relaxed text-mist">{t("Smartexam by AILO is provided through partner institutions. You run the exams for your participants; we provide the tests, the analysis, and the reports.")}</p>
              <div className="max-w-xl overflow-hidden rounded-[14px] border border-[#2A7C94]">
                <div className="grid grid-cols-2 bg-navy-700 px-5 py-3.5 text-[13px] font-semibold text-[#BFE3EC]"><span>{t("Setting")}</span><span>{t("How it works")}</span></div>
                {[["Questions", "Chosen from your own question bank"], ["Time", "Set per section"], ["Test room", "Secure and monitored"]].map(([s, d]) => (
                  <div key={s} className="grid grid-cols-2 border-t border-[#2A7C94] px-5 py-3.5 text-[15px] transition-colors hover:bg-navy-700"><span className="font-semibold">{t(s)}</span><span className="text-mist">{t(d)}</span></div>
                ))}
              </div>
              <p className="text-sm text-[#BFE3EC]">{t("Build exams from your own question bank.")}</p>
            </div>
            <Reveal className="w-full max-w-[480px] self-center" delay={150}><div className="hover-lift flex w-full flex-col gap-5 rounded-[20px] bg-white p-8 text-ink">
              <span className="font-display text-[22px] font-extrabold text-navy">{t("What your institution gets")}</span>
              <ul className="flex flex-col gap-3.5 text-base">
                {["Bulk participant invites by email or Excel import", "A dashboard of group results and progress", "PDF and Excel reports per participant and per group", "Group schedules for every exam day", "A proctoring summary for each submission"].map((x) => <li key={x} className="flex gap-3"><Check color="#00809C" /><span>{t(x)}</span></li>)}
              </ul>
              <a href={contact} className="btn-lift inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark">{t("Contact us")}</a>
            </div></Reveal>
          </div>
        </section>

        {/* Untuk siapa */}
        <section className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
          <div className="flex flex-col gap-4">
            <Eyebrow>{t("WHO IT IS FOR")}</Eyebrow>
            <h2 className="font-display text-3xl font-extrabold leading-tight text-navy sm:text-[42px]">{t("Designed for every learner.")}</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCE.map(([at, ad], i) => (
              <Reveal key={at} delay={(i % 3) * 90} className="h-full"><div className="hover-lift flex h-full flex-col gap-2 rounded-2xl border border-line bg-white p-6"><span className="text-lg font-semibold text-navy">{t(at)}</span><span className="text-[15px] leading-relaxed text-ink-soft">{t(ad)}</span></div></Reveal>
            ))}
          </div>
        </section>

        <TextMarquee items={[...hero.marquee].reverse()} tone="gold" reverse />

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[360px_1fr] lg:gap-16 lg:px-10 lg:py-16">
            <div className="flex flex-col gap-4">
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-navy sm:text-[42px]">{t("Frequently asked questions")}</h2>
              {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="font-semibold text-brand">{t("Ask us on WhatsApp")}</a>}
            </div>
            <div className="flex flex-col divide-y divide-line border-y border-line">
              {FAQ.map(([q, a], i) => (
                <details key={q} className="group py-1" open={i === 0}>
                  <summary className="flex min-h-[56px] cursor-pointer transition-colors hover:text-brand list-none items-center justify-between gap-4 py-3 text-left text-[17px] font-semibold text-navy [&::-webkit-details-marker]:hidden">
                    {t(q)}<span className="text-2xl font-normal text-brand group-open:hidden" aria-hidden>+</span><span className="hidden text-2xl font-normal text-brand group-open:inline" aria-hidden>-</span>
                  </summary>
                  <p className="faq-body pb-5 pr-8 leading-relaxed text-ink-soft">{t(a)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <BhinnekaSection />

        {/* CTA akhir */}
        <section className="bg-brand">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-10 text-white sm:px-6 lg:flex-row lg:items-center lg:px-10">
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-[38px]">{t("Learning should not be guesswork.")}</h2>
              <p className="text-lg text-[#D9F0F5]">{t("Start by knowing your score today.")}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link href="/register" className="btn-lift inline-flex h-14 items-center justify-center rounded-xl bg-white px-8 text-[17px] font-semibold text-brand hover:bg-brand-tint">{t("Create account")}</Link>
              <Link href="/sign-in" className="btn-lift inline-flex h-14 items-center justify-center rounded-xl border-[1.5px] border-white/60 px-8 text-[17px] font-semibold text-white hover:bg-white/10">{t("Sign in")}</Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter email={email} whatsapp={whatsapp} />
    </div>
  );
}
