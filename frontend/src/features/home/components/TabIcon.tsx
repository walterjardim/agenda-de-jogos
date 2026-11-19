import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const icons = {
  agenda:
    'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2-2v4m10-4v4M3 10h18m-13 5h2m4 0h2',
  search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1.8 4.2L21 21',
  teams:
    'M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M12 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm4-3.4a3.5 3.5 0 0 1 0 6.8',
  profile:
    'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2',
  add: 'M12 5v14M5 12h14',
  swap: 'M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4',
  trophy:
    'M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v7m-4 0h8',
  chevron: 'm10 6 6 6-6 6',
};

export function TabIcon({
  name,
  color,
}: {
  name: keyof typeof icons;
  color: ColorValue;
}) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" aria-hidden={true}>
      <Path
        d={icons[name]}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
