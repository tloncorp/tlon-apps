import { styled } from 'tamagui';

import TlonSvg from '../assets/Tlon.svg';

export const TlonLogo = styled(
  TlonSvg,
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
