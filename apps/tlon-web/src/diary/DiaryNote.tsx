import { Post, Posts } from '@tloncorp/shared/dist/urbit/channel';
import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { useCallback, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useParams } from 'react-router';

import Divider from '@/components/Divider';
import Layout from '@/components/Layout/Layout';
import {
  canWriteChannel,
  useChannelCompatibility,
  useChannelIsJoined,
} from '@/logic/channel';
import getKindDataFromEssay from '@/logic/getKindData';
import { useBottomPadding } from '@/logic/position';
import { useGroupsAnalyticsEvent } from '@/logic/useAnalyticsEvent';
import { getFlagParts, pluralize } from '@/logic/utils';
import ReplyMessage from '@/replies/ReplyMessage';
import { groupReplies, setNewDaysForReplies } from '@/replies/replies';
import {
  useIsPostPending,
  useJoinMutation,
  usePerms,
  usePost,
  usePostsOnHost,
  useUnread,
} from '@/state/channel/channel';
import {
  useAmAdmin,
  useGroup,
  useGroupChannel,
  useRouteGroup,
  useVessel,
} from '@/state/groups/groups';
import { useDiaryCommentSortMode } from '@/state/settings';
import { useConnectivityCheck } from '@/state/vitals';

import DiaryCommentField from './DiaryCommentField';
import DiaryContent from './DiaryContent/DiaryContent';
import DiaryNoteHeader from './DiaryNoteHeader';
import DiaryNoteHeadline from './DiaryNoteHeadline';

