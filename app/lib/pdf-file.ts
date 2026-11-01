// Validasi berkas PDF untuk unggahan materi.
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const isPdf = (b: Buffer) => b.length > 4 && b.subarray(0, 4).toString("latin1") === "%PDF";
