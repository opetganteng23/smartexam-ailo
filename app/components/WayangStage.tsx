// Panggung wayang kulit (SVG orisinal, bergaya datar): kelir bercahaya blencong, gunungan di tengah, dua tokoh bergoyang.
// Dekoratif saja: aria-hidden; animasi mati bila pengguna memilih reduce motion.
const DEEP = "#0A4256", CREAM = "#FFF4E4", ORANGE = "#F07020", WOOD = "#8A5A2B";

/** Tokoh wayang menghadap kanan; kaki di titik (0,0). Cermin dengan scale(-1,1) untuk menghadap kiri. */
function Puppet({ crown = 1, delay = 0 }: { crown?: number; delay?: number }) {
  return (
    <g>
      <line x1="0" y1="-96" x2="0" y2="64" stroke={WOOD} strokeWidth="3.5" />
      <g className="wayang-sway o-bottom" style={{ animationDelay: `${delay}s` }}>
        {/* lengan belakang */}
        <path d="M-14 -158 Q-30 -122 -22 -90" stroke={DEEP} strokeWidth="5" fill="none" strokeLinecap="round" />
        {/* kain/dodot */}
        <path d="M-18 -100 L18 -100 L30 -26 L-30 -26Z" fill={DEEP} />
        <path d="M-12 -92 L16 -34 M-2 -96 L24 -40 M-22 -84 L6 -30" stroke={CREAM} strokeOpacity=".7" strokeWidth="2" />
        {/* tungkai */}
        <path d="M-14 -26 L-18 0 L-4 0 L-2 -26Z M4 -26 L8 0 L24 0 L16 -26Z" fill={DEEP} />
        {/* badan */}
        <path d="M-22 -168 L22 -168 L18 -100 L-18 -100Z" fill={DEEP} />
        <path d="M-14 -160 L14 -160 M-13 -148 L13 -148 M-12 -136 L12 -136" stroke={CREAM} strokeOpacity=".75" strokeWidth="2" />
        <circle cx="0" cy="-118" r="3.5" fill={CREAM} />
        {/* leher dan kepala */}
        <rect x="-4" y="-180" width="8" height="14" fill={DEEP} />
        <ellipse cx="2" cy="-192" rx="12" ry="14" fill={DEEP} />
        <path d="M12 -194 l13 4 l-11 5Z" fill={DEEP} />
        <circle cx="8" cy="-196" r="1.8" fill={CREAM} />
        {/* mahkota */}
        <path d={`M-12 -200 L-10 -${222 + crown * 8} L-2 -216 L4 -${232 + crown * 8} L10 -214 L14 -206Z`} fill={DEEP} />
        <circle cx="0" cy="-212" r="2" fill={CREAM} />
        {/* lengan depan yang melambai */}
        <g className="wayang-arm o-topleft">
          <path d="M14 -160 Q52 -146 74 -112" stroke={DEEP} strokeWidth="5.5" fill="none" strokeLinecap="round" />
          <circle cx="76" cy="-108" r="4.5" fill={DEEP} />
        </g>
      </g>
    </g>
  );
}

function Gunungan() {
  return (
    <g className="gunungan-sway o-bottom">
      <path d="M0 -250 C40 -200 74 -140 74 -66 L74 0 L-74 0 L-74 -66 C-74 -140 -40 -200 0 -250Z" fill={DEEP} />
      {/* gerbang dan penjaga */}
      <path d="M-30 0 L-30 -60 Q0 -92 30 -60 L30 0Z" fill={CREAM} fillOpacity=".92" />
      <path d="M-20 0 L-20 -52 Q0 -72 20 -52 L20 0Z" fill={DEEP} />
      <circle cx="-9" cy="-30" r="4" fill={CREAM} /><circle cx="9" cy="-30" r="4" fill={CREAM} />
      {/* pohon kehidupan (kalpataru) */}
      <path d="M0 -226 V-96" stroke={CREAM} strokeWidth="3" />
      {[-196, -168, -140, -112].map((y, i) => (
        <g key={y} stroke={CREAM} strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d={`M0 ${y} q-${24 - i * 2} -6 -${34 - i * 4} -${22 - i * 2}`} />
          <path d={`M0 ${y} q${24 - i * 2} -6 ${34 - i * 4} -${22 - i * 2}`} />
        </g>
      ))}
      {[[-26, -214], [26, -214], [-34, -184], [34, -184], [-42, -150], [42, -150], [-50, -118], [50, -118]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="3" fill={ORANGE} />)}
      {/* tepi bergerigi */}
      {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={-64 + i * 16} cy={-8} r="2.6" fill={CREAM} fillOpacity=".8" />)}
    </g>
  );
}

export function WayangStage() {
  return (
    <figure aria-hidden className="wayang relative mx-auto w-full max-w-[540px]">
      <svg viewBox="0 0 540 380" className="h-auto w-full overflow-visible" role="presentation">
        <defs>
          <radialGradient id="wy-glow" cx="50%" cy="62%" r="70%">
            <stop offset="0" stopColor="#FFD08A" /><stop offset=".55" stopColor="#FFB070" /><stop offset="1" stopColor={ORANGE} />
          </radialGradient>
          <clipPath id="wy-clip"><rect x="14" y="14" width="512" height="300" rx="14" /></clipPath>
        </defs>
        {/* bingkai kayu dan kelir */}
        <rect x="6" y="6" width="528" height="316" rx="20" fill={WOOD} />
        <rect x="14" y="14" width="512" height="300" rx="14" fill="url(#wy-glow)" />
        <g clipPath="url(#wy-clip)">
          <circle className="blencong" cx="270" cy="250" r="190" fill="#FFF4E4" fillOpacity=".5" />
          <g transform="translate(270 314)"><Gunungan /></g>
          <g transform="translate(112 314)"><Puppet crown={1} /></g>
          <g transform="translate(428 314) scale(-1 1)"><Puppet crown={0} delay={-1.6} /></g>
        </g>
        {/* gedebog pisang tempat wayang ditancapkan */}
        <rect x="6" y="318" width="528" height="40" rx="12" fill="#C9894A" />
        <path d="M6 338 H534" stroke="#A8692F" strokeWidth="3" />
        {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${34 + i * 44} 322 v32`} stroke="#A8692F" strokeWidth="2" opacity=".6" />)}
      </svg>
      <figcaption className="mt-3 text-center text-xs font-semibold tracking-wider text-[#BFE3EC]">WAYANG KULIT · GUNUNGAN · JAWA</figcaption>
    </figure>
  );
}
