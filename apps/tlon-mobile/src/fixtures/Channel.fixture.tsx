import {
  useChannel,
  useGroupPreview,
  usePostReference,
  usePostWithRelations,
} from '@tloncorp/shared/dist';
import type { Upload } from '@tloncorp/shared/dist/api';
import type * as db from '@tloncorp/shared/dist/db';
import { Channel, ChannelSwitcherSheet, View } from '@tloncorp/ui';
import { useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FixtureWrapper } from './FixtureWrapper';
import {
  createFakePosts,
  group,
  initialContacts,
  tlonLocalGettingStarted,
  tlonLocalIntros,
} from './fakeData';

const posts = createFakePosts(100);
const notebookPosts = createFakePosts(5, 'note');

const fakeMostRecentFile: Upload = {
  key: 'key',
  file: {
    blob: new Blob(),
    name: 'name',
    type: 'type',
    uri: 'https://togten.com:9001/finned-palmer/~dotnet-botnet-finned-palmer/2024.4.22..16.23.42..f70a.3d70.a3d7.0a3d-3DD4524C-3125-4974-978D-08EAE71CE220.jpg',
  },
  url: 'https://togten.com:9001/finned-palmer/~dotnet-botnet-finned-palmer/2024.4.22..16.23.42..f70a.3d70.a3d7.0a3d-3DD4524C-3125-4974-978D-08EAE71CE220.jpg',
  status: 'success',
  size: [100, 100],
};

const fakeLoadingMostRecentFile: Upload = {
  key: 'key',
  file: {
    blob: new Blob(),
    name: 'name',
    type: 'type',
    uri: 'https://togten.com:9001/finned-palmer/~dotnet-botnet-finned-palmer/2024.4.22..16.23.42..f70a.3d70.a3d7.0a3d-3DD4524C-3125-4974-978D-08EAE71CE220.jpg',
  },
  url: '',
  status: 'loading',
  size: [100, 100],
};

const defaultUploadInfo = {
  imageAttachment: null,
  resetImageAttachment: () => {},
  setAttachments: () => {},
  canUpload: true,
  uploading: false,
};

const ChannelFixtureWrapper = ({
  children,
  theme,
}: PropsWithChildren<{ theme?: 'light' | 'dark' }>) => {
  const { bottom } = useSafeAreaInsets();
  return (
    <FixtureWrapper fillWidth fillHeight theme={theme}>
      <View paddingBottom={bottom} backgroundColor="$background" flex={1}>
        {children}
      </View>
    </FixtureWrapper>
  );
};

export const ChannelFixture = (props: {
  theme?: 'light' | 'dark';
  negotiationMatch?: boolean;
  headerMode?: 'default' | 'next';
}) => {
  const switcher = useChannelSwitcher(tlonLocalIntros);

  return (
    <ChannelFixtureWrapper theme={props.theme}>
      <Channel
        headerMode={props.headerMode}
        posts={posts}
        currentUserId="~zod"
        channel={switcher.activeChannel}
        contacts={initialContacts}
        negotiationMatch={props.negotiationMatch ?? true}
        isLoadingPosts={false}
        group={group}
        goBack={() => {}}
        goToSearch={() => {}}
        goToChannels={() => switcher.open()}
        goToDm={() => {}}
        goToPost={() => {}}
        goToImageViewer={() => {}}
        messageSender={() => {}}
        markRead={() => {}}
        editPost={() => {}}
        uploadInfo={defaultUploadInfo}
        onPressRef={() => {}}
        usePost={usePostWithRelations}
        usePostReference={usePostReference}
        useChannel={useChannel}
        useGroup={useGroupPreview}
        onGroupAction={() => {}}
        getDraft={async () => ({})}
        storeDraft={() => {}}
        clearDraft={() => {}}
      />
      <SwitcherFixture switcher={switcher} />
    </ChannelFixtureWrapper>
  );
};

