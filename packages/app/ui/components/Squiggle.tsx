import { styled } from 'tamagui';

import SquiggleSvg from '../assets/squiggle.svg';

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
