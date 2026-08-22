import type * as cn from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Button, Icon, Image, Text } from '@tloncorp/ui';
import { ComponentProps, useCallback, useState } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { useOptionalChannelContext } from '../../contexts/channel';
import { ContactName as ContactNameV2 } from '../ContactNameV2';
import { Reference } from '../ContentReference/Reference';
import { KitDetailSheet } from '../KitDetailSheet';

export type KitCardData = cn.KitCardBlockData['kit'];

/**
 * Reference-style card for a `kit-card` post block. Tapping anywhere opens
 * the kit detail sheet. Kits are templates — users can install as many
 * instances as they want — so the trailing button is always a "Get" CTA,
 * except when the current group's blob carries this kit ("Runs here").
 *
 * Note: unlike GroupReference, which delegates presses to the navigation
 * context, this card renders its own KitDetailSheet so it stays
 * self-contained wherever the block appears.
 */
export function KitCard({
  kit,
  ...props
}: { kit: KitCardData } & ComponentProps<typeof Reference.Frame>) {
  const [detailOpen, setDetailOpen] = useState(false);
  const channel = useOptionalChannelContext();
  const { data: currentGroup } = store.useGroup({
    id: channel?.groupId ?? undefined,
  });
  const currentGroupKit = store.useGroupKit(currentGroup);

  const runsHere =
    currentGroupKit != null &&
    currentGroupKit.kit.id === kit.id &&
    currentGroupKit.kit.publisher === kit.publisher;

  const openDetail = useCallback(() => setDetailOpen(true), []);

  return (
    <>
      <Reference.Frame pressable {...props} onPress={openDetail}>
        <Reference.Header>
          <Reference.Title>
            <Reference.TitleIcon type="Gift" />
            <Reference.TitleText>Kit</Reference.TitleText>
          </Reference.Title>
          <Reference.ActionIcon />
        </Reference.Header>
        <Reference.Body pointerEvents="auto">
          <XStack padding="$l" gap="$l" alignItems="center">
            <KitCardIcon image={kit.image ?? null} />
            <YStack flex={1} gap="$2xs">
              <Text size="$label/l" numberOfLines={1}>
                {kit.name}
              </Text>
              {kit.description ? (
                <Text size="$label/m" color="$secondaryText" numberOfLines={1}>
                  {kit.description}
                </Text>
              ) : null}
              <Text size="$label/s" color="$tertiaryText">
                <ContactNameV2 contactId={kit.publisher} mode="contactId" />
              </Text>
            </YStack>
            {runsHere ? (
              <Text size="$label/m" color="$tertiaryText">
                Runs here
              </Text>
            ) : (
              <Button
                fill="solid"
                type="primary"
                label="Get"
                onPress={openDetail}
                testID="ActionButton-GetKit"
              />
            )}
          </XStack>
        </Reference.Body>
      </Reference.Frame>
      <KitDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        kit={kit}
      />
    </>
  );
}

function KitCardIcon({ image }: { image: string | null }) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      <Image
        source={image}
        width="$4xl"
        height="$4xl"
        borderRadius="$s"
        contentFit="cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View
      width="$4xl"
      height="$4xl"
      borderRadius="$s"
      backgroundColor="$secondaryBackground"
      alignItems="center"
      justifyContent="center"
    >
      <Icon type="Gift" color="$secondaryText" size="$m" />
    </View>
  );
}
