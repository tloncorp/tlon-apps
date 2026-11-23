import type { ReactElement } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useLineColors } from './lineKit';

export type LineIconName =
  | 'apps'
  | 'phoneOff'
  | 'clock'
  | 'server'
  | 'lock'
  | 'chatCheck'
  | 'sparkle'
  | 'code'
  | 'fileDown'
  | 'file'
  | 'people'
  | 'chevronRight';

// Drawn on a 24-unit square at 1.6 pt, like the app's icons.
const SHAPES: Record<LineIconName, ReactElement> = {
  apps: (
    <>
      <Rect x={4} y={4} width={6.5} height={6.5} rx={1.5} />
      <Rect x={13.5} y={4} width={6.5} height={6.5} rx={1.5} />
      <Rect x={4} y={13.5} width={6.5} height={6.5} rx={1.5} />
      <Rect x={13.5} y={13.5} width={6.5} height={6.5} rx={1.5} />
    </>
  ),
  phoneOff: (
    <>
      <Rect x={7} y={3} width={10} height={18} rx={2} />
      <Path d="M4.5 5.5l15 13" />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={8} />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  server: (
    <>
      <Rect x={4} y={4} width={16} height={7} rx={1.5} />
      <Rect x={4} y={13} width={16} height={7} rx={1.5} />
      <Path d="M7.5 7.5h.01M7.5 16.5h.01" />
    </>
  ),
  lock: (
    <>
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  chatCheck: (
    <>
      <Path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      <Path d="M9 11l2 2 4-4" />
    </>
  ),
  sparkle: (
    <Path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z" />
  ),
  code: <Path d="M8.5 8L4.5 12l4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13" />,
  fileDown: (
    <>
      <Path d="M6.5 3.5h7l4 4v13h-11z" />
      <Path d="M13.5 3.5v4h4" />
      <Path d="M12 11v6M9.5 14.5L12 17l2.5-2.5" />
    </>
  ),
  file: (
    <>
      <Path d="M6.5 3.5h7l4 4v13h-11z" />
      <Path d="M13.5 3.5v4h4M9 12h6M9 15.5h6" />
    </>
  ),
  people: (
    <>
      <Circle cx={9} cy={8} r={3.5} />
      <Path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <Path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <Path d="M18 14.3c2.1.7 3.5 2.8 3.5 5.7" />
    </>
  ),
  chevronRight: <Path d="M9 5L16 12L9 19" />,
};

export function LineIcon({
  name,
  size = 22,
  color,
  strokeWidth = 1.6,
}: {
  name: LineIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const { ink } = useLineColors();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? ink}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SHAPES[name]}
    </Svg>
  );
}
