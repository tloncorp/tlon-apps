import _ from 'lodash';
import Divider from '@/components/Divider';
import Layout from '@/components/Layout/Layout';
import { canWriteChannel, pluralize, sampleQuippers } from '@/logic/utils';
import { useBrief, useDiaryState, useNote, useDiaryPerms } from '@/state/diary';
import {
  useRouteGroup,
  useVessel,
  useAmAdmin,
  useGroup,
} from '@/state/groups/groups';
import { DiaryBrief, DiaryQuip } from '@/types/diary';
import { daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import { isSameDay } from 'date-fns';
import React, { useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import {
  DiarySetting,
  setSetting,
  useDiaryCommentSortMode,
  useDiarySettings,
  useSettingsState,
} from '@/state/settings';
import DiaryComment, { DiaryCommentProps } from './DiaryComment';
import DiaryCommentField from './DiaryCommentField';
import DiaryContent from './DiaryContent/DiaryContent';
import DiaryNoteHeader from './DiaryNoteHeader';
import DiaryNoteHeadline from './DiaryNoteHeadline';

function groupQuips(
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
      brief && brief['read-id'] === q.cork.time ? brief : undefined;

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

export default function DiaryNote() {
  const { chShip, chName, noteId = '' } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const [id, note] = useNote(chFlag, noteId)!;
  const vessel = useVessel(flag, window.our);
  const isAdmin = useAmAdmin(flag);
  const { quips } = note.seal;
  const quipArray = Array.from(quips).reverse(); // natural reading order
  const brief = useBrief(chFlag);
  const settings = useDiarySettings();
  const sort = useDiaryCommentSortMode(chFlag);
  const groupedQuips = setNewDays(
    groupQuips(quipArray, brief).sort(([a], [b]) => {
      if (sort === 'asc') {
        return a.localeCompare(b);
      }

      return b.localeCompare(a);
    })
  );

  const perms = useDiaryPerms(chFlag);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);

  const setSort = useCallback(
    (setting: 'asc' | 'dsc') => {
      const newSettings = setSetting<DiarySetting>(
        settings,
        { commentSortMode: setting },
        chFlag
      );

      useSettingsState
        .getState()
        .putEntry('diary', 'settings', JSON.stringify(newSettings));
    },
    [settings, chFlag]
  );
  const loading = id.isZero();

  useEffect(() => {
    async function load() {
      await useDiaryState.getState().initialize(chFlag);
      if (loading) {
        useDiaryState.getState().fetchNote(chFlag, noteId);
      }
    }

    load();
  }, [chFlag, noteId, loading]);

  return (
    <Layout
      className="h-full flex-1 bg-white"
      header={
        <DiaryNoteHeader
          title={note.essay.title}
          flag={chFlag}
          time={noteId}
          canEdit={isAdmin || window.our === note.essay.author}
        />
      }
    >
      <div className="h-full overflow-y-scroll p-6">
        {loading ? (
          <div>Loading...</div>
        ) : (
          <section className="mx-auto flex  max-w-[600px] flex-col space-y-12 pb-32">
            <DiaryNoteHeadline
              quipCount={note.seal.quips.size}
              quippers={sampleQuippers(note.seal.quips)}
              essay={note.essay}
              time={bigInt(noteId)}
            />
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
                <Dropdown.Root>
                  <Dropdown.Trigger className="secondary-button">
                    {sort === 'asc' ? 'Oldest' : 'Newest'}
                    <CaretDown16Icon className="ml-2 h-4 w-4 text-gray-600" />
                  </Dropdown.Trigger>
                  <Dropdown.Content className="dropdown">
                    <Dropdown.Item
                      className="dropdown-item"
                      onSelect={() => setSort('dsc')}
                    >
                      Newest
                    </Dropdown.Item>
                    <Dropdown.Item
                      className="dropdown-item"
                      onSelect={() => setSort('asc')}
                    >
                      Oldest
                    </Dropdown.Item>
                  </Dropdown.Content>
                </Dropdown.Root>
              </div>
              {canWrite ? (
                <DiaryCommentField flag={chFlag} replyTo={noteId} />
              ) : null}
              <ul className="mt-12">
                {groupedQuips.map(([t, g]) =>
                  g.map((props) => (
                    <li key={props.time.toString()}>
                      <DiaryComment {...props} />
                    </li>
                  ))
                )}
              </ul>
            </footer>
          </section>
        )}
      </div>
    </Layout>
  );
}
