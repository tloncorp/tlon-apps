import cn from 'classnames';
import _ from 'lodash';
import { ReactNode, useCallback } from 'react';
import ob from 'urbit-ob';
import { Link } from 'react-router-dom';
import Bullet16Icon from '@/components/icons/Bullet16Icon';
import ShipName from '@/components/ShipName';
import { makePrettyTime, PUNCTUATION_REGEX } from '@/logic/utils';
import { useSawRopeMutation } from '@/state/hark';
import { Skein, YarnContent } from '@/types/hark';
import useRecentChannel from '@/logic/useRecentChannel';
import { useGang, useGroup } from '@/state/groups';
import useGroupJoin from '@/groups/useGroupJoin';
import HeapBlock from '@/heap/HeapBlock';
import { useIsMobile } from '@/logic/useMedia';
import { usePost } from '@/state/channel/channel';
import {
  isComment,
  isGroupMeta,
  isMention,
  isReply,
  isInvite,
  isMessage,
  isNote,
  isBlock,
} from './useNotifications';

interface NotificationProps {
  bin: Skein;
  topLine?: ReactNode;
  avatar?: ReactNode;
}

interface NotificationContentProps {
  content: YarnContent[];
  time: number;
  conIsMention: boolean;
  conIsReply: boolean;
  conIsComment: boolean;
  conIsNote: boolean;
  conIsBlock: boolean;
}

function NotificationContent({
  content,
  time,
  conIsMention,
  conIsReply,
  conIsComment,
  conIsNote,
  conIsBlock,
}: NotificationContentProps) {
  function renderContent(c: YarnContent, i: number) {
    if (typeof c === 'string') {
      return (
        <span key={`${c}-${time}-${i}`}>
          {c.split(' ').map((s, index) =>
            ob.isValidPatp(s.replaceAll(PUNCTUATION_REGEX, '')) ? (
              <span
                key={`${s}-${index}`}
                className="mr-1 inline-block rounded bg-blue-soft px-1.5 py-0 text-blue mix-blend-multiply dark:mix-blend-normal"
              >
                <ShipName name={s.replaceAll(PUNCTUATION_REGEX, '')} />
              </span>
            ) : (
              <span key={`${s}-${index}`}>{s} </span>
            )
          )}
        </span>
      );
    }

    if ('ship' in c) {
      return (
        <ShipName
          key={c.ship + time}
          name={c.ship}
          className="font-semibold text-gray-800"
          showAlias={true}
        />
      );
    }

    if (conIsNote) {
      return <span key={c.emph + time}>{c.emph}</span>;
    }

    return <span key={c.emph + time}>&ldquo;{c.emph}&rdquo;</span>;
  }

  if (conIsNote) {
    return (
      <div className="flex flex-col space-y-2">
        <p className="leading-5 text-gray-800 line-clamp-1">
          {_.map(_.slice(content, 0, 2), (c: YarnContent, i) =>
            renderContent(c, i)
          )}
        </p>
        <div className="note-inline-block flex p-4">
          <p className="leading-5 text-gray-800 line-clamp-1">
            {_.map(_.slice(content, 2, 3), (c: YarnContent, i) =>
              renderContent(c, i)
            )}
          </p>
          <p className="leading-5 text-gray-400 line-clamp-1">
            {_.map(_.slice(content, 3), (c: YarnContent, i) =>
              renderContent(c, i)
            )}
          </p>
        </div>
      </div>
    );
  }

  if (conIsBlock) {
    return (
      <div className="flex flex-col space-y-2">
        <p className="leading-5 text-gray-800 line-clamp-1">
          {_.map(_.slice(content, 0, 2), (c: YarnContent, i) =>
            renderContent(c, i)
          )}
        </p>
      </div>
    );
  }

  if (conIsMention) {
    return (
      <>
        <p className="mb-2 leading-5 text-gray-400 line-clamp-4">
          {_.map(_.slice(content, 0, 2), (c: YarnContent, i) =>
            renderContent(c, i)
          )}
        </p>
        <p className="leading-5 text-gray-800 line-clamp-2">
          {_.map(_.slice(content, 2), (c: YarnContent, i) =>
            renderContent(c, i)
          )}
        </p>
      </>
    );
  }

  if (conIsReply || conIsComment) {
    return (
      <>
        <p className="mb-2 leading-5 text-gray-400 line-clamp-4">
          {_.map(_.slice(content, 0, 4), (c: YarnContent, i) =>
            renderContent(c, i)
          )}
        </p>
        <p className="leading-5 text-gray-800 line-clamp-2">
          {_.map(_.slice(content, 6), (c: YarnContent, i) =>
            renderContent(c, i)
          )}
        </p>
      </>
    );
  }

  return (
    <p className="leading-5 text-gray-800 line-clamp-3">
      {_.map(content, (c: YarnContent, i) => renderContent(c, i))}
    </p>
  );
}

function mentionPath(bin: Skein): string {
  const { wer } = bin.top;
  const parts = wer.split('/');
  const han = parts[4];
  const index = parts.indexOf('note');
  const id = parts[index + 1];

  if (index < 0 || !id) {
    return wer;
  }

  if (han === 'diary' || han === 'heap') {
    return wer;
  }

  return `${parts.slice(0, index).join('/')}?msg=${id}`;
}

