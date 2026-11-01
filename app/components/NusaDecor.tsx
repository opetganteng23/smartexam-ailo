/** Hiasan tema Nusantara tanpa teks: pita merah putih dan deret tumpal (motif songket) berwarna emas. */
export function NusaBand({ tumpal = false }: { tumpal?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none">
      <div className="nusa-band" />
      {tumpal && <div className="nusa-tumpal nusa-songket-g" />}
    </div>
  );
}

/** Lapisan pola batik di belakang konten. `tone` w = garis putih (latar gelap), d = garis navy (latar terang). */
export function BatikLayer({ pattern = "kawung", tone = "w", className = "" }: { pattern?: "kawung" | "parang" | "mega"; tone?: "w" | "d"; className?: string }) {
  return <div aria-hidden className={`nusa-drift nusa-${pattern}-${tone} pointer-events-none absolute inset-0 ${className}`} />;
}