export const NotebookChannelFixture = (props: { theme?: 'light' | 'dark' }) => {
  const switcher = useChannelSwitcher(tlonLocalGettingStarted);

  return (
    <ChannelFixtureWrapper theme={props.theme}>
      <Channel
        posts={notebookPosts}
        negotiationMatch={true}
        currentUserId="~zod"
        channel={switcher.activeChannel}
        contacts={initialContacts}
        isLoadingPosts={false}
        group={group}
        goBack={() => {}}
        goToSearch={() => {}}
        goToChannels={() => switcher.open()}
        goToDm={() => {}}
        goToPost={() => {}}
        goToImageViewer={() => {}}
        messageSender={() => {}}
        markRead={() => {}}
        editPost={() => {}}
        getDraft={async () => ({})}
        storeDraft={() => {}}
        clearDraft={() => {}}
        uploadInfo={defaultUploadInfo}
        onPressRef={() => {}}
        usePost={usePostWithRelations}
        usePostReference={usePostReference}
        useChannel={useChannel}
        useGroup={useGroupPreview}
        onGroupAction={() => {}}
      />
      <SwitcherFixture switcher={switcher} />
    </ChannelFixtureWrapper>
  );
};

const ChannelFixtureWithImage = () => {
  const switcher = useChannelSwitcher(tlonLocalIntros);
  const [imageAttachment, setImageAttachment] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<Upload | null>(null);
  const mostRecentFile = fakeMostRecentFile;

  const resetImageAttachment = () => {
    setImageAttachment(null);
    setUploadedImage(null);
  };

  const fakeSetImageAttachment = () => {
    setUploadedImage(fakeLoadingMostRecentFile);

    setTimeout(() => {
      setImageAttachment(fakeMostRecentFile.url);
      setUploadedImage(fakeMostRecentFile);
    }, 1000);
  };

  useEffect(() => {
    setUploadedImage(mostRecentFile);
  }, [mostRecentFile]);

  return (
    <ChannelFixtureWrapper>
      <Channel
        posts={posts}
        currentUserId="~zod"
        channel={switcher.activeChannel}
        contacts={initialContacts}
        group={group}
        goBack={() => {}}
        goToSearch={() => {}}
        goToChannels={switcher.open}
        goToPost={() => {}}
        goToDm={() => {}}
        goToImageViewer={() => {}}
        messageSender={() => {}}
        markRead={() => {}}
        editPost={() => {}}
        negotiationMatch={true}
        isLoadingPosts={false}
        uploadInfo={{
          imageAttachment: imageAttachment,
          resetImageAttachment: resetImageAttachment,
          setAttachments: fakeSetImageAttachment,
          canUpload: true,
          uploading: false,
        }}
        onPressRef={() => {}}
        usePost={usePostWithRelations}
        usePostReference={usePostReference}
        useChannel={useChannel}
        getDraft={async () => ({})}
        storeDraft={() => {}}
        clearDraft={() => {}}
        useGroup={useGroupPreview}
        onGroupAction={() => {}}
      />
      <SwitcherFixture switcher={switcher} />
    </ChannelFixtureWrapper>
  );
};

function useChannelSwitcher(defaultChannel: db.Channel) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<db.Channel | null>(
    defaultChannel
  );

  const activeChannel: db.Channel = useMemo(() => {
    const channel = selectedChannel ?? tlonLocalGettingStarted;
    return {
      ...channel,
      unread: channel.unread
        ? {
            ...channel.unread,
            firstUnreadPostId: posts[5].id,
          }
        : null,
    };
  }, [selectedChannel]);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: (val?: boolean) => setIsOpen(val ?? !isOpen),
    activeChannel,
    setActiveChannel: setSelectedChannel,
  };
}

function SwitcherFixture({
  switcher,
}: {
  switcher: ReturnType<typeof useChannelSwitcher>;
}) {
  return (
    <ChannelSwitcherSheet
      open={switcher.isOpen}
      onOpenChange={switcher.toggle}
      group={group}
      channels={group.channels || []}
      onSelect={(channel: db.Channel) => {
        switcher.setActiveChannel(channel);
        switcher.close();
      }}
      contacts={initialContacts}
    />
  );
}

export default {
  chat: (
    <ChannelFixture
      negotiationMatch={true}
      theme={'light'}
      headerMode={'default'}
    />
  ),
  notebook: <NotebookChannelFixture />,
  chatWithImage: <ChannelFixtureWithImage />,
  negotiationMismatch: <ChannelFixture negotiationMatch={false} />,
};
