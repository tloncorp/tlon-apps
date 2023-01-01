import _ from 'lodash';
import React, { useEffect, useState } from 'react';
import { HeapCurio, isLink } from '@/types/heap';
import cn from 'classnames';
import { isValidUrl, validOembedCheck } from '@/logic/utils';
import { useCalm } from '@/state/settings';
import useEmbedState from '@/state/embed';
import { useRouteGroup, useAmAdmin } from '@/state/groups/groups';
// eslint-disable-next-line import/no-cycle
import HeapContent from '@/heap/HeapContent';
import TwitterIcon from '@/components/icons/TwitterIcon';
import { formatDistanceToNow } from 'date-fns';
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
import useCurioActions from './useCurioActions';

interface CurioDisplayProps {
  time: string;
  asRef?: boolean;
  refToken?: string;
}

interface TopBarProps extends CurioDisplayProps {
  isTwitter?: boolean;
  hasIcon?: boolean;
  canEdit: boolean;
}

function TopBar({
  hasIcon = false,
  isTwitter = false,
  refToken = undefined,
  asRef = false,
  time,
  canEdit,
}: TopBarProps) {
  const nest = useNest();
  const {
    didCopy,
    menuOpen,
    setMenuOpen,
    onDelete,
    onEdit,
    onCopy,
    navigateToCurio,
  } = useCurioActions({ nest, time, refToken });

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={
        hasIcon || isTwitter
          ? 'absolute hidden w-full items-center justify-between px-4 group-hover:flex'
          : 'absolute hidden w-full items-center justify-end px-4 group-hover:flex'
      }
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
        <div className="hidden group-hover:block">
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
        {canEdit && (
          <div className="relative hidden group-hover:block">
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
            <div
              className={cn(
                'absolute right-0 flex w-[101px] flex-col items-start rounded bg-white text-sm font-semibold text-gray-800 shadow',
                { hidden: !menuOpen }
              )}
              onMouseLeave={() => setMenuOpen(false)}
            >
              {asRef ? (
                <button
                  className="small-menu-button"
                  onClick={onCopy}
                  disabled={didCopy}
                >
                  {didCopy ? 'Copied' : 'Share'}
                </button>
              ) : null}
              {!asRef && canEdit ? (
                <>
                  <button onClick={onEdit} className="small-menu-button">
                    Edit
                  </button>
                  <button
                    className="small-menu-button text-red"
                    onClick={onDelete}
                  >
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface BottomBarProps {
  curio: HeapCurio;
  provider: string;
  title?: string;
  asRef?: boolean;
}

function BottomBar({ curio, provider, title, asRef }: BottomBarProps) {
  const { content, sent } = curio.heart;
  const replyCount = curio.seal.replied.length;
  const url =
    content.inline.length > 0 && isLink(content.inline[0])
      ? content.inline[0].link.href
      : '';
  const prettySent = formatDistanceToNow(sent);

  if (asRef) {
    return <div />;
  }

  return (
    <div className="absolute bottom-0 -mx-2 h-[50px] w-full">
      <div className="hidden h-[50px] w-full border-t-2 border-gray-100 bg-white p-2 group-hover:block">
        <div className="flex flex-col">
          <span className="truncate font-semibold text-gray-800">
            {title ? title : url}
          </span>
          <div className="items center flex justify-between">
            <div className="flex items-center space-x-1 text-sm font-semibold">
              <span className="text-gray-600">{provider}</span>
              <span className="text-lg text-gray-200"> • </span>
              <span className="text-gray-400">{prettySent} ago</span>
            </div>
            <div className="flex items-center space-x-1 text-sm font-semibold text-gray-400">
              <span>{replyCount > 0 && replyCount}</span>
              <ChatSmallIcon className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HeapBlockProps extends CurioDisplayProps {
  curio: HeapCurio;
}

export default function HeapBlock({
  curio,
  time,
  asRef = false,
  refToken = undefined,
}: HeapBlockProps) {
  const [embed, setEmbed] = useState<any>();
  const { content } = curio.heart;
  const url =
    content.inline.length > 0 && isLink(content.inline[0])
      ? content.inline[0].link.href
      : '';
  const calm = useCalm();
  const { isImage, isAudio, isText } = useHeapContentType(url);
  const textFallbackTitle = content.inline
    .map((inline) => inlineToString(inline))
    .join(' ')
    .toString();

  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);
  const canEdit = isAdmin || window.our === curio.heart.author;

  useEffect(() => {
    const getOembed = async () => {
      if (isValidUrl(url)) {
        const oembed = await useEmbedState.getState().getEmbed(url);
        setEmbed(oembed);
      }
    };
    getOembed();
  }, [url]);

  if (isValidUrl(url) && embed === undefined) {
    return <HeapLoadingBlock />;
  }

  const cnm = (refClass?: string) =>
    asRef ? refClass || '' : 'heap-block group';
  const topBar = { time, refToken };
  const botBar = { curio, asRef };

  if (content.block.length > 0 && 'cite' in content.block[0]) {
    return (
      <div className={cnm()}>
        <TopBar hasIcon canEdit={canEdit} {...topBar} />
        <div className="flex grow flex-col items-center justify-center">
          <HeapContent
            className={cn('leading-6', asRef ? 'mx-3 my-2 line-clamp-9' : '')}
            content={content}
          />
        </div>
        <BottomBar
          {...botBar}
          provider="Urbit Reference"
          title={curio.heart.title || 'Urbit Reference'}
        />
      </div>
    );
  }

  if (isText) {
    return (
      <div className={cnm()}>
        <TopBar hasIcon canEdit={canEdit} {...topBar} />
        <HeapContent
          className={cn('leading-6', asRef ? 'mx-3 my-2 line-clamp-9' : '')}
          leading-6
          content={content}
        />
        <BottomBar
          {...botBar}
          provider="Text"
          title={
            curio.heart.title || _.truncate(textFallbackTitle, { length: 20 })
          }
        />
      </div>
    );
  }

  if (isImage && !calm?.disableRemoteContent) {
    return (
      <div
        className={cnm(
          'h-full w-full bg-gray-50 bg-contain bg-center bg-no-repeat'
        )}
        style={{
          backgroundImage: `url(${url})`,
        }}
      >
        <TopBar canEdit {...topBar} />
        <BottomBar
          {...botBar}
          provider="Image"
          title={curio.heart.title || url}
        />
      </div>
    );
  }

  if (isAudio && !calm?.disableRemoteContent) {
    return (
      <div className={cnm()}>
        <TopBar hasIcon canEdit {...topBar} />
        <div className="flex grow flex-col items-center justify-center">
          <MusicLargeIcon className="h-16 w-16 text-gray-300" />
        </div>
        <BottomBar
          {...botBar}
          provider="Audio"
          title={curio.heart.title || url}
        />
      </div>
    );
  }

  const isOembed = validOembedCheck(embed, url);

  if (isOembed && !calm?.disableRemoteContent) {
    const { title, thumbnail_url: thumbnail, provider_name: provider } = embed;

    if (thumbnail) {
      return (
        <div
          className={cnm('h-full w-full bg-cover bg-center bg-no-repeat')}
          style={{
            backgroundImage: `url(${thumbnail})`,
          }}
        >
          <TopBar canEdit={canEdit} {...topBar} />
          <BottomBar {...botBar} provider={provider} title={title || url} />
        </div>
      );
    }
    if (provider === 'Twitter') {
      const author = embed.author_name;
      const twitterHandle = embed.author_url.split('/').pop();
      const twitterProfilePic = `https://unavatar.io/twitter/${twitterHandle}`;
      return (
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
          <BottomBar
            {...botBar}
            provider={provider}
            title={twitterHandle || url}
          />
        </div>
      );
    }
    return (
      <div className={cnm()}>
        <TopBar hasIcon canEdit={canEdit} {...topBar} />
        <div className="flex grow flex-col items-center justify-center">
          <LinkIcon className="h-16 w-16 text-gray-300" />
        </div>
        <BottomBar
          {...botBar}
          provider={provider ? provider : 'Link'}
          title={title || url}
        />
      </div>
    );
  }

  return (
    <div className={cnm()}>
      <TopBar hasIcon canEdit={canEdit} {...topBar} />
      <div className="flex grow flex-col items-center justify-center">
        <LinkIcon className="h-16 w-16 text-gray-300" />
      </div>
      <BottomBar {...botBar} provider="Link" title={url || undefined} />
    </div>
  );
}
