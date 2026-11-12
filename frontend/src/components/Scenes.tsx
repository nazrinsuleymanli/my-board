/* Original, hand-made SVG scenes for each season / mood (no photos).
   Palettes are taken from the vibe of Nazrin's own photos + mood boards. */
import { ThemeKey } from "../theme";

type P = { k: ThemeKey };

export function Scene({ k }: P) {
  const S = SCENES[k];
  return (
    <div className={`scene scene-${k}`} aria-hidden data-testid="scene">
      <svg viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice">
        <S />
      </svg>
    </div>
  );
}

const PARTICLE: Record<ThemeKey, "snow" | "petal" | "leaf" | "sparkle" | "dust" | "steam"> = {
  winter: "snow",
  spring: "sparkle",
  summer: "sparkle",
  autumn: "leaf",
  motivated: "dust",
  hardday: "petal",
  cozy: "dust",
  dreamy: "dust",
};

export function Particles({ k }: P) {
  const kind = PARTICLE[k];
  return (
    <div className={`particles p-${kind}`} aria-hidden>
      {Array.from({ length: 16 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 61) % 100}%`,
            animationDelay: `${-((i * 1.7) % 9)}s`,
            animationDuration: `${8 + ((i * 3) % 7)}s`,
            ["--s" as string]: `${0.6 + ((i * 7) % 5) / 6}`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------------- seasons ---------------- */

function Winter() {
  // plum night, string lights, snowy rooftops (her Christmas-market + plum cardigan + pink sweater vibe)
  const bulbs = Array.from({ length: 11 }, (_, i) => {
    const x = 12 + i * 29.6;
    const y = 52 + Math.sin((i / 10) * Math.PI) * 26;
    return { x, y, c: i % 3 === 0 ? "#F4B6C8" : i % 3 === 1 ? "#F2C46D" : "#FFE7B0" };
  });
  return (
    <>
      <defs>
        <linearGradient id="w-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1838" />
          <stop offset=".6" stopColor="#4d2d58" />
          <stop offset="1" stopColor="#7a5888" />
        </linearGradient>
        <radialGradient id="w-glow">
          <stop offset="0" stopColor="#FFD98A" stopOpacity=".9" />
          <stop offset="1" stopColor="#FFD98A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="220" fill="url(#w-sky)" />
      <path d="M262 30a16 16 0 1 0 14 24a13 13 0 1 1 -14 -24z" fill="#F8E9C8" opacity=".9" />
      {[30, 70, 120, 200, 240, 290].map((x, i) => (
        <circle key={i} className="twinkle" style={{ animationDelay: `${i * 0.7}s` }} cx={x} cy={14 + (i % 3) * 9} r="1.2" fill="#fff" />
      ))}
      {/* rooftops */}
      <path d="M0 150 L20 128 L40 150 L40 138 L62 116 L84 138 L84 150 L110 150 L110 120 L118 100 L126 120 L126 150 L150 150 L170 132 L190 150 L215 150 L215 126 L240 108 L265 126 L265 150 L285 150 L300 132 L320 150 L320 220 L0 220Z" fill="#2b1a33" />
      {[[48, 140], [66, 132], [114, 128], [176, 142], [232, 132], [250, 140], [292, 144]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="6" height="8" rx="1" fill="#FFD98A" opacity=".85" />
      ))}
      {/* snow on ground */}
      <path d="M0 176 Q80 160 160 172 T320 166 V220 H0Z" fill="#F4EEF8" />
      <path d="M0 192 Q90 180 170 190 T320 186 V220 H0Z" fill="#E6DCF0" />
      {/* string lights */}
      <path d="M0 50 Q160 106 320 50" stroke="#1b1020" strokeWidth="1.3" fill="none" />
      {bulbs.map((b, i) => (
        <g key={i} className="twinkle" style={{ animationDelay: `${(i % 4) * 0.5}s` }}>
          <circle cx={b.x} cy={b.y + 6} r="9" fill="url(#w-glow)" />
          <ellipse cx={b.x} cy={b.y + 6} rx="3" ry="4" fill={b.c} />
        </g>
      ))}
      {/* little tree */}
      <g transform="translate(38 118)">
        <path d="M18 0 L36 30 H26 L40 52 H-4 L10 30 H0Z" fill="#2f5d4a" />
        <rect x="15" y="52" width="6" height="8" fill="#5a3a2a" />
        {[[14, 22], [24, 36], [8, 42], [30, 46], [18, 12]].map(([x, y], i) => (
          <circle key={i} className="twinkle" style={{ animationDelay: `${i * 0.4}s` }} cx={x} cy={y} r="1.8" fill={i % 2 ? "#F4B6C8" : "#F2C46D"} />
        ))}
      </g>
    </>
  );
}

function Spring() {
  // lotus pond (her palette) with a warm Verona-terracotta glow
  return (
    <>
      <defs>
        <linearGradient id="s-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#105666" />
          <stop offset="1" stopColor="#0A3323" />
        </linearGradient>
        <radialGradient id="s-sun" cx=".85" cy="0" r=".9">
          <stop offset="0" stopColor="#F3C9A0" stopOpacity=".55" />
          <stop offset="1" stopColor="#F3C9A0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="220" fill="url(#s-water)" />
      <rect width="320" height="220" fill="url(#s-sun)" />
      {[[40, 30], [120, 60], [200, 24], [270, 80], [90, 120], [230, 150]].map(([x, y], i) => (
        <path key={i} className="shimmer" style={{ animationDelay: `${i * 0.6}s` }} d={`M${x} ${y} h26`} stroke="#F7F4D5" strokeOpacity=".25" strokeWidth="1.2" strokeLinecap="round" />
      ))}
      <Pad x={70} y={160} r={34} />
      <Pad x={250} y={60} r={26} />
      <Pad x={190} y={190} r={30} />
      <Pad x={22} y={70} r={20} />
      <Lotus x={120} y={120} s={1.15} />
      <Lotus x={258} y={150} s={0.85} />
      <Lotus x={40} y={58} s={0.55} />
      {[[150, 60], [210, 110], [100, 190], [290, 30]].map(([x, y], i) => (
        <path key={i} className="twinkle" style={{ animationDelay: `${i * 0.8}s` }} d={`M${x} ${y - 4} L${x + 1} ${y - 1} L${x + 4} ${y} L${x + 1} ${y + 1} L${x} ${y + 4} L${x - 1} ${y + 1} L${x - 4} ${y} L${x - 1} ${y - 1}Z`} fill="#FFE9B8" />
      ))}
    </>
  );
}

function Pad({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 0 L${r} -${r * 0.18} A${r} ${r * 0.62} 0 1 1 ${r} ${r * 0.18} Z`} fill="#839958" />
      <path d={`M0 0 L${r} -${r * 0.18} A${r} ${r * 0.62} 0 1 1 ${r} ${r * 0.18} Z`} fill="none" stroke="#0A3323" strokeOpacity=".25" />
    </g>
  );
}

