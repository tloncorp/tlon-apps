import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import { HeapCurio, isLink, CurioContent } from '@/types/heap';
import { isValidUrl, validOembedCheck } from '@/logic/utils';
import { useCalm } from '@/state/settings';
import { useEmbed } from '@/state/embed';
import { useRouteGroup, useAmAdmin } from '@/state/groups/groups';
// eslint-disable-next-line import/no-cycle
import HeapContent from '@/heap/HeapContent';
import TwitterIcon from '@/components/icons/TwitterIcon';
import IconButton from '@/components/IconButton';
import ChatSmallIcon from '@/components/icons/ChatSmallIcon';
import ElipsisSmallIcon from '@/components/icons/EllipsisSmallIcon';
import MusicLargeIcon from '@/components/icons/MusicLargeIcon';
import LinkIcon from '@/components/icons/LinkIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import useNest from '@/logic/useNest';
import useHeapContentType from '@/logic/useHeapContentType';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import CheckIcon from '@/components/icons/CheckIcon';
import { inlineToString } from '@/logic/tiptap';
import ConfirmationModal from '@/components/ConfirmationModal';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import useLongPress from '@/logic/useLongPress';
import Avatar from '@/components/Avatar';
import ActionMenu, { Action } from '@/components/ActionMenu';
import { useCurioToggler } from '@/state/heap/heap';
import useCurioActions from './useCurioActions';

interface CurioDisplayProps {
  time: string;
  asRef?: boolean;
  refToken?: string;
  asMobileNotification?: boolean;
}

interface TopBarProps extends CurioDisplayProps {
  isTwitter?: boolean;
  hasIcon?: boolean;
  canEdit: boolean;
  longPress: boolean;
  linkFromNotification?: string;
  author: string;
}

function TopBar({
  hasIcon = false,
  isTwitter = false,
  refToken = undefined,
  asRef = false,
  asMobileNotification = false,
  linkFromNotification,
  longPress = false,
  time,
  canEdit,
  author,
}: TopBarProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const nest = useNest();
  const {
    didCopy,
    menuOpen,
    setMenuOpen,
    onDelete,
    deleteStatus,
    onEdit,
    onCopy,
    navigateToCurio,
    toggleHidden,
    isHidden,
    reportContent,
  } = useCurioActions({
    nest,
    time,
    refToken: refToken ?? linkFromNotification,
  });

  if (asRef || asMobileNotification) {
    return null;
  }

  const actions: Action[] = asRef
    ? [
        {
          key: 'copy',
          content: didCopy ? 'Copied' : 'Share',
          onClick: onCopy,
          keepOpenOnClick: true,
        },
      ]
    : canEdit
    ? [
        {
          key: 'edit',
          content: 'Edit',
          onClick: onEdit,
        },
        {
          key: 'delete',
          type: 'destructive',
          content: 'Delete',
          onClick: () => setDeleteOpen(true),
        },
      ]
    : [];

  if (window.our !== author) {
    actions.push({
      key: 'hide',
      content: isHidden ? 'Show Post' : 'Hide Post for Me',
      onClick: toggleHidden,
    });

    actions.push({
      key: 'report',
      content: 'Report Post',
      onClick: reportContent,
    });
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn('absolute z-40 flex w-full select-none items-center px-4', {
        'justify-between': hasIcon || isTwitter,
        'justify-end': !hasIcon && !isTwitter,
        'hidden group-hover:flex': !longPress && !menuOpen,
      })}
    >
      {isTwitter ? <TwitterIcon className="m-2 h-6 w-6" /> : null}
      {hasIcon ? <div className="m-2 h-6 w-6" /> : null}
      <div
        className={cn('flex space-x-2 text-sm text-gray-600', {
          'mt-2': asRef,
          'mr-2': asRef,
        })}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div>
          {asRef ? (
            <button
              onClick={navigateToCurio}
              className="small-menu-button border border-gray-100 bg-white px-2 py-1"
            >
              View
            </button>
          ) : (
            <IconButton
              icon={
                didCopy ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )
              }
              action={onCopy}
              label="expand"
              className="rounded bg-white"
            />
          )}
        </div>
        <ActionMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          asChild={false}
          actions={actions}
        >
          {asRef ? (
            <IconButton
              icon={<ElipsisSmallIcon className="h-4 w-4" />}
              action={() => setMenuOpen(true)}
              label="expand"
              className="rounded border border-gray-100 bg-white"
              small
            />
          ) : (
            <IconButton
              icon={<ElipsisSmallIcon className="h-4 w-4" />}
              label="options"
              className="rounded bg-white"
              action={() => setMenuOpen(!menuOpen)}
            />
          )}
        </ActionMenu>
      </div>
      <ConfirmationModal
        open={deleteOpen}
        setOpen={setDeleteOpen}
        onConfirm={onDelete}
        closeOnClickOutside={true}
        loading={deleteStatus === 'loading'}
        succeeded={deleteStatus === 'success'}
        confirmText="Delete"
        title="Delete Gallery Item"
        message="Are you sure you want to delete this gallery item?"
      />
    </div>
  );
}

