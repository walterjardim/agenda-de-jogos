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
  uniform: 'm8 3-5 3 3 5 2-1v11h8V10l2 1 3-5-5-3a4 4 0 0 1-8 0Z',
  edit: 'm14 5 5 5M4 20l4-1L20 7a2.1 2.1 0 0 0-3-3L5 16l-1 4Z',
  remove: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  back: 'M19 12H5m6-6-6 6 6 6',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h10V3M7 21v-8h10v8',
  cancel: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  share: 'M12 16V3m-5 5 5-5 5 5M5 12v8h14v-8',
  copy: 'M9 9h12v12H9V9ZM5 15H3V3h12v2',
  refresh:
    'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2',
  follow:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3m3-13v6m-3-3h6',
  unfollow:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3m0-10h6',

  chevron: 'm10 6 6 6-6 6',
};

export type IconName = keyof typeof icons;

export function Icon({ name, color }: { name: IconName; color: ColorValue }) {
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
