declare module '*.svg' {
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps & React.RefAttributes>;
  export default content;
}
