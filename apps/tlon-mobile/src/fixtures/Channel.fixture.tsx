import { useQuery } from '@tanstack/react-query';
import {
  useChannel,
  useGroupPreview,
  usePostWithRelations,
} from '@tloncorp/shared/dist';
import type { Upload } from '@tloncorp/shared/dist/api';
import type * as db from '@tloncorp/shared/dist/db';
import { Channel, ChannelSwitcherSheet } from '@tloncorp/ui';
import type { ComponentProps, PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';

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

const usePostReference = ({
  postId,
  channelId,
}: {
  postId: string;
  channelId: string;
}) => {
  return useQuery({
    queryFn: () => posts.find((p) => p.id === postId) ?? null,
    queryKey: ['post', postId],
  });
};

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

const ChannelFixtureWrapper = ({
  children,
  theme,
}: PropsWithChildren<{ theme?: 'light' | 'dark' }>) => {
  return (
    <FixtureWrapper fillWidth fillHeight theme={theme}>
      {children}
    </FixtureWrapper>
  );
};

const baseProps: ComponentProps<typeof Channel> = {
  headerMode: 'default',
  posts: posts,
  channel: tlonLocalIntros,
  currentUserId: '~zod',
  contacts: initialContacts,
  negotiationMatch: true,
  isLoadingPosts: false,
  group: group,
  goBack: () => {},
  goToSearch: () => {},
  goToChannels: () => {},
  goToDm: () => {},
  goToPost: () => {},
  goToImageViewer: () => {},
  goToUserProfile: () => {},
  messageSender: async () => {},
  markRead: () => {},
  editPost: async () => {},
  uploadAsset: async () => {},
  onPressRef: () => {},
  usePost: usePostWithRelations,
  usePostReference: usePostReference,
  useChannel: useChannel,
  useGroup: useGroupPreview,
  onGroupAction: () => {},
  getDraft: async () => ({}),
  storeDraft: () => {},
  clearDraft: () => {},
  canUpload: true,
  onPressRetry: () => {},
  onPressDelete: () => {},
} as const;

export const ChannelFixture = (props: {
  theme?: 'light' | 'dark';
  negotiationMatch?: boolean;
  headerMode?: 'default' | 'next';
  passedProps?: (
    baseProps: ComponentProps<typeof Channel>
  ) => Partial<ComponentProps<typeof Channel>>;
}) => {
  const switcher = useChannelSwitcher(tlonLocalIntros);

  const channelProps = useMemo(
    () => ({
      ...baseProps,
      headerModel: props.headerMode,
      channel: switcher.activeChannel,
      negotiationMatch: props.negotiationMatch ?? true,
      goToChannels: () => switcher.open(),
    }),
    [props.headerMode, props.negotiationMatch, switcher]
  );

  return (
    <ChannelFixtureWrapper theme={props.theme}>
      <Channel {...channelProps} {...props.passedProps?.(channelProps)} />
      <SwitcherFixture switcher={switcher} />
    </ChannelFixtureWrapper>
  );
};

export const NotebookChannelFixture = (props: { theme?: 'light' | 'dark' }) => {
  const switcher = useChannelSwitcher(tlonLocalGettingStarted);

  return (
    <ChannelFixtureWrapper theme={props.theme}>
      <Channel
        {...baseProps}
        posts={notebookPosts}
        channel={switcher.activeChannel}
        goToChannels={() => switcher.open()}
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
        {...baseProps}
        channel={switcher.activeChannel}
        goToChannels={switcher.open}
        initialAttachments={[
          {
            type: 'reference',
            path: '/1/chan/~nibset-napwyn/intros/msg/~solfer-magfed-3mct56',
            reference: {
              type: 'reference',
              referenceType: 'channel',
              channelId: posts[0].channelId,
              postId: posts[0].id,
            },
          },
        ]}
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
  chatWithUnreadAnchor: (
    <ChannelFixture
      negotiationMatch={true}
      theme={'light'}
      headerMode={'default'}
      passedProps={(baseProps) => ({
        initialChannelUnread: {
          channelId: baseProps.channel.id,
          type: 'channel',
          notify: false,
          count: 1,
          countWithoutThreads: 1,
          updatedAt: Date.now(),
          firstUnreadPostId: baseProps.posts!.at(10)!.id,
        },
      })}
    />
  ),
  notebook: <NotebookChannelFixture />,
  chatWithImage: <ChannelFixtureWithImage />,
  negotiationMismatch: <ChannelFixture negotiationMatch={false} />,
};
