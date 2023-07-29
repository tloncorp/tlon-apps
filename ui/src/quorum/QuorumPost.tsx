import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import _ from 'lodash';
import cn from 'classnames';
import { format } from 'date-fns';
import {
  CheckIcon,
  ChatBubbleIcon,
  ThickArrowUpIcon,
  ClockIcon,
  CounterClockwiseClockIcon,
  PlayIcon,
  TrashIcon,
  LayersIcon,
  Pencil1Icon,
  CopyIcon,
  ChevronRightIcon,
  DoubleArrowRightIcon,
} from '@radix-ui/react-icons';
import { stringToTa } from "@urbit/api";
import QuorumAuthor from '@/quorum/QuorumAuthor';
import QuorumPostAuthor from '@/quorum/QuorumPostAuthor';
import Avatar from '@/components/Avatar';
import GroupAvatar from '@/groups/GroupAvatar';
import MarkdownBlock from '@/components/MarkdownBlock';
import VoteIcon from '@/components/icons/VoteIcon';
import BestIcon from '@/components/icons/BestIcon';
import { AnchorLink } from '@/components/Links';
import { useGroups } from '@/state/groups';
import {
  useBoardFlag,
  useBoardMetas,
  useEditThreadMutation,
  useVoteMutation,
} from '@/state/quorum';
import { useModalNavigate, useAnchorNavigate } from '@/logic/routing';
import { useCopy } from '@/logic/utils';
import { useIsMobile } from '@/logic/useMedia';
import {
  encodeQuery,
  makeTerseLapse,
  makePrettyLapse,
  calcScoreStr,
  getSnapshotAt,
  getOriginalEdit,
  getLatestEdit,
} from '@/logic/quorum-utils';
import { BoardPost, PostEdit } from '@/types/quorum';
import { CHANNEL_PATH } from '@/constants';


