// tamagui-ignore
import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { type PropsWithChildren } from 'react';

import {
  AppDataContextProvider,
  RequestsProvider,
  ScrollView,
  View,
} from '../ui';
import { ReactionsDisplay } from '../ui/components/ChatMessage/ReactionsDisplay';
import { FixtureWrapper } from './FixtureWrapper';
import { useChannel, useGroup, usePostReference } from './contentHelpers';
import {
  brianContact,
  createFakePost,
  danContact,
  edContact,
  galenContact,
  hunterContact,
  initialContacts,
  jamesContact,
  markContact,
} from './fakeData';

const REACTOR_IDS = [
  galenContact.id,
  jamesContact.id,
  danContact.id,
  hunterContact.id,
  brianContact.id,
] as const;

const longReactors = REACTOR_IDS.map(
  (id) =>
    ({
      contactId: id,
      postId: 'fake-reactions-post',
      value: ':sparkles:',
    }) as db.Reaction
);

function buildReactionPost({
  reactions,
  type = 'chat',
}: {
  reactions: db.Reaction[];
  type?: db.PostType;
}): db.Post {
  return {
    ...createFakePost(type),
    id: 'fake-reactions-post',
    reactions,
  };
}

function FixtureSection({
  label,
  children,
}: PropsWithChildren<{ label: string }>) {
  return (
    <View padding="$m" gap="$s">
      <Text size="$label/s" color="$tertiaryText">
        {label}
      </Text>
      <View>{children}</View>
    </View>
  );
}

function ReactionsFixtureWrapper({ children }: PropsWithChildren<object>) {
  return (
    <FixtureWrapper fillWidth fillHeight>
      {/* @ts-expect-error don't care */}
      <RequestsProvider
        useChannel={useChannel}
        useGroup={useGroup}
        usePostReference={usePostReference}
      >
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {children}
        </ScrollView>
      </RequestsProvider>
    </FixtureWrapper>
  );
}

const ManyLongIds = () => {
  const post = buildReactionPost({ reactions: longReactors });
  return (
    <ReactionsFixtureWrapper>
      <FixtureSection label="manyLongIds — nicknames render, ship IDs do not split at hyphens">
        <ReactionsDisplay post={post} />
      </FixtureSection>
    </ReactionsFixtureWrapper>
  );
};

// Same reactors but reaction.contact is undefined — proves the tooltip uses
// canonical resolution from AppDataContextProvider, not the eager DB relation.
const NoContactRelation = () => {
  const reactions: db.Reaction[] = REACTOR_IDS.map((id) => ({
    contactId: id,
    postId: 'fake-reactions-post',
    value: ':sparkles:',
    contact: undefined,
  }));
  const post = buildReactionPost({ reactions });
  return (
    <ReactionsFixtureWrapper>
      <FixtureSection label="noContactRelation — reaction.contact undefined; names still resolve via AppDataContextProvider">
        <ReactionsDisplay post={post} />
      </FixtureSection>
    </ReactionsFixtureWrapper>
  );
};

// Override AppDataContextProvider with empty contacts to verify full ID fallback.
const NoContactsAtAll = () => {
  const post = buildReactionPost({ reactions: longReactors });
  return (
    <ReactionsFixtureWrapper>
      <AppDataContextProvider currentUserId="~zod" contacts={[]}>
        <FixtureSection label="noContactsAtAll — no contacts in scope; full ship IDs render unsplit">
          <ReactionsDisplay post={post} />
        </FixtureSection>
      </AppDataContextProvider>
    </ReactionsFixtureWrapper>
  );
};

// initialContacts already use the COALESCE-only `nickname` field (no
// customNickname/peerNickname). This variant proves the canonical path catches
// what the legacy resolveContactName missed.
const NicknameOnly = () => {
  const reactions: db.Reaction[] = [
    galenContact,
    jamesContact,
    danContact,
    edContact,
  ].map((c) => ({
    contactId: c.id,
    postId: 'fake-reactions-post',
    value: ':wave:',
  }));
  const post = buildReactionPost({ reactions });
  return (
    <ReactionsFixtureWrapper>
      <FixtureSection label="nicknameOnly — initialContacts only set `nickname`; canonical resolver still finds them">
        <ReactionsDisplay post={post} />
      </FixtureSection>
    </ReactionsFixtureWrapper>
  );
};

