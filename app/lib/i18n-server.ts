import { cookies } from "next/headers";
import { LANG_COOKIE, normLang, translate, type Lang } from "./i18n";

export const getLang = (): Lang => normLang(cookies().get(LANG_COOKIE)?.value);
export function getT() {
  const lang = getLang();
  return (text: string, vars?: Record<string, string | number>) => translate(lang, text, vars);
}
