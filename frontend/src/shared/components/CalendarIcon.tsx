import Svg, { Path, Rect } from 'react-native-svg';
import { theme } from '../theme/theme';

type Props = { size?: number; color?: string };

export function CalendarIcon({
  size = 28,
  color = theme.colors.primary,
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" aria-hidden={true}>
      <Rect
        x="7"
        y="10"
        width="34"
        height="32"
        rx="5"
        fill="none"
        stroke={color}
        strokeWidth="4"
      />
      <Path
        d="M8 19H40M16 5V13M32 5V13"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {[15, 23, 31].map((x) =>
        [25, 33].map((y) => (
          <Rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="5"
            height="5"
            rx="1"
            fill={color}
          />
        )),
      )}
    </Svg>
  );
}
