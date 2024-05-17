import { useChannel, usePostWithRelations } from '@tloncorp/shared/dist';
import type { Upload } from '@tloncorp/shared/dist/api';
import type * as db from '@tloncorp/shared/dist/db';
import { Channel, ChannelSwitcherSheet, View } from '@tloncorp/ui';
import { useEffect, useState } from 'react';
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
  },
  url: '',
  status: 'loading',
  size: [100, 100],
};

const ChannelFixtureWrapper = ({
  children,
  theme,
}: PropsWithChildren<{ theme?: 'light' | 'dark' }>) => {
  const { bottom } = useSafeAreaInsets();
  return (
    <FixtureWrapper fillWidth fillHeight theme={theme}>
      <View paddingBottom={bottom} backgroundColor="$background">
        {children}
      </View>
    </FixtureWrapper>
  );
};

export const ChannelFixture = (props: {
  theme?: 'light' | 'dark';
  negotiationMatch?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [currentChannel, setCurrentChannel] = useState<db.Channel | null>(null);
  const { bottom } = useSafeAreaInsets();

  const tlonLocalChannelWithUnreads = {
    ...tlonLocalIntros,
    // unreadCount: 40,
    // firstUnreadPostId: posts[10].id,
  };

  useEffect(() => {
    if (group) {
      const firstChatChannel = group.channels?.find((c) => c.type === 'chat');
      if (firstChatChannel) {
        setCurrentChannel(firstChatChannel);
      }
    }
  }, []);

  return (
    <ChannelFixtureWrapper theme={props.theme}>
      <Channel
        posts={posts}
        currentUserId="~zod"
        channel={currentChannel || tlonLocalChannelWithUnreads}
        contacts={initialContacts}
        negotiationMatch={props.negotiationMatch ?? true}
        isLoadingPosts={false}
        group={group}
        goBack={() => {}}
        goToSearch={() => {}}
        goToChannels={() => setOpen(true)}
        goToPost={() => {}}
        goToImageViewer={() => {}}
        messageSender={() => {}}
        editPost={() => {}}
        uploadInfo={{
          imageAttachment: null,
          resetImageAttachment: () => {},
          setImageAttachment: () => {},
          canUpload: true,
        }}
        onPressRef={() => {}}
        usePost={usePostWithRelations}
        useChannel={useChannel}
        getDraft={async () => ({})}
        storeDraft={() => {}}
        clearDraft={() => {}}
      />
      <ChannelSwitcherSheet
        open={open}
        onOpenChange={(open) => setOpen(open)}
        group={group}
        channels={group.channels || []}
        paddingBottom={bottom}
        onSelect={(channel: db.Channel) => {
          setCurrentChannel(channel);
          setOpen(false);
        }}
        contacts={initialContacts}
      />
    </ChannelFixtureWrapper>
  );
};

export const NotebookChannelFixture = (props: { theme?: 'light' | 'dark' }) => {
  const [open, setOpen] = useState(false);
  // const [currentChannel, setCurrentChannel] = useState<db.Channel | null>(null);
  const { bottom } = useSafeAreaInsets();

  const tlonLocalChannelWithUnreads = {
    ...tlonLocalGettingStarted,
    // unreadCount: 40,
    // firstUnreadPostId: posts[10].id,
  };

  // useEffect(() => {
  // if (group) {
  // const firstChatChannel = group.channels?.find((c) => c.type === 'chat');
  // if (firstChatChannel) {
  // setCurrentChannel(firstChatChannel);
  // }
  // }
  // }, []);

  return (
    <ChannelFixtureWrapper theme={props.theme}>
      <Channel
        posts={notebookPosts}
        negotiationMatch={true}
        currentUserId="~zod"
        channel={tlonLocalChannelWithUnreads}
        contacts={initialContacts}
        isLoadingPosts={false}
        group={group}
        goBack={() => {}}
        goToSearch={() => {}}
        goToChannels={() => setOpen(true)}
        goToPost={() => {}}
        goToImageViewer={() => {}}
        messageSender={() => {}}
        editPost={() => {}}
        getDraft={async () => ({})}
        storeDraft={() => {}}
        clearDraft={() => {}}
        uploadInfo={{
          imageAttachment: null,
          resetImageAttachment: () => {},
          setImageAttachment: () => {},
          canUpload: true,
        }}
        onPressRef={() => {}}
        usePost={usePostWithRelations}
        useChannel={useChannel}
      />
      <ChannelSwitcherSheet
        open={open}
        onOpenChange={(open) => setOpen(open)}
        group={group}
        channels={group.channels || []}
        paddingBottom={bottom}
        onSelect={(channel: db.Channel) => {
          // setCurrentChannel(channel);
          setOpen(false);
        }}
        contacts={initialContacts}
      />
    </ChannelFixtureWrapper>
  );
};

const ChannelFixtureWithImage = () => {
  const [open, setOpen] = useState(false);
  const [imageAttachment, setImageAttachment] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<Upload | null>(null);
  const [currentChannel, setCurrentChannel] = useState<db.Channel | null>(null);
  const { bottom } = useSafeAreaInsets();
  const mostRecentFile = fakeMostRecentFile;

  const tlonLocalChannelWithUnreads = {
    ...tlonLocalIntros,
    // unreadCount: 40,
    // firstUnreadPostId: posts[10].id,
  };

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

  useEffect(() => {
    if (group) {
      const firstChatChannel = group.channels?.find((c) => c.type === 'chat');
      if (firstChatChannel) {
        setCurrentChannel(firstChatChannel);
      }
    }
  }, []);

  return (
    <ChannelFixtureWrapper>
      <Channel
        posts={posts}
        currentUserId="~zod"
        channel={currentChannel || tlonLocalChannelWithUnreads}
        contacts={initialContacts}
        group={group}
        goBack={() => {}}
        goToSearch={() => {}}
        goToChannels={() => setOpen(true)}
        goToPost={() => {}}
        goToImageViewer={() => {}}
        messageSender={() => {}}
        editPost={() => {}}
        negotiationMatch={true}
        isLoadingPosts={false}
        uploadInfo={{
          imageAttachment: imageAttachment,
          resetImageAttachment: resetImageAttachment,
          setImageAttachment: fakeSetImageAttachment,
          canUpload: true,
        }}
        onPressRef={() => {}}
        usePost={usePostWithRelations}
        useChannel={useChannel}
        getDraft={async () => ({})}
        storeDraft={() => {}}
        clearDraft={() => {}}
      />
      <ChannelSwitcherSheet
        open={open}
        onOpenChange={(open) => setOpen(open)}
        group={group}
        channels={group.channels || []}
        paddingBottom={bottom}
        onSelect={(channel: db.Channel) => {
          setCurrentChannel(channel);
          setOpen(false);
        }}
        contacts={initialContacts}
      />
    </ChannelFixtureWrapper>
  );
};

export default {
  chat: <ChannelFixture />,
  notebook: <NotebookChannelFixture />,
  chatWithImage: <ChannelFixtureWithImage />,
  negotiationMismatch: <ChannelFixture negotiationMatch={false} />,
};
