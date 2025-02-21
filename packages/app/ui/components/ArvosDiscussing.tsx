import { styled } from 'tamagui';

import ArvosDiscussingSvg from '../assets/arvos_discussing.svg';

export const ArvosDiscussing = styled(
  ArvosDiscussingSvg,
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