const CalmDisableNicknames = () => {
  const post = buildReactionPost({ reactions: longReactors });
  return (
    <ReactionsFixtureWrapper>
      <AppDataContextProvider
        currentUserId="~zod"
        contacts={[...initialContacts]}
        calmSettings={{
          disableRemoteContent: false,
          disableAvatars: false,
          disableNicknames: true,
        }}
      >
        <FixtureSection label="calmDisableNicknames — Calm hides nicknames, full IDs render">
          <ReactionsDisplay post={post} />
        </FixtureSection>
      </AppDataContextProvider>
    </ReactionsFixtureWrapper>
  );
};

const PathologicalLongName = () => {
  const longNicknameContact: db.Contact = {
    ...markContact,
    id: '~palfun-foslup',
    nickname:
      'A very long nickname that exceeds the tooltip max width by a lot',
  };
  const reactions: db.Reaction[] = [
    {
      contactId: longNicknameContact.id,
      postId: 'fake-reactions-post',
      value: ':fire:',
    },
    ...longReactors.slice(0, 2),
  ];
  const post = buildReactionPost({ reactions });
  return (
    <ReactionsFixtureWrapper>
      <AppDataContextProvider
        currentUserId="~zod"
        contacts={[
          longNicknameContact,
          ...initialContacts.filter((c) => c.id !== longNicknameContact.id),
        ]}
      >
        <FixtureSection label="pathologicalLongName — pathologically long nickname truncates with ellipsis inside fragment max width">
          <ReactionsDisplay post={post} />
        </FixtureSection>
      </AppDataContextProvider>
    </ReactionsFixtureWrapper>
  );
};

const MinimalDisplay = () => {
  const post = buildReactionPost({ reactions: longReactors });
  return (
    <ReactionsFixtureWrapper>
      <FixtureSection label="minimalDisplay — minimal branch uses same tooltip">
        <ReactionsDisplay post={post} minimal />
      </FixtureSection>
    </ReactionsFixtureWrapper>
  );
};

const NarrowViewport = () => {
  const post = buildReactionPost({ reactions: longReactors });
  return (
    <ReactionsFixtureWrapper>
      <View width={360} alignItems="flex-end" padding="$s">
        <FixtureSection label="narrowViewport — tooltip clamps to viewport on web (no horizontal scrollbar)">
          <ReactionsDisplay post={post} />
        </FixtureSection>
      </View>
    </ReactionsFixtureWrapper>
  );
};

const SingleShortName = () => {
  const billContact: db.Contact = {
    ...markContact,
    id: '~palfun-foslup',
    nickname: 'bill',
  };
  const post = buildReactionPost({
    reactions: [
      {
        contactId: billContact.id,
        postId: 'fake-reactions-post',
        value: ':thumbs-up:',
      },
    ],
  });
  return (
    <ReactionsFixtureWrapper>
      <AppDataContextProvider currentUserId="~zod" contacts={[billContact]}>
        <FixtureSection label="singleShortName — short names shrink to content width">
          <ReactionsDisplay post={post} />
        </FixtureSection>
      </AppDataContextProvider>
    </ReactionsFixtureWrapper>
  );
};

export default {
  manyLongIds: <ManyLongIds />,
  noContactRelation: <NoContactRelation />,
  noContactsAtAll: <NoContactsAtAll />,
  nicknameOnly: <NicknameOnly />,
  calmDisableNicknames: <CalmDisableNicknames />,
  pathologicalLongName: <PathologicalLongName />,
  minimalDisplay: <MinimalDisplay />,
  narrowViewport: <NarrowViewport />,
  singleShortName: <SingleShortName />,
};
