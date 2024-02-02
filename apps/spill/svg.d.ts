declare module '*.svg' {
  import React, {RefAttributes} from 'react';
  import {SvgProps} from 'react-native-svg';
  const content: React.FC<SvgProps & RefAttributes>;
  export default content;
}
