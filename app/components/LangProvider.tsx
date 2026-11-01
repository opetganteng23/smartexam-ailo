"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, translate, type Lang } from "@/lib/i18n";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, set] = useState<Lang>(initial);
  const router = useRouter();
  const setLang = (l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    set(l); router.refresh(); // komponen server ikut membaca cookie baru
  };
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useT() {
  const { lang } = useContext(Ctx);
  return (text: string, vars?: Record<string, string | number>) => translate(lang, text, vars);
}

/** Pemilih bahasa EN | ID. */
export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang } = useContext(Ctx);
  return (
    <span role="group" aria-label="Language" className={`inline-flex shrink-0 overflow-hidden rounded-lg border border-line text-xs font-semibold ${className}`}>
      {(["en", "id"] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => lang !== l && setLang(l)}
          className={`min-h-[32px] px-2.5 ${lang === l ? "bg-brand text-white" : "bg-white text-ink hover:bg-brand-tint"}`}>{l.toUpperCase()}</button>
      ))}
    </span>
  );
}