function Lotus({ x, y, s }: { x: number; y: number; s: number }) {
  const petals = [-60, -30, 0, 30, 60];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="sway">
      <ellipse cx="0" cy="8" rx="30" ry="7" fill="#0A3323" opacity=".35" />
      {petals.map((a) => (
        <path key={a} d="M0 4 C-10 -8 -8 -28 0 -36 C8 -28 10 -8 0 4Z" fill={Math.abs(a) === 60 ? "#C9837A" : "#D3968C"} transform={`rotate(${a})`} />
      ))}
      <path d="M0 4 C-7 -6 -6 -22 0 -30 C6 -22 7 -6 0 4Z" fill="#F2C2B6" />
      <circle cx="0" cy="-4" r="4" fill="#F3D27A" />
      </g>
    </g>
  );
}

function Summer() {
  // Lake Como: deep blue sky, puffy clouds, green hills, teal water
  return (
    <>
      <defs>
        <linearGradient id="su-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f57a8" />
          <stop offset="1" stopColor="#6fa3d8" />
        </linearGradient>
        <linearGradient id="su-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2e7279" />
          <stop offset="1" stopColor="#1d4f55" />
        </linearGradient>
      </defs>
      <rect width="320" height="220" fill="url(#su-sky)" />
      <circle cx="272" cy="40" r="18" fill="#FFE08A" />
      <circle cx="272" cy="40" r="28" fill="#FFE08A" opacity=".2" />
      <g className="drift">
        <Cloud x={40} y={40} s={1} />
        <Cloud x={170} y={28} s={1.3} />
      </g>
      <g className="drift slow">
        <Cloud x={110} y={70} s={0.7} />
      </g>
      <path d="M0 130 Q40 92 90 110 T170 104 Q210 86 250 108 T320 100 V150 H0Z" fill="#3d6b3a" />
      <path d="M0 142 Q60 118 120 132 T230 126 T320 134 V160 H0Z" fill="#2c5530" />
      {[[30, 122], [60, 118], [200, 112], [228, 118], [290, 114]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="7" height="5" fill={i % 2 ? "#F1E4CF" : "#E8A87C"} />
      ))}
      <rect y="148" width="320" height="72" fill="url(#su-lake)" />
      {[[30, 168], [120, 178], [220, 164], [260, 196], [70, 200]].map(([x, y], i) => (
        <path key={i} className="shimmer" style={{ animationDelay: `${i * 0.5}s` }} d={`M${x} ${y} h${18 + (i % 3) * 8}`} stroke="#E8F4F2" strokeOpacity=".45" strokeWidth="1.5" strokeLinecap="round" />
      ))}
      <g transform="translate(150 166)">
        <g className="bob">
          <path d="M0 14 H34 L28 20 H6Z" fill="#F7F3EA" />
          <path d="M16 13 V-12 L32 12Z" fill="#fff" />
          <path d="M14 13 V-6 L2 12Z" fill="#F4D35E" />
        </g>
      </g>
    </>
  );
}

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff">
      <circle cx="0" cy="8" r="10" />
      <circle cx="14" cy="0" r="14" />
      <circle cx="32" cy="6" r="11" />
      <rect x="0" y="6" width="34" height="12" rx="6" />
    </g>
  );
}

