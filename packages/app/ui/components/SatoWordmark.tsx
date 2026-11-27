import { styled } from 'tamagui';

import SatoWordmarkSvg from '../assets/sato-wordmark.svg';

export const SatoWordmark = styled(
  SatoWordmarkSvg,
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
