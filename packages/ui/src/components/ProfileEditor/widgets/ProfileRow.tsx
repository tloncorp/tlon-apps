import { Image, SizableText, XStack, YStack } from '../../../core';
import { ProfileData } from '../types';

export function ProfileRow({ data }: { data: ProfileData }) {
  return (
    <XStack
      justifyContent="flex-start"
      backgroundColor="$color.gray100"
      padding="$space.m"
      borderRadius="$space.m"
      width="100%"
    >
      <Image
        height={48}
        width={48}
        borderRadius="$space.s"
        source={{
          width: 430,
          height: 430,
          uri: data.avatar ?? '',
        }}
      />
      <YStack marginLeft="$space.m" justifyContent="center">
        <SizableText fontFamily="$body" fontSize="$m" fontWeight="600">
          {data.nickname || data.patp}
        </SizableText>
        {data.nickname && (
          <SizableText
            fontFamily="$mono"
            color="$color.gray500"
            marginTop="$space.xs"
          >
            ~latter-bolden
          </SizableText>
        )}
      </YStack>
    </XStack>
  );
}