function Autumn() {
  // Prague in October: golden oak leaves, hazy river, stone bridge arches, gothic spires
  const leaves: [number, number, number, string][] = [
    [14, 18, 20, "#C9A227"], [36, 30, -30, "#9AA866"], [58, 14, 40, "#D98E3A"], [78, 34, 10, "#C9A227"],
    [96, 16, -20, "#B5562C"], [118, 28, 30, "#E6B84A"], [26, 46, 60, "#D98E3A"], [140, 12, -10, "#9AA866"],
    [64, 50, -40, "#E6B84A"], [160, 24, 20, "#C9A227"], [182, 10, -30, "#D98E3A"],
  ];
  return (
    <>
      <defs>
        <linearGradient id="a-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9E4D6" />
          <stop offset="1" stopColor="#D8CBA8" />
        </linearGradient>
        <linearGradient id="a-river" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A9B6B8" />
          <stop offset="1" stopColor="#7E9297" />
        </linearGradient>
      </defs>
      <rect width="320" height="220" fill="url(#a-sky)" />
      <path d="M0 120 Q70 96 140 112 T320 104 V140 H0Z" fill="#B7B39A" opacity=".8" />
      {/* spires */}
      <g fill="#8C8A7C">
        <path d="M40 120 V96 L46 80 L52 96 V120Z" />
        <path d="M54 120 V100 L58 88 L62 100 V120Z" />
        <path d="M250 116 V92 L256 74 L262 92 V116Z" />
        <rect x="200" y="100" width="34" height="18" />
        <path d="M196 100 L217 86 L238 100Z" />
      </g>
      <path d="M0 132 Q120 120 220 128 T320 126 V140 H0Z" fill="#9E9A82" />
      <rect y="138" width="320" height="82" fill="url(#a-river)" />
      {/* bridge */}
      <path d="M0 140 H320 V156 H300 A20 18 0 0 0 260 156 H240 A20 18 0 0 0 200 156 H180 A20 18 0 0 0 140 156 H120 A20 18 0 0 0 80 156 H60 A20 18 0 0 0 20 156 H0Z" fill="#8B8478" />
      <rect y="136" width="320" height="5" fill="#7A7468" />
      {[[40, 182], [150, 196], [240, 176], [290, 204]].map(([x, y], i) => (
        <path key={i} className="shimmer" style={{ animationDelay: `${i * 0.6}s` }} d={`M${x} ${y} h22`} stroke="#EEF2F0" strokeOpacity=".5" strokeWidth="1.4" strokeLinecap="round" />
      ))}
      <g transform="translate(196 186)">
        <g className="bob">
          <rect width="40" height="8" rx="3" fill="#F2EEE6" />
          <rect x="6" y="-5" width="26" height="6" rx="2" fill="#D9D3C6" />
        </g>
      </g>
      {/* oak branch */}
      <path d="M-4 6 Q60 20 120 14 T200 8" stroke="#5a3e28" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M40 16 Q50 36 34 50" stroke="#5a3e28" strokeWidth="2.5" fill="none" />
      <g className="sway">
        {leaves.map(([x, y, r, c], i) => (
          <path key={i} d="M0 -9 C5 -6 4 -2 7 0 C4 2 5 6 0 9 C-5 6 -4 2 -7 0 C-4 -2 -5 -6 0 -9Z" fill={c} transform={`translate(${x} ${y}) rotate(${r})`} />
        ))}
      </g>
    </>
  );
}

