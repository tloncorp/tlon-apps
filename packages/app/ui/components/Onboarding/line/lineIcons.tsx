import type { ReactElement } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useLineColors } from './lineKit';

export type LineIconName =
  | 'chats'
  | 'search'
  | 'plug'
  | 'computer'
  | 'lock'
  | 'sliders'
  | 'hash'
  | 'notebook'
  | 'people'
  | 'check'
  | 'chevronRight';

// Drawn on a 24-unit square at 1.6 pt, like the app's icons.
const SHAPES: Record<LineIconName, ReactElement> = {
  chats: (
    <>
      <Path d="M4 5.5h10a2 2 0 0 1 2 2V12a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z" />
      <Path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v2.5L16 18h-3" />
    </>
  ),
  search: (
    <>
      <Circle cx={10.5} cy={10.5} r={6} />
      <Path d="M15 15l5 5" />
    </>
  ),
  plug: (
    <>
      <Path d="M9 3v5M15 3v5" />
      <Path d="M6 8h12v3a6 6 0 0 1-12 0z" />
      <Path d="M12 17v4" />
    </>
  ),
  computer: (
    <>
      <Rect x={3} y={4} width={18} height={12} rx={2} />
      <Path d="M8 20h8M12 16v4" />
    </>
  ),
  lock: (
    <>
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  sliders: (
    <>
      <Path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <Circle cx={15} cy={6} r={2} />
      <Circle cx={9} cy={12} r={2} />
      <Circle cx={17} cy={18} r={2} />
    </>
  ),
  hash: <Path d="M9.5 4L7.5 20M16.5 4l-2 16M4.5 9h15.5M4 15h15.5" />,
  notebook: (
    <>
      <Rect x={5} y={3} width={14} height={18} rx={2} />
      <Path d="M9 8h6M9 12h6M9 16h3.5" />
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
  check: <Path d="M17 6L11 18L7 13" />,
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