export function QuorumPostCard({
  post,
}: {
  post: BoardPost;
}) {
  const boardFlag = useBoardFlag();
  const boardMetas = useBoardMetas();
  const groups = useGroups();

  const navigate = useNavigate();

  const postBoardMeta = (boardFlag !== "" || boardMetas === undefined)
    ? undefined
    : boardMetas.find(({board, group}) => (
        board === post.board && group === post.group
      ));
  const postGroup = (postBoardMeta === undefined)
    ? {meta: undefined}
    : groups?.[postBoardMeta.group];

  return (
    <div className="my-6 px-6">
      <div
        role="link"
        className="card cursor-pointer bg-gray-100 dark:bg-gray-200"
        onClick={() => navigate(getPostLink(post))}
      >
        <header className="space-y-8">
          {post?.thread && (
            <React.Fragment>
              <h1 className="break-words text-3xl font-semibold leading-10">
                {post.thread?.title}
              </h1>
              <p className="font-semibold text-gray-400">
                <span className="flex items-center">
                  <span>{format(getOriginalEdit(post).timestamp, 'LLLL do, yyyy')}</span>
                  <PostTags
                    post={post}
                    className="ml-auto justify-end"
                  />
                </span>
              </p>
            </React.Fragment>
          )}

          <MarkdownBlock
            content={getLatestEdit(post).content}
            archetype="desc"
            className="line-clamp-5"
          />

          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div
              className="flex items-center space-x-2 font-semibold"
              onClick={(e) => e.stopPropagation()}
            >
              <QuorumPostAuthor post={post} />
            </div>

            {postBoardMeta && (
              <Link
                to={`/channel/${post.group}/${post.board}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center space-x-2"
              >
                <GroupAvatar
                  {...(postGroup?.meta || {})}
                  size="h-6 w-6"
                  className="opacity-60 mr-2"
                />
                <div className="text-gray-600">
                  {postBoardMeta.title}
                </div>
              </Link>
            )}

            <div className="flex items-center space-x-2 text-gray-600">
              {(post?.thread && post.thread?.["best-id"] !== 0) &&
                <BestIcon className="h-5 w-5" />
              }
              <div className="flex items-center space-x-2" title="Vote Score">
                <ThickArrowUpIcon className="h-5 w-5" />
                {calcScoreStr(post)}
              </div>
              <div className="flex items-center space-x-2" title="Comment Count">
                <ChatBubbleIcon className="h-5 w-5" />
                &nbsp;{post?.thread ? post.thread?.replies.length : post.comments.length}
              </div>
              <div className="flex items-center space-x-2" title="Latest Activity">
                <CounterClockwiseClockIcon className="h-5 w-5" />
                &nbsp;{makeTerseLapse(new Date(getLatestEdit(post).timestamp))}
              </div>
            </div>
          </div>
        </header>
      </div>
    </div>
  );
}

export function QuorumPostStrand({
  post,
  parent,
  editable = false,
}: {
  post: BoardPost;
  parent?: BoardPost;
  editable?: boolean;
}) {
  // TODO: Should notify the user in some way if any of the mutations fail.
  // TODO: Change the background of the strand if:
  // - it's displaying a version older than the latest
  // - the post belongs to the user (use a light blue instead of white?)
  const [editId, setEditId] = useState<number>(0);
  const {didCopy, doCopy} = useCopy(getPostLink(post));

  const params = useParams();
  const modalNavigate = useModalNavigate();
  const navigate = useNavigate();
  const location = useLocation();
  const {mutate: voteMutation, status: voteStatus} = useVoteMutation();
  const {mutate: editMutation, status: editStatus} = useEditThreadMutation();
  // FIXME: For a nicer mobile version, put the 'isThread' voting modal below
  // the post content and above the author content, and make it
  // 'flex-row justify-between' instead of 'flex-col'
  // const isMobile = false; // useIsMobile();
  const isLoading = (voteStatus === "loading" || editStatus === "loading");

  const editPost: BoardPost = getSnapshotAt(post, editId);
  const totalEdits: number = Object.keys(post.history).length;
  const postAuthor: string = getOriginalEdit(post).author;
  const parentAuthor: string | undefined = parent && getOriginalEdit(parent).author;

  const isQuestion: boolean = post?.thread ? true : false;
  const isThread: boolean = parent ? true : false;
  const canModify: boolean = editable && [postAuthor, params?.chShip].includes(window.our);
  const ourVote: string | undefined = post.votes[window.our];
  // TODO: After testing, the author of a post shouldn't be allowed
  // to vote on it.
  const canVote: boolean = editable; // && postAuthor !== window.our;
  const isBest: boolean = post["post-id"] === parent?.thread?.["best-id"];
  const canBest: boolean = editable && [parentAuthor, params?.chShip].includes(window.our);

  return (
    <div id={`post-${post["post-id"]}`} className={cn(
      "flex flex-row w-full justify-center",
      "border-gray-50 border-solid border-b-2",
      isQuestion ? "pb-6" : "py-6",
      isLoading && "hover:cursor-wait",
    )}>
      {isThread && (
        <div className="flex flex-col items-center py-2 px-1 sm:px-4 text-sm sm:text-base gap-y-4 text-gray-800">
          <div className="flex flex-col items-center">
            <VoteIcon
              onClick={() => !isLoading && canVote && voteMutation({
                flag: post["board"],
                update: {
                  "post-id": post["post-id"],
                  "dir": "up",
                }
              })}
              className={cn(
                "w-6 h-6",
                ourVote === "up" ? "fill-orange" : "fill-none",
                !canVote && "text-gray-200",
                !isLoading && (canVote ? "hover:cursor-pointer" : "hover:cursor-not-allowed"),
              )}
            />
            {calcScoreStr(post)}
            <VoteIcon
              onClick={() => !isLoading && canVote && voteMutation({
                flag: post["board"],
                update: {
                  "post-id": post["post-id"],
                  "dir": "down",
                }
              })}
              className={cn(
                "w-6 h-6",
                ourVote === "down" ? "fill-blue" : "fill-none",
                !canVote && "text-gray-200",
                !isLoading && (canVote ? "hover:cursor-pointer" : "hover:cursor-not-allowed"),
              )}
              style={{transform: "rotateX(180deg)"}}
            />
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger aria-label="TODO">
              <div className={cn(
                "flex flex-col items-center hover:cursor-pointer",
                // (editId !== 0) && "text-gray-400",
              )}>
                <CounterClockwiseClockIcon className="w-6 h-6" />
                <p>v{totalEdits - editId}/{totalEdits}</p>
                <p>{makeTerseLapse(new Date(getLatestEdit(editPost).timestamp))}</p>
              </div>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content className="dropdown" side="right"> {/*w-56*/}
              <DropdownMenu.Item
                disabled
                className="dropdown-item flex cursor-default items-center space-x-2 text-gray-300 hover:bg-transparent"
              >
                Version
              </DropdownMenu.Item>
              {post.history.map(({author, timestamp}, index) => (
                <DropdownMenu.Item
                  key={`${author}-${timestamp}`}
                  onSelect={() => setEditId(index)}
                  className="dropdown-item flex items-center space-x-2"
                >
                  v{totalEdits - index}: {author}, {makePrettyLapse(new Date(timestamp))}
                </DropdownMenu.Item>
              ))}
              {/* <DropdownMenu.Arrow className="fill-white stroke-black" /> */}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          {!isQuestion && (
            <BestIcon
              onClick={() => !isLoading && canBest && editMutation({
                flag: post["board"],
                update: {
                  "post-id": parent?.["post-id"],
                  "best-id": post["post-id"],
                }
              })}
              className={cn(
                "w-6 h-6",
                isBest ? "fill-green" : "fill-none",
                !canBest && "text-gray-200",
                !isLoading && (canBest ? "hover:cursor-pointer" : "hover:cursor-not-allowed"),
              )}
            />
          )}
        </div>
      )}
      <div className="flex flex-col w-full justify-between px-1 sm:px-4 gap-y-6">
        <div className="space-y-6">
          {isQuestion && (
            <h1 className="break-all text-3xl font-semibold leading-10">
              {post.thread?.title}
            </h1>
          )}
          <MarkdownBlock
            content={getLatestEdit(editPost).content}
            archetype="body"
          />
        </div>
        {isQuestion && (
          <PostTags post={post} className="text-black" />
        )}
        <div className="flex flex-wrap justify-between items-center">
          <div
            className="flex items-center space-x-2 font-semibold"
            onClick={(e) => e.stopPropagation()}
          >
            <QuorumPostAuthor post={editPost} />
          </div>

          <div
            className="flex items-center space-x-2 text-gray-600"
            onClick={(e) => e.stopPropagation()}
          >
            {(canModify && isThread) && (
              <React.Fragment>
                <div title="Edit"
                  className="hover:cursor-pointer"
                  onClick={() => navigate(`response/${post["post-id"]}`)}
                >
                  <Pencil1Icon className="h-5 w-5" />
                </div>
                <div title="Delete"
                  className="hover:cursor-pointer"
                  onClick={() => modalNavigate(`delete/${post["post-id"]}`, {
                    state: {backgroundLocation: location}
                  })}
                >
                  <TrashIcon className="h-5 w-5" />
                </div>
              </React.Fragment>
            )}
            <div title="Copy Reference"
              className="hover:cursor-pointer"
              onClick={doCopy}
            >
              {didCopy ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <CopyIcon className="h-5 w-5" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PostTags({
  post,
  className,
}: {
  post: BoardPost;
  className?: string;
}) {
  return (
    <span className={cn(
      "flex flex-wrap items-center gap-2",
      className
    )}>
      {(post.thread?.tags || []).sort().map(tag => (
        <AnchorLink
          key={`${tag}`}
          to={`search/${encodeQuery(`tag:${tag}`)}`}
          className={cn(
            "inline-block cursor-pointer rounded px-1.5 bg-blue-soft",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          #{tag}
        </AnchorLink>
      ))}
    </span>
  );
}

function getPostLink(post: BoardPost): string {
  return `${
    CHANNEL_PATH
      .replace(':ship/:name', post.group)
      .replace(':chShip/:chName', post.board)
  }/thread/${
    post["parent-id"] === 0
      ? post["post-id"]
      : `${post["parent-id"]}#post-${post["post-id"]}`
  }`;
}