export default function DiaryNote({ title }: ViewProps) {
  const { chShip, chName, noteId = '' } = useParams();
  const { data } = useConnectivityCheck(chShip ?? '');
  const navigate = useNavigate();
  const chFlag = `${chShip}/${chName}`;
  const nest = `diary/${chFlag}`;
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const channel = useGroupChannel(groupFlag, nest);
  const { ship } = getFlagParts(chFlag);
  const { post: note, status } = usePost(nest, noteId);
  const location = useLocation();
  const scrollTo = useMemo(() => {
    const reply = new URLSearchParams(location.search).get('reply');
    return reply ? bigInt(reply) : bigInt.zero;
  }, [location.search]);
  const isPending = useIsPostPending({
    author: window.our,
    sent: note?.essay?.sent || 0,
  });
  const vessel = useVessel(groupFlag, window.our);
  const joined = useChannelIsJoined(nest);
  const isAdmin = useAmAdmin(groupFlag);
  const unread = useUnread(nest);
  const sort = useDiaryCommentSortMode(chFlag);
  const perms = usePerms(nest);
  const { paddingBottom } = useBottomPadding();
  const { compatible } = useChannelCompatibility(nest);
  const { mutateAsync: joinDiary } = useJoinMutation();
  const joinChannel = useCallback(async () => {
    await joinDiary({ group: groupFlag, chan: nest });
  }, [nest, groupFlag, joinDiary]);
  const notesOnHost = usePostsOnHost(nest, isPending);
  const checkIfPreviouslyCached = useCallback(() => {
    // If we have a note, and the host ship is online, and we have a noteId, and
    // the noteId matches the note's seal time, then we have a cached note.
    // If we have a note and noteId and no seal time, then we probably did have a cached note
    // but the cache was cleared (user probably refreshed).
    // If we have notes on the host, and we can find the real note via the sent time matching the noteId
    // then we redirect to the real note.
    if (
      data?.status &&
      'complete' in data.status &&
      data.status.complete === 'yes' &&
      note &&
      noteId !== '' &&
      (noteId === note.seal.id || note.seal.id === undefined)
    ) {
      if (notesOnHost && typeof notesOnHost === 'object') {
        const foundNote = Object.keys(notesOnHost).filter((n: string) => {
          const noteOnHost: Post | null = (notesOnHost as Posts)[n];
          if (noteOnHost) {
            return noteOnHost.seal.id === noteId;
          }
          return false;
        });

        if (foundNote.length > 0) {
          const foundNoteId = udToDec(foundNote[0]);

          if (foundNoteId !== noteId) {
            navigate(
              `/groups/${groupFlag}/channels/diary/${chFlag}/note/${foundNoteId}`
            );
          }
        }
      }
    }
  }, [chFlag, noteId, notesOnHost, groupFlag, navigate, note, data]);

  useEffect(() => {
    if (!joined) {
      joinChannel();
    }
  }, [joined, joinChannel]);

  useEffect(() => {
    checkIfPreviouslyCached();
  }, [checkIfPreviouslyCached]);

  useGroupsAnalyticsEvent({
    name: 'view_item',
    groupFlag,
    chFlag,
    channelType: 'diary',
  });

  if (!note || !note.essay) {
    return (
      <Layout
        style={{
          paddingBottom,
        }}
        className="h-full flex-1 bg-white"
        header={
          <DiaryNoteHeader
            title={'Loading note...'}
            time={noteId}
            canEdit={false}
            nest={nest}
          />
        }
      >
        <div className="flex h-full w-full flex-col items-center justify-center">
          Loading...
        </div>
      </Layout>
    );
  }

  const { replies } = note.seal;
  const replyArray = replies
    ? replies
        .filter(([k, v]) => v !== null)
        .sort(([a], [b]) => {
          if (sort === 'asc') {
            return a.toString().localeCompare(b.toString());
          }

          return b.toString().localeCompare(a.toString());
        })
    : [];
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const { title: noteTitle, image } = getKindDataFromEssay(note.essay);
  const groupedReplies = setNewDaysForReplies(
    groupReplies(noteId, replyArray, unread).sort(([a], [b]) => {
      if (sort === 'asc') {
        return a.localeCompare(b);
      }

      return b.localeCompare(a);
    })
  );

  return (
    <Layout
      className="h-full flex-1 bg-white"
      header={
        <DiaryNoteHeader
          title={noteTitle}
          time={noteId}
          canEdit={(isAdmin || window.our === note.essay.author) && !isPending}
          nest={nest}
        />
      }
    >
      <Helmet>
        <title>
          {note && channel && group
            ? `${noteTitle} in ${channel.meta.title} • ${
                group.meta.title || ''
              } ${title}`
            : title}
        </title>
      </Helmet>
      <div className="h-full overflow-y-scroll p-6">
        <section className="mx-auto flex  max-w-[600px] flex-col space-y-12 pb-32">
          <DiaryNoteHeadline
            replyCount={note.seal.replies ? note.seal.replies.length : 0}
            lastRepliers={note.seal.meta.lastRepliers}
            essay={note.essay}
            time={bigInt(noteId)}
          />
          {isPending ? (
            <div className="flex flex-col space-y-4">
              <p className="text-gray-400">This post is not yet published.</p>
              <p className="text-gray-400">
                It will be visible to others when the notebook host publishes it
                (the host may be offline).
              </p>
            </div>
          ) : null}
          <DiaryContent content={note.essay.content} />
          <footer id="comments">
            <div className="mb-3 flex items-center py-3">
              <Divider className="flex-1">
                <h2 className="font-semibold text-gray-400">
                  {replies && replies.length > 0
                    ? `${replies.length} ${pluralize(
                        'comment',
                        replies.length
                      )}`
                    : 'No comments'}
                </h2>
              </Divider>
            </div>
            {(canWrite && ship === window.our) || (canWrite && compatible) ? (
              <DiaryCommentField
                han="diary"
                flag={chFlag}
                groupFlag={groupFlag}
                replyTo={noteId}
              />
            ) : null}
            <ul className="mt-12">
              {groupedReplies.map(([_t, g]) =>
                g.map((props) => (
                  <li key={props.time.toString()}>
                    <ReplyMessage
                      whom={nest}
                      {...props}
                      isLinked={props.time.eq(scrollTo)}
                      showReply
                    />
                  </li>
                ))
              )}
            </ul>
          </footer>
        </section>
      </div>
    </Layout>
  );
}
