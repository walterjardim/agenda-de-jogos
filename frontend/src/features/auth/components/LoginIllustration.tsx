import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

/** Vetor local inspirado no wireframe, sem dependência de imagens remotas. */
export function LoginIllustration() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 380 260" aria-hidden={true}>
      <Defs>
        <LinearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF" />
          <Stop offset="1" stopColor="#ECEDEE" />
        </LinearGradient>
        <LinearGradient id="red" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F13B42" />
          <Stop offset="1" stopColor="#C71924" />
        </LinearGradient>
      </Defs>
      <G stroke="#F8D5D8" strokeWidth="2" fill="none">
        <Circle cx="63" cy="111" r="55" />
        <Path d="M63 18V220M303 55H376M303 55V207H376M344 88H376M344 88V176H376" />
        <Path d="M303 107C282 118 282 147 303 158" />
      </G>
      <Circle cx="63" cy="111" r="5" fill="#F8D5D8" />
      <Ellipse cx="219" cy="231" rx="110" ry="12" fill="#EBE7E8" />
      <Path d="M259 96L292 220Q294 229 283 229H234L221 97Z" fill="#AF1B25" />
      <G transform="translate(118 88) rotate(4 90 65)">
        <Rect
          width="149"
          height="142"
          rx="16"
          fill="url(#paper)"
          stroke="#E6E6E8"
        />
        <Path d="M0 27V16Q0 0 16 0H133Q149 0 149 16V30H0Z" fill="url(#red)" />
        {[24, 59, 94, 127].map((x) => (
          <Path
            key={x}
            d={`M${x} 10C${x - 12} -9 ${x + 1} -29 ${x + 5} -12`}
            fill="none"
            stroke="#292F34"
            strokeWidth="6"
            strokeLinecap="round"
          />
        ))}
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2, 3, 4].map((col) => (
            <Rect
              key={`${row}-${col}`}
              x={14 + col * 25}
              y={43 + row * 23}
              width="17"
              height="17"
              rx="3"
              fill={row === 1 && col === 2 ? '#E2222B' : '#DCDDE0'}
            />
          )),
        )}
      </G>
      <Ellipse cx="103" cy="241" rx="55" ry="8" fill="#EBE7E8" />
      <Circle
        cx="103"
        cy="198"
        r="46"
        fill="url(#paper)"
        stroke="#DADDE0"
        strokeWidth="2"
      />
      <G stroke="#CDD0D3" strokeWidth="1.5" fill="none">
        <Path d="M103 185L101 164M119 197L139 192M113 215L120 235M90 215L72 230M85 196L61 193" />
      </G>
      <G fill="#252C31">
        <Path d="M103 183L120 195L114 215H92L85 195Z" />
        <Path d="M87 155L103 152L119 155L103 164Z" />
        <Path d="M62 177L72 171L77 186L62 200L57 194Z" />
        <Path d="M137 170L146 184L149 196L139 201L130 184Z" />
        <Path d="M73 229L77 215L93 222L98 244L84 240Z" />
        <Path d="M119 224L132 216L138 228L126 239L116 243Z" />
      </G>
      <Path
        d="M272 64L279 54M282 75L294 71M262 58L264 47"
        stroke="#E2222B"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </Svg>
  );
}
