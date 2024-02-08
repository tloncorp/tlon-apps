import React, {useCallback} from 'react';
import {useDetailView} from '@utils/state';
import {Paragraph, ScrollView, Sheet, Stack, XStack, YStack} from '@ochre';
import {ChannelToken, GroupToken, UserToken} from './ObjectToken';
import PostContent from './PostContent';
import {stringifyPost} from '@utils/debug.ts';

export function ObjectDetailView() {
  const {activeDetailView, clearDetailView} = useDetailView();
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        clearDetailView();
      }
    },
    [clearDetailView],
  );
  return activeDetailView ? (
    <Sheet
      native
      open={!!activeDetailView}
      snapPoints={[50]}
      onOpenChange={handleOpenChange}>
      <Sheet.ScrollView backgroundColor={'$background'}>
        <YStack padding="$s">
          {activeDetailView.type === 'post' && (
            <>
              <Stack borderColor={'$border'} padding="$m" borderWidth={1}>
                <PostContent
                  story={JSON.parse(activeDetailView.data.content ?? '[]')}
                />
              </Stack>
              <XStack gap="$xs" flexWrap="wrap">
                {activeDetailView.data.group && (
                  <GroupToken model={activeDetailView.data.group} />
                )}
                {activeDetailView.data.channel && (
                  <ChannelToken model={activeDetailView.data.channel} />
                )}
                {activeDetailView.data.author && (
                  <UserToken model={{id: activeDetailView.data.author}} />
                )}
              </XStack>
              <Stack
                flex={1}
                margin="$s"
                padding="$s"
                borderColor="$gray100"
                borderWidth={1}>
                <ScrollView flex={1}>
                  <Paragraph fontSize={'$s'}>
                    {stringifyPost(activeDetailView.data)}
                  </Paragraph>
                </ScrollView>
              </Stack>
            </>
          )}
        </YStack>
      </Sheet.ScrollView>
    </Sheet>
  ) : null;
}
