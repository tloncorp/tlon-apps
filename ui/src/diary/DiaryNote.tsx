import bigInt from 'big-integer';
import { isSameDay } from 'date-fns';
import React, { useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router';
import { daToUnix, udToDec } from '@urbit/api';
import Divider from '@/components/Divider';
import Layout from '@/components/Layout/Layout';
import { canWriteChannel, pluralize, sampleQuippers } from '@/logic/utils';
import {
  useDiaryBrief,
  useNote,
  useDiaryPerms,
  useJoinDiaryMutation,
  useIsNotePending,
  useNotesOnHost,
} from '@/state/diary';
import {
  useRouteGroup,
  useVessel,
  useAmAdmin,
  useGroup,
  useChannel,
} from '@/state/groups/groups';
import {
  DiaryBrief,
  DiaryOutline,
  DiaryOutlines,
  DiaryQuip,
} from '@/types/diary';
import { useDiaryCommentSortMode } from '@/state/settings';
import {
  useChannelIsJoined,
  useChannel as useChannelSpecific,
} from '@/logic/channel';
import { useGroupsAnalyticsEvent } from '@/logic/useAnalyticsEvent';
import { ViewProps } from '@/types/groups';
import { useConnectivityCheck } from '@/state/vitals';
import DiaryComment, { DiaryCommentProps } from './DiaryComment';
import DiaryCommentField from './DiaryCommentField';
import DiaryContent from './DiaryContent/DiaryContent';
import DiaryNoteHeader from './DiaryNoteHeader';
import DiaryNoteHeadline from './DiaryNoteHeadline';

function groupQuips(
  noteId: string,
  quips: [bigInt.BigInteger, DiaryQuip][],
  brief: DiaryBrief
) {
  const grouped: Record<string, DiaryCommentProps[]> = {};
  let currentTime: string;

  quips.forEach(([t, q], i) => {
    const prev = i > 0 ? quips[i - 1] : undefined;
    const { author } = q.memo;
    const time = t.toString();
    const newAuthor = author !== prev?.[1].memo.author;
    const unreadBrief =
      brief && brief['read-id'] === q.cork.time.toString() ? brief : undefined;

    if (newAuthor) {
      currentTime = time;
    }

    if (!(currentTime in grouped)) {
      grouped[currentTime] = [];
    }

    grouped[currentTime].push({
      time: t,
      quip: q,
      newAuthor,
      noteId,
      newDay: false,
      unreadCount: unreadBrief && brief.count,
    });
  });

  return Object.entries(grouped);
}

function setNewDays(quips: [string, DiaryCommentProps[]][]) {
  return quips.map(([time, comments], index) => {
    const prev = index !== 0 ? quips[index - 1] : undefined;
    const prevQuipTime = prev ? bigInt(prev[0]) : undefined;
    const unix = new Date(daToUnix(bigInt(time)));

    const lastQuipDay = prevQuipTime
      ? new Date(daToUnix(prevQuipTime))
      : undefined;

    const newDay = lastQuipDay ? !isSameDay(unix, lastQuipDay) : false;

    const quip = comments.shift();
    const newComments = [{ ...quip, newDay }, ...comments];
    return [time, newComments] as [string, DiaryCommentProps[]];
  });
}

export default function DiaryNote({ title }: ViewProps) {
  const { chShip, chName, noteId = '' } = useParams();
  const isPending = useIsNotePending(noteId);
  const { data } = useConnectivityCheck(chShip ?? '');
  const navigate = useNavigate();
  const chFlag = `${chShip}/${chName}`;
  const nest = `diary/${chFlag}`;
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const channel = useChannel(groupFlag, nest);
  const { note, status } = useNote(chFlag, noteId);
  const vessel = useVessel(groupFlag, window.our);
  const joined = useChannelIsJoined(nest);
  const isAdmin = useAmAdmin(groupFlag);
  const brief = useDiaryBrief(chFlag);
  const sort = useDiaryCommentSortMode(chFlag);
  const perms = useDiaryPerms(chFlag);
  const chan = useChannelSpecific(chFlag);
  const saga = chan?.saga;
  const { mutateAsync: joinDiary } = useJoinDiaryMutation();
  const joinChannel = useCallback(async () => {
    await joinDiary({ group: groupFlag, chan: chFlag });
  }, [chFlag, groupFlag, joinDiary]);
  const notesOnHost = useNotesOnHost(chFlag, isPending);
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
      (noteId === note.seal.time || note.seal.time === undefined)
    ) {
      if (notesOnHost && typeof notesOnHost === 'object') {
        const foundNote = Object.keys(notesOnHost).filter((n: string) => {
          if ('sent' in (notesOnHost as DiaryOutlines)[n]) {
            const outline: DiaryOutline = (notesOnHost as DiaryOutlines)[n];
            return outline.sent === daToUnix(bigInt(noteId));
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

  if (!note.essay || status === 'loading') {
    return (
      <Layout
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

  const { quips } = note.seal;
  const quipArray = Array.from(quips).reverse(); // natural reading order
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const groupedQuips = setNewDays(
    groupQuips(noteId, quipArray, brief).sort(([a], [b]) => {
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
          title={note.essay.title}
          time={noteId}
          canEdit={isAdmin || window.our === note.essay.author}
          nest={nest}
        />
      }
    >
      <Helmet>
        <title>
          {note && channel && group
            ? `${note.essay.title} in ${channel.meta.title} • ${
                group.meta.title || ''
              } ${title}`
            : title}
        </title>
      </Helmet>
      <div className="h-full overflow-y-scroll p-6">
        <section className="mx-auto flex  max-w-[600px] flex-col space-y-12 pb-32">
          <DiaryNoteHeadline
            quipCount={note.seal.quips.size}
            quippers={sampleQuippers(note.seal.quips)}
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
                  {quips.size > 0
                    ? `${quips.size} ${pluralize('comment', quips.size)}`
                    : 'No comments'}
                </h2>
              </Divider>
            </div>
            {canWrite && saga && 'synced' in saga ? (
              <DiaryCommentField
                flag={chFlag}
                groupFlag={groupFlag}
                replyTo={noteId}
              />
            ) : null}
            <ul className="mt-12">
              {groupedQuips.map(([_t, g]) =>
                g.map((props) => (
                  <li key={props.time.toString()}>
                    <DiaryComment {...props} />
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
