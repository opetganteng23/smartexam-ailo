// Adegan Nusantara beranimasi (SVG orisinal, bergaya datar). Murni dekoratif: aria-hidden, animasi mati bila pengguna memilih reduce motion.
// Isi: gunung berapi berasap, Borobudur, Rumah Gadang, perahu Phinisi, cenderawasih, layang-layang, pohon kelapa, awan Mega Mendung.

const TEAL = "#00809C", DEEP = "#0A4256", MID = "#0E5670", ORANGE = "#F07020", PEACH = "#FFE7D3", GRASS = "#8ED1A4";

const wave = (y: number) => `M-80 ${y}` + " q20 -10 40 0 t40 0".repeat(34);

const Cloud = ({ x, y, s = 1, dur, delay }: { x: number; y: number; s?: number; dur: number; delay: number }) => (
  <g className="nusa-cloud" style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }}>
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 34 Q4 6 36 14 Q52 -8 84 10 Q124 0 128 34 Z" fill="#fff" opacity=".95" />
      <path d="M14 34 Q20 18 40 24 Q54 8 80 22 Q104 16 108 34" fill="none" stroke={TEAL} strokeOpacity=".35" strokeWidth="2" />
      <path d="M32 34 Q40 28 54 30 Q68 22 84 34" fill="none" stroke={TEAL} strokeOpacity=".3" strokeWidth="2" />
    </g>
  </g>
);

const Palm = ({ x, y, h = 84, delay = 0 }: { x: number; y: number; h?: number; delay?: number }) => (
  <g>
    <path d={`M${x} ${y} Q${x + 10} ${y - h / 2} ${x + 22} ${y - h}`} stroke="#8A5A2B" strokeWidth="7" fill="none" strokeLinecap="round" />
    <g className="nusa-sway o-bottom" style={{ animationDelay: `${delay}s`, transformOrigin: `${x + 22}px ${y - h}px`, transformBox: "view-box" }}>
      {[-150, -110, -70, -30, 10, 40].map((a) => (
        <path key={a} d={`M${x + 22} ${y - h} q30 -26 66 -2`} stroke="#2E9E5B" strokeWidth="6" fill="none" strokeLinecap="round" transform={`rotate(${a} ${x + 22} ${y - h})`} />
      ))}
      <circle cx={x + 20} cy={y - h + 6} r="4" fill="#8A5A2B" /><circle cx={x + 27} cy={y - h + 7} r="4" fill="#8A5A2B" />
    </g>
  </g>
);

function Cenderawasih() {
  return (
    <g className="nusa-fly" style={{ animationDuration: "34s" }}>
      <g transform="translate(0 92)">
        <g className="nusa-bob o-center">
          {/* ekor panjang berpita */}
          <path d="M-14 2 Q-70 40 -122 14 T-214 36" stroke={TEAL} strokeWidth="3.4" fill="none" strokeLinecap="round" />
          <path d="M-14 4 Q-62 -4 -112 -20 T-196 -6" stroke={ORANGE} strokeWidth="3.4" fill="none" strokeLinecap="round" />
          <ellipse cx="-214" cy="36" rx="9" ry="4" fill={TEAL} /><ellipse cx="-196" cy="-6" rx="9" ry="4" fill={ORANGE} />
          <path d="M-14 3 Q-50 22 -92 20" stroke="#FFB27A" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* sayap */}
          <path className="nusa-flap" d="M-2 -2 Q-8 -34 20 -26 Q6 -10 6 0Z" fill="#FFB27A" stroke={ORANGE} strokeWidth="1.5" />
          {/* badan, kepala, paruh */}
          <ellipse cx="0" cy="0" rx="17" ry="8" fill={ORANGE} />
          <circle cx="18" cy="-5" r="6.5" fill={ORANGE} />
          <path d="M23 -6 l11 3 l-11 3Z" fill={DEEP} />
          <circle cx="20" cy="-6" r="1.5" fill="#fff" />
          <path d="M14 -10 l-3 -9 M18 -11 l0 -10 M22 -10 l4 -8" stroke={DEEP} strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
    </g>
  );
}