export default function Notification({
  bin,
  avatar,
  topLine,
}: NotificationProps) {
  const isMobile = useIsMobile();
  const { rope } = bin.top;
  const moreCount = bin.count - 1;
  const { mutate: sawRopeMutation } = useSawRopeMutation();
  const mentionBool = isMention(bin.top);
  const commentBool = isComment(bin.top);
  const inviteBool = isInvite(bin.top);
  const isMessageBool = isMessage(bin.top);
  const isNoteBool = isNote(bin.top);
  const isBlockBool = isBlock(bin.top);
  const groupMetaBool = isGroupMeta(bin.top);
  const replyBool = isReply(bin.top);
  const path = mentionBool ? mentionPath(bin) : bin.top.wer;
  const onClick = useCallback(() => {
    sawRopeMutation({ rope });
  }, [rope, sawRopeMutation]);
  const { recentChannel } = useRecentChannel(rope.group || '');
  const group = useGroup(rope.group || '');
  const gang = useGang(rope.group || '');
  const { open, reject } = useGroupJoin(rope.group || '', gang);
  const curioId = isBlockBool ? bin.top.wer.split('/')[9] : '';
  const heapFlag = isBlockBool
    ? `${bin.top.wer.split('/')[6]}/${bin.top.wer.split('/')[7]}`
    : '/';
  const { post: note, isLoading } = usePost(`heap/${heapFlag}`, curioId);

  if (isBlockBool && note && !isLoading) {
    return (
      <div className="flex flex-col">
        <div className="relative flex space-x-3 rounded-xl bg-white p-2 text-gray-400">
          <div className="flex w-full min-w-0 flex-1 space-x-3">
            <div className="relative flex-none self-start">{avatar}</div>
            <div className="flex flex-col space-y-2">
              <div className="min-w-0 grow-0 break-words p-1">{topLine}</div>
              <div className="my-2 leading-5">
                <NotificationContent
                  time={bin.time}
                  content={bin.top.con}
                  conIsMention={mentionBool}
                  conIsComment={commentBool}
                  conIsReply={replyBool}
                  conIsNote={isNoteBool}
                  conIsBlock
                />
              </div>
              <div className="max-w-[36px] sm:max-w-[190px]">
                <div className="aspect-h-1 aspect-w-1 cursor-pointer">
                  <HeapBlock
                    post={note}
                    time={curioId}
                    asMobileNotification={isMobile}
                    linkFromNotification={bin.top.wer}
                  />
                </div>
              </div>
              {moreCount > 0 ? (
                <p className="mt-2 text-sm font-semibold">
                  Latest of {moreCount} new blocks
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex space-x-3 rounded-xl bg-white p-2 text-gray-400">
      {inviteBool ? (
        <div className="flex w-full min-w-0 flex-1 space-x-3">
          <div className="relative flex-none self-start">{avatar}</div>
          <div className="min-w-0 grow-0 break-words p-1">
            {topLine}
            <div className="my-2 leading-5">
              {bin.top && (
                <NotificationContent
                  time={bin.time}
                  content={bin.top.con}
                  conIsMention={mentionBool}
                  conIsComment={commentBool}
                  conIsReply={replyBool}
                  conIsNote={isNoteBool}
                  conIsBlock={isBlockBool}
                />
              )}
            </div>
            {gang && !group && (
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={open}
                  className="small-button bg-blue-soft text-blue"
                >
                  Accept
                </button>
                <button
                  onClick={reject}
                  className="small-button bg-gray-50 text-gray-800"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <Link
          to={path}
          state={
            groupMetaBool
              ? {
                  backgroundLocation: {
                    pathname: `/groups/${rope.group}/channels/${recentChannel}`,
                  },
                }
              : undefined
          }
          className="flex w-full min-w-0 flex-1 space-x-3"
          onClick={onClick}
        >
          <div className="relative flex-none self-start">{avatar}</div>
          <div className="min-w-0 grow-0 break-words p-1">
            {topLine}
            <div className="my-2 leading-5">
              {bin.top && (
                <NotificationContent
                  time={bin.time}
                  content={bin.top.con}
                  conIsMention={mentionBool}
                  conIsComment={commentBool}
                  conIsReply={replyBool}
                  conIsNote={isNoteBool}
                  conIsBlock={isBlockBool}
                />
              )}
            </div>
            {moreCount > 0 ? (
              <p className="mt-2 text-sm font-semibold">
                Latest of {moreCount} new messages
              </p>
            ) : null}
            {mentionBool || commentBool || replyBool || isMessageBool ? (
              <p
                className={cn(
                  'small-button bg-blue-soft text-blue',
                  moreCount > 0 ? 'mt-2' : 'mt-0'
                )}
              >
                Reply
              </p>
            ) : null}
          </div>
        </Link>
      )}
      <div className="absolute right-5 flex-none p-1">
        <div className="flex items-center space-x-1">
          {bin.unread ? <Bullet16Icon className="h-4 w-4 text-blue" /> : null}
          <span className="text-sm font-semibold">
            {makePrettyTime(new Date(bin.time))}
          </span>
        </div>
      </div>
    </div>
  );
}
