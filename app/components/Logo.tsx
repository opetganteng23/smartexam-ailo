import Link from "next/link";
import Image from "next/image";

/** Logo Smartexam by AILO (lambang AILO dan tagline ada di gambar, latar transparan). `dark` = di atas latar terang; default = di atas latar gelap, dibungkus kartu putih (hilang bila panel memakai gambar latar). */
export function Logo({ dark = false, className = "" }: { dark?: boolean; sub?: boolean; className?: string }) {
  const img = <Image src="/brand/logo.png" alt="Smartexam by AILO" width={693} height={666} priority className="h-14 w-auto sm:h-16" />;
  return (
    <Link href="/" aria-label="Smartexam by AILO, home" className={`inline-flex shrink-0 items-center self-start no-underline ${dark ? "" : "logo-card rounded-xl bg-white px-3 py-1.5"} ${className}`}>
      {img}
    </Link>
  );
}