export function NusantaraScene() {
  return (
    <div aria-hidden className="nusa-scene relative h-[230px] w-full overflow-hidden bg-cloud sm:h-[300px] lg:h-[360px]">
      <svg viewBox="0 0 1200 360" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" role="presentation">
        <defs>
          <linearGradient id="ns-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F9FCFD" /><stop offset=".65" stopColor="#FFF1E3" /><stop offset="1" stopColor={PEACH} /></linearGradient>
          <radialGradient id="ns-glow"><stop offset="0" stopColor={ORANGE} stopOpacity=".35" /><stop offset="1" stopColor={ORANGE} stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="1200" height="360" fill="url(#ns-sky)" />

        {/* matahari terbit dengan sinar berputar */}
        <circle cx="1010" cy="170" r="150" fill="url(#ns-glow)" />
        <g className="nusa-rays o-center">
          {Array.from({ length: 18 }, (_, i) => <line key={i} x1="1010" y1="82" x2="1010" y2="62" stroke={ORANGE} strokeOpacity=".5" strokeWidth="5" strokeLinecap="round" transform={`rotate(${i * 20} 1010 170)`} />)}
        </g>
        <circle cx="1010" cy="170" r="62" fill={ORANGE} />
        <circle cx="1010" cy="170" r="48" fill="#FF8A3D" />

        {/* awan Mega Mendung */}
        <Cloud x={60} y={36} dur={90} delay={-20} />
        <Cloud x={420} y={84} s={0.8} dur={120} delay={-70} />
        <Cloud x={760} y={30} s={1.1} dur={105} delay={-40} />

        {/* pegunungan */}
        <path d="M0 270 L110 168 L210 238 L330 150 L470 250 L620 176 L760 262 L900 190 L1040 262 L1200 206 V330 H0Z" fill="#BFE3EC" />
        <path d="M0 290 L140 214 L260 272 L400 208 L560 280 L720 224 L880 284 L1040 236 L1200 282 V330 H0Z" fill="#8FC6D4" opacity=".9" />

        {/* gunung berapi berasap */}
        <path d="M30 316 L150 150 L270 316Z" fill={MID} />
        <path d="M118 188 L150 150 L182 188 Q166 176 150 192 Q134 176 118 188Z" fill="#fff" opacity=".85" />
        {[0, 1, 2].map((i) => (
          <circle key={i} className="nusa-smoke o-center" cx={150 + i * 6} cy="146" r="12" fill="#fff" style={{ animationDelay: `${i * 1.8}s` }} />
        ))}

        {/* laut dan ombak */}
        <rect y="318" width="1200" height="42" fill={TEAL} />
        <path className="nusa-wave" d={wave(332)} stroke="#fff" strokeOpacity=".55" strokeWidth="2.5" fill="none" />
        <path className="nusa-wave" d={wave(346)} stroke="#fff" strokeOpacity=".35" strokeWidth="2.5" fill="none" style={{ animationDelay: "-3s", animationDirection: "alternate-reverse" }} />

        {/* daratan */}
        <path d="M0 322 V296 C150 284 300 302 450 294 S700 286 790 298 S 870 322 880 322Z" fill={GRASS} />

        {/* Borobudur */}
        <g transform="translate(0 4)">
          <rect x="290" y="286" width="220" height="20" rx="3" fill={DEEP} />
          <rect x="308" y="268" width="184" height="18" rx="3" fill={MID} />
          <rect x="326" y="250" width="148" height="18" rx="3" fill={DEEP} />
          <rect x="346" y="234" width="108" height="16" rx="3" fill={MID} />
          {[316, 346, 376, 424, 454, 484].map((x) => <path key={x} d={`M${x - 8} 268 Q${x - 8} 252 ${x} 250 Q${x + 8} 252 ${x + 8} 268Z`} fill={ORANGE} />)}
          {[360, 380, 420, 440].map((x) => <path key={x} d={`M${x - 7} 234 Q${x - 7} 220 ${x} 218 Q${x + 7} 220 ${x + 7} 234Z`} fill={ORANGE} />)}
          <path d="M382 234 Q382 198 400 194 Q418 198 418 234Z" fill={ORANGE} />
          <rect x="398" y="176" width="4" height="20" fill={DEEP} /><circle cx="400" cy="174" r="4" fill={DEEP} />
        </g>

        {/* pohon kelapa */}
        <Palm x={40} y={318} />
        <Palm x={590} y={314} h={70} delay={-3} />

        {/* Rumah Gadang */}
        <g transform="translate(0 8)">
          <rect x="650" y="262" width="100" height="38" fill={DEEP} />
          {[664, 692, 720].map((x) => <rect key={x} x={x} y="272" width="14" height="14" rx="2" fill="#FFD08A" />)}
          <path d="M622 264 Q648 252 656 214 Q660 176 668 148 Q682 190 700 226 Q718 190 732 148 Q740 176 744 214 Q752 252 778 264Z" fill={ORANGE} />
          <path d="M640 262 Q660 244 668 214 M760 262 Q740 244 732 214" stroke="#fff" strokeOpacity=".5" strokeWidth="2" fill="none" />
          <rect x="690" y="286" width="20" height="14" fill="#8A5A2B" />
        </g>

        {/* perahu Phinisi */}
        <g className="nusa-boat o-center">
          <path d="M880 312 L1010 312 L992 336 L898 336Z" fill={ORANGE} />
          <path d="M886 318 L1004 318" stroke={DEEP} strokeWidth="4" />
          <rect x="945" y="236" width="4" height="78" fill={DEEP} />
          <path d="M949 240 L949 306 L1006 306Z" fill="#fff" />
          <path d="M945 252 L945 308 L896 308Z" fill={PEACH} stroke={ORANGE} strokeWidth="1.5" />
          <path d="M947 232 L982 242 L947 250Z" fill={TEAL} />
        </g>

        {/* layang-layang */}
        <g className="nusa-kite o-top">
          <path d="M250 70 L274 98 L250 132 L226 98Z" fill={ORANGE} />
          <path d="M250 70 L274 98 L250 98Z M250 132 L226 98 L250 98Z" fill={TEAL} />
          <path d="M250 132 q-12 14 0 26 t0 26 t0 26" stroke={DEEP} strokeWidth="2" fill="none" />
        </g>

        <Cenderawasih />
      </svg>
      <div className="nusa-tumpal nusa-songket-g absolute inset-x-0 bottom-0 opacity-80" />
    </div>
  );
}