interface BottomBarProps {
  curio: HeapCurio;
  asRef?: boolean;
  asMobileNotification?: boolean;
}

function BottomBar({ curio, asRef, asMobileNotification }: BottomBarProps) {
  const { sent } = curio.heart;
  const replyCount = curio.seal.replied.length;
  const prettySent = formatDistanceToNow(sent);

  if (asRef || asMobileNotification) {
    return <div />;
  }

  return (
    <div
      className={cn(
        'absolute bottom-2 left-2 flex w-[calc(100%-16px)] select-none items-center space-x-2 overflow-hidden rounded p-2 group-hover:bg-white/50 group-hover:backdrop-blur'
      )}
    >
      <Avatar ship={curio?.heart.author} size="xs" />
      <div className="hidden w-full justify-between align-middle group-hover:flex">
        <span className="truncate font-semibold">{prettySent} ago</span>
        {replyCount > 0 ? (
          <div className="flex space-x-1 align-middle font-semibold">
            <ChatSmallIcon className="h-4 w-4" />
            <span>{replyCount}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HeapBlockWrapper({
  time,
  setLongPress,
  children,
  curio,
  linkFromNotification,
  isHidden,
}: React.PropsWithChildren<{
  time: string;
  setLongPress: (b: boolean) => void;
  curio: HeapCurio;
  linkFromNotification?: string;
  isHidden?: boolean;
}>) {
  const navigate = useNavigate();
  const { action, handlers } = useLongPress();
  const navigateToDetail = useCallback(
    (blockTime: string) => {
      if (isHidden) {
        return;
      }
      if (linkFromNotification) {
        navigate(linkFromNotification);
        return;
      }
      navigate(`curio/${blockTime}`, { state: { initialCurio: curio } });
    },
    [navigate, curio, linkFromNotification, isHidden]
  );

  useEffect(() => {
    if (action === 'click') {
      navigateToDetail(time);
    }

    if (action === 'longpress') {
      setLongPress(true);
    }
  }, [action, navigateToDetail, time, setLongPress]);

  return (
    <div className="h-full w-full" {...handlers}>
      {children}
    </div>
  );
}

interface HeapBlockProps extends CurioDisplayProps {
  curio: HeapCurio;
  isComment?: boolean;
  linkFromNotification?: string;
}

const hiddenPostContent: CurioContent = {
  block: [],
  inline: [
    {
      italics: ['You have hidden this post.'],
    },
  ],
};

export default function HeapBlock({
  curio,
  time,
  asRef = false,
  asMobileNotification = false,
  isComment = false,
  refToken = undefined,
  linkFromNotification,
}: HeapBlockProps) {
  const [longPress, setLongPress] = useState(false);
  const { isHidden } = useCurioToggler(time);
  const { content } = curio.heart;
  const url =
    content.inline.length > 0 && isLink(content.inline[0])
      ? content.inline[0].link.href
      : '';
  const {
    embed,
    isLoading: embedLoading,
    isError: embedErrored,
    error: embedError,
  } = useEmbed(url);
  const calm = useCalm();
  const { isImage, isAudio, isText } = useHeapContentType(url);
  const textFallbackTitle = content.inline
    .map((inline) => inlineToString(inline))
    .join(' ')
    .toString();

  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);
  const canEdit =
    asRef || asMobileNotification
      ? false
      : isAdmin || window.our === curio.heart.author;
  const maybeEmbed = !isImage && !isAudio && !isText && !isComment;

  useEffect(() => {
    if (embedErrored) {
      console.log("HeapBlock::getOembed: couldn't get embed", embedError);
    }
  }, [embedErrored, embedError]);

  if (
    isValidUrl(url) &&
    maybeEmbed &&
    embedLoading &&
    !calm.disableRemoteContent
  ) {
    return <HeapLoadingBlock />;
  }

  const cnm = (refClass?: string) =>
    asRef || asMobileNotification ? refClass || '' : 'heap-block group';
  const topBar = {
    time,
    asRef,
    asMobileNotification,
    linkFromNotification,
    refToken,
    longPress,
    author: curio.heart.author,
  };
  const botBar = { curio, asRef, asMobileNotification, longPress };

  if (isHidden) {
    return (
      <HeapBlockWrapper
        time={time}
        curio={curio}
        setLongPress={setLongPress}
        isHidden={isHidden}
      >
        <div className={cnm()}>
          <TopBar hasIcon canEdit={canEdit} {...topBar} />
          <HeapContent
            className={cn('mx-3 my-2 leading-6', asRef ? 'line-clamp-9' : '')}
            leading-6
            content={hiddenPostContent}
          />
          {!asRef && (
            <div className="from-10% via-30% absolute top-0 left-0 h-full w-full bg-gradient-to-t from-white via-transparent" />
          )}
          <BottomBar {...botBar} />
        </div>
      </HeapBlockWrapper>
    );
  }

  if (isComment) {
    return (
      <HeapBlockWrapper
        linkFromNotification={linkFromNotification}
        time={time}
        curio={curio}
        setLongPress={setLongPress}
      >
        <div className={cnm()}>
          <TopBar hasIcon canEdit={canEdit} {...topBar} />
          <div className="flex grow flex-col">
            <ChatContent
              story={{ block: content.block, inline: content.inline }}
            />
          </div>
          <BottomBar {...botBar} />
        </div>
      </HeapBlockWrapper>
    );
  }

  if (content.block.length > 0 && 'cite' in content.block[0]) {
    return (
      <HeapBlockWrapper
        linkFromNotification={linkFromNotification}
        time={time}
        curio={curio}
        setLongPress={setLongPress}
      >
        <div className={cnm()}>
          <TopBar hasIcon canEdit={canEdit} {...topBar} />
          <div className="flex grow flex-col items-center justify-center">
            <HeapContent
              className={cn('leading-6', asRef ? 'mx-3 my-2 line-clamp-9' : '')}
              content={content}
            />
          </div>
          <BottomBar {...botBar} />
        </div>
      </HeapBlockWrapper>
    );
  }

  if (isText) {
    return (
      <HeapBlockWrapper
        linkFromNotification={linkFromNotification}
        time={time}
        curio={curio}
        setLongPress={setLongPress}
      >
        <div className={cnm()}>
          <TopBar hasIcon canEdit={canEdit} {...topBar} />
          <HeapContent
            className={cn('mx-3 my-2 leading-6', asRef ? 'line-clamp-9' : '')}
            leading-6
            content={content}
          />
          {!asRef && (
            <div className="from-10% via-30% absolute top-0 left-0 h-full w-full bg-gradient-to-t from-white via-transparent" />
          )}
          <BottomBar {...botBar} />
        </div>
      </HeapBlockWrapper>
    );
  }

  if (isImage && !calm?.disableRemoteContent) {
    return (
      <HeapBlockWrapper
        linkFromNotification={linkFromNotification}
        time={time}
        curio={curio}
        setLongPress={setLongPress}
      >
        <div
          className={cnm(
            'h-full w-full bg-gray-50 bg-contain bg-center bg-no-repeat'
          )}
          style={{
            backgroundImage: `url(${url})`,
            borderRadius: asMobileNotification ? '6px' : undefined,
          }}
        >
          <TopBar canEdit={canEdit} {...topBar} />
          <BottomBar {...botBar} />
        </div>
      </HeapBlockWrapper>
    );
  }

  if (isAudio && !calm?.disableRemoteContent) {
    return (
      <HeapBlockWrapper
        linkFromNotification={linkFromNotification}
        time={time}
        curio={curio}
        setLongPress={setLongPress}
      >
        <div className={cnm()}>
          <TopBar hasIcon canEdit={canEdit} {...topBar} />
          <div className="flex grow flex-col items-center justify-center">
            <MusicLargeIcon className="h-16 w-16 text-gray-300" />
          </div>
          <BottomBar {...botBar} />
        </div>
      </HeapBlockWrapper>
    );
  }

  const isOembed = validOembedCheck(embed, url);

  if (isOembed && !calm?.disableRemoteContent) {
    const { thumbnail_url: thumbnail, provider_name: provider } = embed;

    if (thumbnail) {
      return (
        <HeapBlockWrapper
          linkFromNotification={linkFromNotification}
          time={time}
          curio={curio}
          setLongPress={setLongPress}
        >
          <div
            className={cnm('h-full w-full bg-cover bg-center bg-no-repeat')}
            style={{
              backgroundImage: `url(${thumbnail})`,
            }}
          >
            <TopBar canEdit={canEdit} {...topBar} />
            <BottomBar {...botBar} />
          </div>
        </HeapBlockWrapper>
      );
    }
    if (provider === 'Twitter') {
      const author = embed.author_name;
      const twitterHandle = embed.author_url.split('/').pop();
      const twitterProfilePic = `https://unavatar.io/twitter/${twitterHandle}`;
      return (
        <HeapBlockWrapper
          linkFromNotification={linkFromNotification}
          time={time}
          curio={curio}
          setLongPress={setLongPress}
        >
          <div className={cnm()}>
            <TopBar isTwitter canEdit={canEdit} {...topBar} />
            <div className="flex grow flex-col items-center justify-center space-y-2">
              <img
                className="h-[46px] w-[46px] rounded-full"
                src={twitterProfilePic}
                alt={author}
              />
              <span className="font-semibold text-black">{author}</span>
              <span className="text-gray-300">@{twitterHandle}</span>
            </div>
            <BottomBar {...botBar} />
          </div>
        </HeapBlockWrapper>
      );
    }
    return (
      <HeapBlockWrapper
        linkFromNotification={linkFromNotification}
        time={time}
        curio={curio}
        setLongPress={setLongPress}
      >
        <div className={cnm()}>
          <TopBar hasIcon canEdit={canEdit} {...topBar} />
          <div className="flex grow flex-col items-center justify-center">
            <LinkIcon className="h-16 w-16 text-gray-300" />
          </div>
          <BottomBar {...botBar} />
        </div>
      </HeapBlockWrapper>
    );
  }

  return (
    <HeapBlockWrapper
      linkFromNotification={linkFromNotification}
      time={time}
      curio={curio}
      setLongPress={setLongPress}
    >
      <div className={cnm()}>
        <TopBar hasIcon canEdit={canEdit} {...topBar} />
        <div className="flex grow flex-col items-center justify-center">
          <LinkIcon className="h-16 w-16 text-gray-300" />
          <div className="text-underline m-3 block break-all rounded bg-gray-50 p-2 text-center font-semibold">
            {url}
          </div>
        </div>
        <BottomBar {...botBar} />
      </div>
    </HeapBlockWrapper>
  );
}
