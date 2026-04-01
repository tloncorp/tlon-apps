import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import MediaViewerScreen from '../features/top/MediaViewerScreen';
import type { RootStackParamList } from '../navigation/types';
import { FixtureWrapper } from './FixtureWrapper';

type MediaViewerScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'MediaViewer'
>;

const fixtureScreenProps = {
  navigation: { pop: () => {} },
  route: {
    key: 'media-viewer',
    name: 'MediaViewer',
    params: {
      mediaType: 'image',
      uri: 'https://d2w9rnfcy7mm78.cloudfront.net/25296321/original_81eb3ac8a95ce36dc8d64b1038234ec8.jpg',
    },
  },
} as unknown as MediaViewerScreenProps;

export default {
  basic: (
    <FixtureWrapper fillWidth fillHeight>
      <MediaViewerScreen {...fixtureScreenProps} />
    </FixtureWrapper>
  ),
};
