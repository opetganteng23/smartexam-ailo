import sanitizeHtml from "sanitize-html";

// Teks soal berformat HTML (kode, gambar, tabel) dari impor Moodle atau editor. Whitelist ketat: tanpa script, style,
// iframe, event handler, atau URI selain gambar Smartexam (/api/assets/<id>). Dipanggil di server saat simpan dan saat kirim.
export function sanitizeQuestionHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "sub", "sup", "code", "pre", "ul", "ol", "li", "blockquote", "span", "img", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: { img: ["src", "alt", "width", "height"], "*": [] },
    allowedSchemes: [],
    allowedSchemesByTag: {},
    disallowedTagsMode: "discard",
    transformTags: { img: (_t, a) => ({ tagName: "img", attribs: /^\/api\/assets\/[0-9a-f]{24}$/.test(a.src ?? "") ? a : {} }) },
    exclusiveFilter: (f) => f.tag === "img" && !f.attribs.src,
  });
}

const ENT: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ", "&amp;": "&" };
/** HTML ke teks biasa: paragraf dan baris tetap terpisah, isi kode dipertahankan apa adanya. */
export function htmlToText(html: string) {
  const t = html.replace(/<\/p>|<br\s*\/?>|<\/pre>|<\/li>|<\/tr>/gi, "\n").replace(/<[^>]+>/g, "");
  return t.replace(/&(lt|gt|quot|#39|apos|nbsp|amp);/g, (m) => ENT[m] ?? m).replace(/\n{3,}/g, "\n\n").trim();
}

/** HTML yang butuh format html (kode, gambar, tabel); selain itu cukup teks biasa. */
export const needsHtml = (html: string) => /<(pre|code|img|table)\b/i.test(html);
