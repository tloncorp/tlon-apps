import { styled } from 'tamagui';

import SquiggleSvg from '../assets/lol_at_this_graphic.svg';

export const Squiggle = styled(
  SquiggleSvg,
  {
    color: '$primaryText',
  },
  {
    accept: {
      color: 'color',
      width: 'size',
      height: 'size',
    },
  }
);
