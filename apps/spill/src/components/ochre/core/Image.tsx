import FastImage from 'react-native-fast-image';
import {styled} from 'tamagui';

// TODO: Is this efficient? `usePropsAndStyle` warns about possible issues,
// should investigate.
// Might make more sense to pull in the full tamagui image component from here:
// https://github.com/tamagui/tamagui/blob/master/packages/image/src/Image.tsx

export const Image = styled(FastImage, {name: 'FastImage'});