/* ---------------- moods ---------------- */

function Motivated() {
  return (
    <>
      <defs>
        <radialGradient id="m-glow" cx=".72" cy=".38" r=".55">
          <stop offset="0" stopColor="#E0A85A" stopOpacity=".55" />
          <stop offset="1" stopColor="#E0A85A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="220" fill="#1a140f" />
      <rect width="320" height="220" fill="url(#m-glow)" className="flicker-soft" />
      <rect y="150" width="320" height="70" fill="#3a2a1d" />
      {/* notebook */}
      <g transform="translate(40 128) rotate(-4)">
        <path d="M0 10 L90 0 L96 60 L6 70Z" fill="#EFE6D8" />
        <path d="M96 0 L186 10 L180 70 L90 60Z" fill="#F6EFE3" />
        {[18, 28, 38, 48].map((y) => (
          <g key={y} stroke="#8a7a66" strokeOpacity=".5" strokeWidth="1">
            <path d={`M12 ${y + 4} L84 ${y - 4}`} />
            <path d={`M104 ${y - 4} L172 ${y + 4}`} />
          </g>
        ))}
        <path d="M96 0 V60" stroke="#cbbca6" />
      </g>
      <path d="M150 196 L230 176" stroke="#E0A85A" strokeWidth="4" strokeLinecap="round" />
      {/* candle */}
      <g transform="translate(232 86)">
        <rect x="-14" y="22" width="28" height="44" rx="4" fill="#F3E9DC" />
        <ellipse cx="0" cy="22" rx="14" ry="4" fill="#fff8ee" />
        <path d="M0 22 V14" stroke="#2a2016" strokeWidth="1.5" />
        <g className="flicker">
          <path d="M0 -6 C6 2 6 10 0 14 C-6 10 -6 2 0 -6Z" fill="#F6C76B" />
          <path d="M0 2 C3 6 3 10 0 12 C-3 10 -3 6 0 2Z" fill="#FFF3D1" />
        </g>
      </g>
      <text x="24" y="40" fill="#E0A85A" fontFamily="Fraunces, serif" fontSize="22" fontWeight="600">45:00</text>
      <text x="24" y="58" fill="#BCA98F" fontFamily="Inter, sans-serif" fontSize="9" letterSpacing="2">FOCUS</text>
    </>
  );
}

function HardDay() {
  return (
    <>
      <defs>
        <linearGradient id="h-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c5684" />
          <stop offset="1" stopColor="#1b3253" />
        </linearGradient>
      </defs>
      <rect width="320" height="220" fill="url(#h-water)" />
      {[[30, 30], [140, 50], [250, 26], [70, 90], [200, 100], [280, 70], [40, 190], [230, 200]].map(([x, y], i) => (
        <path key={i} className="shimmer" style={{ animationDelay: `${i * 0.4}s` }} d={`M${x} ${y} q12 -4 24 0`} stroke="#C9D9EE" strokeOpacity=".35" strokeWidth="1.3" fill="none" />
      ))}
      <g transform="translate(60 128) rotate(-12)">
        <g className="bob">
        <rect width="190" height="34" rx="17" fill="#7a5236" />
        <ellipse cx="8" cy="17" rx="8" ry="17" fill="#a77a55" />
        <ellipse cx="8" cy="17" rx="4" ry="9" fill="#7a5236" />
        <path d="M30 6 h120 M40 26 h90" stroke="#5e3d27" strokeWidth="1.5" />
        {[[70, -4], [90, -10], [110, -2], [130, -8], [96, 6], [150, 0], [120, 10]].map(([x, y], i) => (
          <Blossom key={i} x={x} y={y} s={0.9 + (i % 3) * 0.15} />
        ))}
        </g>
      </g>
      {[[40, 70], [260, 150], [180, 190], [290, 40]].map(([x, y], i) => (
        <Blossom key={i} x={x} y={y} s={0.6} />
      ))}
    </>
  );
}

function Blossom({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy="-6" rx="4.2" ry="6" fill="#F7D3E2" transform={`rotate(${a})`} />
      ))}
      <circle r="2.4" fill="#E58FB0" />
    </g>
  );
}

