import {
  Post,
  Story,
  VerseBlock,
  imageUrlFromContent,
} from '@tloncorp/shared/dist/urbit/channel';
import { daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import cn from 'classnames';
import { formatDistanceToNow } from 'date-fns';
import _ from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import Avatar from '@/components/Avatar';
import ConfirmationModal from '@/components/ConfirmationModal';
import IconButton from '@/components/IconButton';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ContentReference from '@/components/References/ContentReference';
import ShipName from '@/components/ShipName';
import CheckIcon from '@/components/icons/CheckIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import ElipsisSmallIcon from '@/components/icons/EllipsisSmallIcon';
import LinkIcon from '@/components/icons/LinkIcon';
import MusicLargeIcon from '@/components/icons/MusicLargeIcon';
import TextIcon from '@/components/icons/Text16Icon';
import TwitterIcon from '@/components/icons/TwitterIcon';
import HeapContent from '@/heap/HeapContent';
import { linkUrlFromContent, useChannelFlag } from '@/logic/channel';
import { firstInlineSummary } from '@/logic/tiptap';
import getHeapContentType from '@/logic/useHeapContentType';
import { isValidUrl, validOembedCheck } from '@/logic/utils';
import { useIsPostUndelivered, usePostToggler } from '@/state/channel/channel';
import { useEmbed } from '@/state/embed';
import {
  useAmAdmin,
  useFlaggedData,
  useRouteGroup,
} from '@/state/groups/groups';
import { useCalm } from '@/state/settings';

import useCurioActions from './useCurioActions';

interface CurioDisplayProps {
  time: string;
  asRef?: boolean;
  refToken?: string;
}

interface TopBarProps extends CurioDisplayProps {
  isTwitter?: boolean;
  hasIcon?: boolean;
  isUndelivered?: boolean;
  canEdit: boolean;
  longPress: boolean;
  author: string;
}

function Actions({
  hasIcon = false,
  isTwitter = false,
  refToken = undefined,
  asRef = false,
  longPress = false,
  isUndelivered = false,
  time,
  canEdit,
  author,
}: TopBarProps) {
  const groupFlag = useRouteGroup();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const chFlag = useChannelFlag();
  const nest = `heap/${chFlag}`;
  const {
    didCopy,
    menuOpen,
    setMenuOpen,
    onDelete,
    isDeleteLoading,
    onEdit,
    onCopy,
    navigateToCurio,
    toggleHidden,
    isHidden,
    reportContent,
  } = useCurioActions({ nest, time, refToken });
  const { isFlaggedByMe } = useFlaggedData(groupFlag, nest, time);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn('', {
        'justify-between': hasIcon || isTwitter,
        'justify-end': !hasIcon && !isTwitter,
        flex: longPress,
        'group-hover:flex': !longPress,
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
        <div className={longPress ? 'block' : 'group-hover:block'}>
          {asRef && (
            <button
              onClick={navigateToCurio}
              className="small-menu-button border border-gray-100 bg-white px-2 py-1"
            >
              View
            </button>
          )}
          {!asRef && !isUndelivered && (
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
        {!isUndelivered && (
          <div
            className={longPress ? 'relative' : 'relative group-hover:block'}
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
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete
                  </button>
                </>
              ) : null}
              {!asRef && author !== window.our ? (
                <>
                  <button onClick={toggleHidden} className="small-menu-button">
                    {isHidden ? 'Show Post' : 'Hide Post for Me'}
                  </button>
                  <button
                    onClick={reportContent}
                    className={cn(
                      'small-menu-button',
                      isFlaggedByMe
                        ? 'text-gray-200'
                        : 'text-red hover:bg-red-50 dark:hover:bg-red-900'
                    )}
                    disabled={isFlaggedByMe}
                  >
                    {isFlaggedByMe ? "You've flagged this post" : 'Report Post'}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
      <ConfirmationModal
        open={deleteOpen}
        setOpen={setDeleteOpen}
        onConfirm={onDelete}
        loading={isDeleteLoading}
        confirmText="Delete"
        title="Delete Gallery Item"
        message="Are you sure you want to delete this gallery item?"
      />
    </div>
  );
}

const hiddenPostContent: Story = [
  {
    inline: [
      {
        italics: ['You have hidden this post.'],
      },
    ],
  },
];

interface HeapRowProps extends CurioDisplayProps {
  post: Post;
  isComment?: boolean;
}

export default function HeapRow({
  post,
  time,
  asRef = false,
  isComment = false,
  refToken = undefined,
}: HeapRowProps) {
  const { content } = post?.essay || { content: [] };
  const navigate = useNavigate();
  const { isHidden } = usePostToggler(time);
  const url = linkUrlFromContent(content) || imageUrlFromContent(content) || '';
  const { embed, isLoading, isError, error } = useEmbed(url);
  const calm = useCalm();
  const { isImage, isAudio, isText } = getHeapContentType(url);
  const textFallbackTitle = firstInlineSummary(content);

  const navigateToDetail = useCallback(() => {
    if (isHidden) {
      return;
    }

    navigate(`curio/${bigInt(time)}`, { state: { initialCurio: post } });
  }, [navigate, post, isHidden, time]);

  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);
  const canEdit = asRef ? false : isAdmin || window.our === post?.essay.author;
  const maybeEmbed = !isImage && !isAudio && !isText && !isComment;
  const isUndelivered = useIsPostUndelivered(post);

  useEffect(() => {
    if (isError) {
      console.log('HeapRow: could not load oembed', error);
    }
  }, [isError, error]);

  if (
    isValidUrl(url) &&
    embed === undefined &&
    maybeEmbed &&
    isLoading &&
    !calm.disableRemoteContent
  ) {
    return (
      <div
        className={
          'group flex h-[88px] w-full items-center justify-center space-x-2 rounded-lg bg-gray-50 p-2'
        }
      >
        <LoadingSpinner />
      </div>
    );
  }

  if (!post) {
    return (
      <div
        className={
          'group flex h-[88px] w-full items-center justify-center space-x-2 rounded-lg bg-gray-50 p-2'
        }
      >
        <LoadingSpinner />
      </div>
    );
  }

  const cnm = (refClass?: string) =>
    asRef
      ? refClass || ''
      : 'w-full bg-white rounded-lg p-2 flex space-x-2 items-center group';
  const { id } = post.seal;
  const { replyCount } = post.seal.meta;
  const prettySent = formatDistanceToNow(daToUnix(bigInt(id)));
  const blockContent = content.filter((c) => 'block' in c)[0] as VerseBlock;

  if (isHidden) {
    return (
      <div className={cnm()}>
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded bg-gray-100">
          <TextIcon className="h-6 w-6 text-gray-400" />
        </div>
        <div className="flex grow flex-col">
          <div className="line-clamp-1 text-lg font-semibold">
            <HeapContent
              className={cn('line-clamp-1')}
              content={hiddenPostContent}
            />
          </div>
          <div className="mt-1 line-clamp-1 flex space-x-2 text-base font-semibold text-gray-400">
            <span>Text</span>
          </div>
          <div className="mt-3 flex space-x-2 text-base font-semibold text-gray-800">
            <Avatar
              size="xxs"
              className="inline-block"
              ship={post.essay.author}
            />
            <ShipName
              showAlias={!calm.disableNicknames}
              name={post.essay.author}
            />
            <span className="hidden text-gray-400 sm:inline">
              {prettySent} ago
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <Actions
            longPress={false}
            canEdit={canEdit}
            time={time}
            author={post.essay.author}
            isUndelivered={isUndelivered}
          />
        </div>
      </div>
    );
  }

  if (blockContent && 'cite' in blockContent.block) {
    return (
      <div onClick={navigateToDetail} className={cnm()}>
        <ContentReference contextApp="heap-row" cite={blockContent.block.cite}>
          <div className="mt-3 flex space-x-2 text-base font-semibold text-gray-800">
            <Avatar
              size="xxs"
              className="inline-block"
              ship={post.essay.author}
            />
            <ShipName
              showAlias={!calm.disableNicknames}
              name={post.essay.author}
            />
            <span className="hidden text-gray-400 sm:inline">
              {prettySent} ago
            </span>
          </div>
        </ContentReference>
        <div className="shrink-0">
          <Actions
            longPress={false}
            canEdit={canEdit}
            time={post.seal.id}
            author={post.essay.author}
            isUndelivered={isUndelivered}
          />
        </div>
      </div>
    );
  }

  if (isText) {
    return (
      <div onClick={navigateToDetail} className={cnm()}>
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded bg-gray-100">
          <TextIcon className="h-6 w-6 text-gray-400" />
        </div>
        <div className="flex grow flex-col">
          <div className="line-clamp-1 text-lg font-semibold">
            <HeapContent className={cn('line-clamp-1')} content={content} />
          </div>
          <div className="mt-1 line-clamp-1 flex space-x-2 text-base font-semibold text-gray-400">
            <span>Text</span>
            <span>{replyCount} comments</span>
          </div>
          <div className="mt-3 flex space-x-2 text-base font-semibold text-gray-800">
            <Avatar
              size="xxs"
              className="inline-block"
              ship={post.essay.author}
            />
            <ShipName
              showAlias={!calm.disableNicknames}
              name={post.essay.author}
            />
            <span className="hidden text-gray-400 sm:inline">
              {prettySent} ago
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <Actions
            longPress={false}
            canEdit={canEdit}
            time={post.seal.id}
            author={post.essay.author}
            isUndelivered={isUndelivered}
          />
        </div>
      </div>
    );
  }

  if (isImage) {
    return (
      <div onClick={navigateToDetail} className={cnm()}>
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded bg-gray-100">
          {!calm?.disableRemoteContent ? (
            <img
              className="h-[72px] w-[72px] rounded object-cover"
              loading="lazy"
              src={url}
              alt={textFallbackTitle}
            />
          ) : (
            <LinkIcon className="h-6 w-6 text-gray-400" />
          )}
        </div>
        <div className="flex grow flex-col">
          <div className="line-clamp-1 break-all text-lg font-semibold">
            {textFallbackTitle}
          </div>
          <div className="mt-1 line-clamp-1 flex space-x-2 text-base font-semibold text-gray-400">
            <span>Image</span>
            <a href={url} target="_blank" rel="noreferrer">
              Source
            </a>
            <span>{replyCount} comments</span>
          </div>
          <div className="mt-3 flex space-x-2 text-base font-semibold text-gray-800">
            <Avatar
              size="xxs"
              className="inline-block"
              ship={post.essay.author}
            />
            <ShipName
              showAlias={!calm.disableNicknames}
              name={post.essay.author}
            />
            <span className="hidden text-gray-400 sm:inline">
              {prettySent} ago
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <Actions
            longPress={false}
            canEdit={canEdit}
            time={post.seal.id}
            author={post.essay.author}
            isUndelivered={isUndelivered}
          />
        </div>
      </div>
    );
  }

  if (isAudio && !calm?.disableRemoteContent) {
    return (
      <div onClick={navigateToDetail} className={cnm()}>
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded bg-gray-100">
          <MusicLargeIcon className="h-6 w-6 text-gray-400" />
        </div>
        <div className="flex grow flex-col">
          <div className="line-clamp-1 break-all text-lg font-semibold">
            {textFallbackTitle}
          </div>
          <div className="mt-1 line-clamp-1 flex space-x-2 text-base font-semibold text-gray-400">
            <span>Audio</span>
            <a href={url} target="_blank" rel="noreferrer">
              Source
            </a>
            <span>{replyCount} comments</span>
          </div>
          <div className="mt-3 flex space-x-2 text-base font-semibold text-gray-800">
            <Avatar
              size="xxs"
              className="inline-block"
              ship={post.essay.author}
            />
            <ShipName
              showAlias={!calm.disableNicknames}
              name={post.essay.author}
            />
            <span className="hidden text-gray-400 sm:inline">
              {prettySent} ago
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <Actions
            longPress={false}
            canEdit={canEdit}
            time={post.seal.id}
            author={post.essay.author}
            isUndelivered={isUndelivered}
          />
        </div>
      </div>
    );
  }

  const isOembed = validOembedCheck(embed, url);

  if (isOembed && !calm?.disableRemoteContent) {
    const { thumbnail_url: thumbnail, provider_name: provider, title } = embed;

    if (provider === 'Twitter') {
      const twitterHandle = embed.author_url.split('/').pop();
      const twitterProfilePic = `https://unavatar.io/twitter/${twitterHandle}`;

      return (
        <div onClick={navigateToDetail} className={cnm()}>
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded bg-gray-100">
            <img
              className="h-[72px] w-[72px] rounded object-cover"
              src={twitterProfilePic}
              alt={twitterHandle}
            />
          </div>
          <div className="flex grow flex-col">
            <div className="line-clamp-1 break-all text-lg font-semibold">
              Tweet by @{twitterHandle}
            </div>
            <div className="mt-1 line-clamp-1 flex space-x-2 text-base font-semibold text-gray-400">
              <span>Tweet</span>
              <a href={url} target="_blank" rel="noreferrer">
                Source
              </a>
              <span>{replyCount} comments</span>
            </div>
            <div className="mt-3 flex space-x-2 text-base font-semibold text-gray-800">
              <Avatar
                size="xxs"
                className="inline-block"
                ship={post.essay.author}
              />
              <ShipName
                showAlias={!calm.disableNicknames}
                name={post.essay.author}
              />
              <span className="hidden text-gray-400 sm:inline">
                {prettySent} ago
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <Actions
              longPress={false}
              canEdit={canEdit}
              time={post.seal.id}
              author={post.essay.author}
              isUndelivered={isUndelivered}
            />
          </div>
        </div>
      );
    }

    return (
      <div onClick={navigateToDetail} className={cnm()}>
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded bg-gray-100">
          {thumbnail && !calm?.disableRemoteContent ? (
            <img
              className="h-[72px] w-[72px] rounded object-cover"
              loading="lazy"
              src={thumbnail}
              alt={textFallbackTitle}
            />
          ) : (
            <LinkIcon className="h-6 w-6 text-gray-400" />
          )}
        </div>
        <div className="flex grow flex-col">
          <div className="line-clamp-1 break-all text-lg font-semibold">
            {title && !calm.disableRemoteContent ? title : textFallbackTitle}
          </div>
          <div className="mt-1 line-clamp-1 flex space-x-2 text-base font-semibold text-gray-400">
            <span>Link</span>
            <a href={url} target="_blank" rel="noreferrer">
              Source
            </a>
            <span>{replyCount} comments</span>
          </div>
          <div className="mt-3 flex space-x-2 text-base font-semibold text-gray-800">
            <Avatar
              size="xxs"
              className="inline-block"
              ship={post.essay.author}
            />
            <ShipName
              showAlias={!calm.disableNicknames}
              name={post.essay.author}
            />
            <span className="hidden text-gray-400 sm:inline">
              {prettySent} ago
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <Actions
            longPress={false}
            canEdit={canEdit}
            time={post.seal.id}
            author={post.essay.author}
            isUndelivered={isUndelivered}
          />
        </div>
      </div>
    );
  }

  return (
    <div onClick={navigateToDetail} className={cnm()}>
      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded bg-gray-100">
        <LinkIcon className="h-6 w-6 text-gray-400" />
      </div>
      <div className="flex grow flex-col">
        <div className="line-clamp-1 break-all text-lg font-semibold">
          {textFallbackTitle}
        </div>
        <div className="mt-1 line-clamp-1 flex space-x-2 text-base font-semibold text-gray-400">
          <span>Link</span>
          <a href={url} target="_blank" rel="noreferrer">
            Source
          </a>
          <span>{replyCount} comments</span>
        </div>
        <div className="mt-3 flex space-x-2 text-base font-semibold text-gray-800">
          <Avatar
            size="xxs"
            className="inline-block"
            ship={post.essay.author}
          />
          <ShipName
            showAlias={!calm.disableNicknames}
            name={post.essay.author}
          />
          <span className="hidden text-gray-400 sm:inline">
            {prettySent} ago
          </span>
        </div>
      </div>
      <div className="shrink-0">
        <Actions
          longPress={false}
          canEdit={canEdit}
          time={post.seal.id}
          author={post.essay.author}
          isUndelivered={isUndelivered}
        />
      </div>
    </div>
  );
}
