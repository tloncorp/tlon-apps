import { View, styled } from 'tamagui';
import { LinearGradient } from 'tamagui/linear-gradient';

import { Image } from './Image';

const ProfileCoverFrame = styled(View, {
  borderRadius: '$2xl',
  overflow: 'hidden',
});

const ProfileCoverImage = ProfileCoverFrame.styleable<{
  uri: string;
  showBackgroundOverlay?: boolean;
}>(({ uri, showBackgroundOverlay = true, children, ...props }, ref) => {
  return (
    <View borderRadius="$2xl" overflow="hidden" {...props} ref={ref}>
      <Image
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
        source={{ uri }}
        contentFit="cover"
      />
      {showBackgroundOverlay && (
        <LinearGradient
          position="absolute"
          left={0}
          right={0}
          bottom={0}
          top={0}
          opacity={0.3}
          locations={[0.3, 1]}
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
        />
      )}
      {children}
    </View>
  );
});

export default ProfileCoverImage;