function Cozy() {
  // armudu stəkan çay on a rose wall, pothos leaves, a little book stack
  return (
    <>
      <defs>
        <linearGradient id="c-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b8676b" />
          <stop offset="1" stopColor="#8c3c40" />
        </linearGradient>
        <linearGradient id="c-tea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c5531f" />
          <stop offset="1" stopColor="#7a2a0e" />
        </linearGradient>
      </defs>
      <rect width="320" height="220" fill="url(#c-wall)" />
      <rect y="162" width="320" height="58" fill="#6e1f24" />
      <path d="M0 166 H320" stroke="#D9B06A" strokeOpacity=".6" strokeDasharray="6 5" />
      {/* pothos */}
      <path d="M0 10 Q30 40 22 80 Q16 110 34 140" stroke="#3f5a2e" strokeWidth="2" fill="none" />
      {[[10, 26, -30], [26, 52, 20], [18, 84, -20], [24, 112, 30], [34, 136, -10]].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path className="sway" d="M0 0 C10 -10 22 -2 18 10 C14 18 4 16 0 0Z" fill={i % 2 ? "#5E7F4A" : "#7C9A5E"} />
        </g>
      ))}
      {/* books */}
      <g transform="translate(60 132)">
        <rect width="70" height="12" rx="2" fill="#2f4a3a" />
        <rect x="6" y="-11" width="62" height="11" rx="2" fill="#7a2a2e" />
        <rect x="2" y="-21" width="58" height="10" rx="2" fill="#D9B06A" />
      </g>
      {/* saucer + armudu glass */}
      <g transform="translate(206 92)">
        <ellipse cx="0" cy="66" rx="40" ry="9" fill="#F6E6D6" />
        <ellipse cx="0" cy="64" rx="30" ry="6" fill="#fff" />
        {[-22, -8, 8, 22].map((x) => (
          <circle key={x} cx={x} cy="66" r="2" fill="#B23A3A" />
        ))}
        <path d="M-17 0 H17 C17 10 9 18 9 30 C9 44 20 50 16 62 H-16 C-20 50 -9 44 -9 30 C-9 18 -17 10 -17 0Z" fill="#fff" opacity=".35" />
        <path d="M-15 10 H15 C13 16 8 22 8 30 C8 44 18 50 15 61 H-15 C-18 50 -8 44 -8 30 C-8 22 -13 16 -15 10Z" fill="url(#c-tea)" />
        <path d="M-17 0 H17 C17 10 9 18 9 30 C9 44 20 50 16 62 H-16 C-20 50 -9 44 -9 30 C-9 18 -17 10 -17 0Z" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="1.5" />
        <path d="M-12 14 C-10 24 -4 26 -4 34" stroke="#fff" strokeOpacity=".5" strokeWidth="2" fill="none" strokeLinecap="round" />
        <g className="steam" stroke="#fff" strokeOpacity=".7" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M-6 -6 C-12 -16 0 -22 -6 -34" />
          <path d="M6 -4 C0 -14 12 -22 6 -36" />
        </g>
      </g>
    </>
  );
}

function Dreamy() {
  return (
    <>
      <defs>
        <linearGradient id="d-ray" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F1E2C0" stopOpacity=".55" />
          <stop offset="1" stopColor="#F1E2C0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="320" height="220" fill="#121113" />
      <g transform="translate(190 24)">
        <rect width="96" height="120" rx="4" fill="#E9D8B4" opacity=".9" />
        <path d="M48 0 V120 M0 60 H96" stroke="#121113" strokeWidth="5" />
        <rect width="96" height="120" rx="4" fill="none" stroke="#3a2f22" strokeWidth="5" />
      </g>
      <path className="flicker-soft" d="M190 24 L286 24 L120 220 L0 220 L0 200Z" fill="url(#d-ray)" />
      <rect y="176" width="320" height="44" fill="#1d1a17" />
      <g transform="translate(40 150)">
        <rect width="120" height="10" rx="3" fill="#3a2f22" />
        <rect x="8" y="10" width="6" height="26" fill="#2a221a" />
        <rect x="106" y="10" width="6" height="26" fill="#2a221a" />
        <path d="M40 0 h40 v-4 h-40z" fill="#9FB4C7" />
      </g>
      {[[90, 80], [140, 120], [60, 110], [170, 60], [120, 40], [210, 160]].map(([x, y], i) => (
        <circle key={i} className="twinkle" style={{ animationDelay: `${i * 0.6}s` }} cx={x} cy={y} r="1.4" fill="#F1E6D0" />
      ))}
    </>
  );
}

const SCENES: Record<ThemeKey, () => JSX.Element> = {
  winter: Winter,
  spring: Spring,
  summer: Summer,
  autumn: Autumn,
  motivated: Motivated,
  hardday: HardDay,
  cozy: Cozy,
  dreamy: Dreamy,
};
