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

export { htmlToText } from "./html-text";

/** HTML yang butuh format html (kode, gambar, tabel); selain itu cukup teks biasa. */
export const needsHtml = (html: string) => /<(pre|code|img|table)\b/i.test(html);
