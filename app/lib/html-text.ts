const ENT: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ", "&amp;": "&" };
/** HTML ke teks biasa: paragraf dan baris tetap terpisah, isi kode dipertahankan apa adanya. Aman dipakai di klien (tanpa pustaka). */
export function htmlToText(html: string) {
  const t = html.replace(/<\/p>|<br\s*\/?>|<\/pre>|<\/li>|<\/tr>/gi, "\n").replace(/<[^>]+>/g, "");
  return t.replace(/&(lt|gt|quot|#39|apos|nbsp|amp);/g, (m) => ENT[m] ?? m).replace(/\n{3,}/g, "\n\n").trim();
}
