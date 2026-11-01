import { getT } from "@/lib/i18n-server";
import { BatikLayer } from "./NusaDecor";
import { WayangStage } from "./WayangStage";

// Motif abstrak dari berbagai daerah (gambar sederhana, bukan reproduksi kain asli).
const MOTIFS: { cls: string; region: string; name: string }[] = [
  { cls: "parang", region: "Jawa", name: "Parang" },
  { cls: "mega", region: "Cirebon", name: "Mega Mendung" },
  { cls: "poleng", region: "Bali", name: "Poleng" },
  { cls: "songket", region: "Sumatra", name: "Songket" },
  { cls: "sasirangan", region: "Kalimantan", name: "Sasirangan" },
  { cls: "ikat", region: "Nusa Tenggara", name: "Tenun Ikat" },
  { cls: "patedong", region: "Sulawesi", name: "Pa'tedong" },
  { cls: "sentani", region: "Papua", name: "Sentani" },
];

function Group({ hidden }: { hidden?: boolean }) {
  return (
    <div className="marquee-group" aria-hidden={hidden || undefined}>
      {MOTIFS.map((m, i) => (
        <figure key={m.cls} className="nusa-motif nusa-sway h-32 w-44 shrink-0" style={{ animationDelay: `${-i * 1.1}s` }}>
          <div className={`nusa-drift nusa-${m.cls}-g absolute inset-0 opacity-70`} style={{ animationDuration: `${50 + i * 7}s` }} />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy to-transparent px-3 pb-2.5 pt-8">
            <span className="block text-sm font-semibold text-white">{m.name}</span>
            <span className="block text-xs text-[#BFE3EC]">{m.region}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function BhinnekaSection() {
  const t = getT();
  return (
    <section className="relative overflow-hidden bg-navy text-white" aria-labelledby="bhinneka">
      <BatikLayer pattern="kawung" tone="w" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-6 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:px-10 lg:pt-20">
        <div className="flex max-w-3xl flex-col gap-3">
          <p className="text-xs font-semibold tracking-[.25em] text-accent">{t("FROM SABANG TO MERAUKE")}</p>
          <h2 id="bhinneka" className="font-display text-4xl font-extrabold leading-tight sm:text-5xl">Bhinneka Tunggal Ika</h2>
          <p className="text-lg leading-relaxed text-[#D9F0F5]">{t("Unity in diversity. Smartexam is built for learners and institutions across Indonesia, whatever their region, language, or subject.")}</p>
        </div>
        <WayangStage />
      </div>
      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 lg:px-10 lg:pb-20">
        <div className="marquee" role="presentation">
          <div className="marquee-track marquee-slow"><Group /><Group hidden /></div>
        </div>
      </div>
    </section>
  );
}
