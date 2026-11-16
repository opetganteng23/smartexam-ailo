"use client";

import DOMPurify from "dompurify";

const TAGS = ["p", "br", "b", "strong", "i", "em", "u", "sub", "sup", "code", "pre", "ul", "ol", "li", "blockquote", "span", "img", "table", "thead", "tbody", "tr", "th", "td"];

/** Sanitasi ulang di klien (lapis kedua setelah server). Gambar hanya dari /api/assets/<id>; tidak ada tautan, gaya, atau atribut lain. */
export function cleanStemHtml(html: string) {
  if (typeof window === "undefined" || !DOMPurify.isSupported) return "";
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ["src", "alt", "width", "height"], ALLOW_DATA_ATTR: false, ALLOWED_URI_REGEXP: /^\/api\/assets\/[0-9a-f]{24}$/ });
}

/** Teks soal: teks biasa (baris baru dipertahankan) atau HTML tersanitasi (kode, gambar, tabel). Dipakai sebagai judul soal (aria-level 2). */
export function QuestionStem({ stem, format, className = "" }: { stem: string; format?: string | null; className?: string }) {
  if (format === "html") return <div role="heading" aria-level={2} className={`qhtml ${className}`} dangerouslySetInnerHTML={{ __html: cleanStemHtml(stem) }} />;
  return <div role="heading" aria-level={2} className={`whitespace-pre-line ${className}`}>{stem}</div>;
}
