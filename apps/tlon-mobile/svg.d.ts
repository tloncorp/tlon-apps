declare module '*.svg' {
  import type { RefAttributes } from 'react';
  import type React from 'react';
  import type { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps & RefAttributes>;
  export default content;
}
