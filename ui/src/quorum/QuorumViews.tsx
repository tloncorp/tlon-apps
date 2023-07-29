import React, { useEffect, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import _ from 'lodash';
import cn from 'classnames';
import { format } from 'date-fns';
import {
  CheckIcon,
  ChatBubbleIcon,
  ThickArrowUpIcon,
  ClockIcon,
  PlayIcon,
  Cross2Icon,
  ChevronRightIcon,
  ChevronLeftIcon,
  DoubleArrowRightIcon,
  DoubleArrowLeftIcon,
} from '@radix-ui/react-icons';
import { QuorumBoardTile } from '@/quorum/QuorumBoardTile';
import { QuorumPostCard, QuorumPostStrand } from '@/quorum/QuorumPost';
import { GenericLink, AnchorLink } from '@/components/Links';
import { GenericButton, AnchorButton } from '@/quorum/QuorumButtons';
import {
  BoardGridPlaceholder,
  PostWallPlaceholder,
  PostThreadPlaceholder,
} from '@/quorum/QuorumPlaceholders';
import {
  useGroupFlag,
  useVessel,
  useGroup,
  useGroups,
  useChannel,
} from '@/state/groups';
import {
  useBoardFlag,
  useBoardMetas,
  useBoardMeta,
  usePage,
  useThread,
  useQuorumBriefs,
  useRemarkMutation,
} from '@/state/quorum';
import { calcScore, getOriginalEdit, getLatestEdit } from '@/logic/quorum-utils';
import { canWriteChannel } from '@/logic/utils';
import { BoardMeta, BoardPage, BoardPost, BoardThread } from '@/types/quorum';
import { ClassProps } from '@/types/quorum-ui';


export function BoardGrid({className}: ClassProps) {
  const groups = useGroups();
  const boards = useBoardMetas();
  const briefs = useQuorumBriefs();

  const boardMetas: BoardMeta[] =
    (groups === undefined || boards === undefined || briefs === undefined)
      ? []
      : boards;

  return (
    <div className={cn(
      "grid w-full h-fit grid-cols-2 gap-4 px-4",
      "justify-center sm:grid-cols-[repeat(auto-fit,minmax(auto,250px))]",
      className,
    )}>
      {boards === undefined ? (
        <BoardGridPlaceholder count={24} />
      ) : (
        <React.Fragment>
          {boardMetas.map((board: BoardMeta) => (
            <div
              key={`${board.group}/${board.board}`}
              className={"relative aspect-w-1 aspect-h-1"}
            >
              <QuorumBoardTile
                board={board}
                group={groups?.[board.group]}
                brief={briefs?.[board.board]}
              />
            </div>
          ))}
        </React.Fragment>
      )}
    </div>
  );
}

export function PostWall({className}: ClassProps) {
  const params = useParams();
  const boardFlag = useBoardFlag();
  const {mutate: remarkMutation, status: remarkStatus} = useRemarkMutation();

  const currPage: number = params?.page ? Number(params?.page) : 1;
  const pagePath: string = ["page"].filter(s => s in params).fill("../").join("");
  const page: BoardPage | undefined = usePage(boardFlag, currPage - 1, params?.query);
  const pagePosts = page?.posts || [];

  const minPage: number = 1;
  const maxPage: number = page?.pages || 1;
  // FIXME: Anything over 2 is messed up on mobile, and 2 is a bit suspect
  const maxPageTabs: number = 2;

  useEffect(() => {
    if (!(params?.query) && currPage === 1) {
      remarkMutation({
        update: {
          flag: boardFlag,
          diff: {"read": null},
        },
      });
    }
  }, [params, boardFlag, currPage, page, remarkMutation]);

  return (
    <div className={className}>
      <div className="mx-auto flex h-full w-full flex-col">
        {page === undefined ? (
          <PostWallPlaceholder count={4} />
        ) : (
          <React.Fragment>
            {pagePosts.map(post => (
              <QuorumPostCard
                key={`${post['board']}/${post['post-id']}`}
                post={post}
              />
            ))}

            {/* FIXME: Padding top is a hack here; want same spacing as top nav
                to first card at the bottom */}
            {/* Pagination Bar */}
            {maxPage > 1 && (
              <div className="flex flex-row w-full justify-between items-center px-2 pt-6">
                <div className="flex flex-row gap-2">
                  <GenericButton to={`${pagePath}${minPage}`} relative="path"
                    title="First Page"
                    disabled={currPage <= minPage}
                  >
                    <DoubleArrowLeftIcon />
                  </GenericButton>
                  <GenericButton to={`${pagePath}${currPage - 1}`} relative="path"
                    title="Previous Page"
                    disabled={currPage <= minPage}
                  >
                    <ChevronLeftIcon />
                  </GenericButton>
                </div>
                <div className="flex flex-row justify-center gap-6 overflow-hidden">
                  {_.range(-maxPageTabs, maxPageTabs + 1).map(i => (
                    <Link key={i}
                      to={`${pagePath}${currPage + i}`} relative="path"
                      className={cn(
                        (i === 0) ? "font-semibold text-black" : "text-gray-400",
                        (currPage + i < minPage || currPage + i > maxPage) && "invisible",
                      )}
                    >
                      {String(Math.max(0, currPage + i))/*.padStart(maxPageDigits, '0')*/}
                    </Link>
                  ))}
                </div>
                <div className="flex flex-row gap-2">
                  <GenericButton to={`${pagePath}${currPage + 1}`} relative="path"
                    title="Next Page"
                    disabled={currPage >= maxPage}
                  >
                    <ChevronRightIcon />
                  </GenericButton>
                  <GenericButton to={`${pagePath}${maxPage}`} relative="path"
                    title="Last Page"
                    disabled={currPage >= maxPage}
                  >
                    <DoubleArrowRightIcon />
                  </GenericButton>
                </div>
              </div>
            )}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

export function PostThread({className}: ClassProps) {
  const params = useParams();
  const location = useLocation();
  const boardFlag = useBoardFlag();
  const thread: BoardThread | undefined = useThread(boardFlag, Number(params?.thread || 0));

  const groupFlag = useGroupFlag();
  const group = useGroup(groupFlag, true);
  const channel = useChannel(groupFlag, `quorum/${boardFlag}`);
  const vessel = group?.fleet?.[window.our] || {sects: [], joined: 0};
  const board = useBoardMeta(boardFlag);
  const canWrite = canWriteChannel({writers: board?.writers || []}, vessel, group?.bloc);
  // const canRead = channel ? canReadChannel(channel, vessel, group?.bloc) : false;

  const isBestTid = (p: BoardPost): number =>
    +(p["post-id"] === thread?.thread.thread?.["best-id"]);
  const ourResponse =
    (thread?.posts || []).find(p => getOriginalEdit(p).author === window.our);

  // FIXME: Slightly hacky way to enable scrolling to a post when opening
  // up a `PostThread` URL with a hash (e.g. ...#post-10), but it works!
  // Breaks manual entry of a different hash (e.g. on page with #post-X,
  // then manually enter #post-Y), but that's an acceptable price to pay.
  const didScroll = useRef<boolean>(false);
  useEffect(() => {
    const postId = location.hash.replace(/^#/, "");
    if (!didScroll.current && postId !== "") {
      const postDiv = document.getElementById(postId);
      if (postDiv) {
        postDiv.scrollIntoView();
        didScroll.current = true;
      }
    }
  }, [thread]);

  return (
    <div className={className}>
      <React.Fragment>
        {thread === undefined ? (
          <PostThreadPlaceholder count={2} />
        ) : (
          <React.Fragment>
            <AnchorLink to="." className="icon-button absolute top-6 right-6 sm:right-8">
              <Cross2Icon className="h-4 w-4" />
            </AnchorLink>
            <QuorumPostStrand
              post={thread?.thread}
              parent={thread?.thread}
              editable={canWrite}
            />
            {(thread?.posts || [])
              .sort((a, b) => (
                isBestTid(b) - isBestTid(a)
                || calcScore(b) - calcScore(a)
                || getLatestEdit(b).timestamp - getLatestEdit(a).timestamp
              )).map(post => (
                <QuorumPostStrand key={post['post-id']}
                  post={post}
                  parent={thread?.thread}
                  editable={canWrite}
                />
              ))
            }
          </React.Fragment>
        )}

        <footer className="mt-4 flex items-center justify-between space-x-2">
          <div className="ml-auto flex items-center space-x-2">
            <AnchorLink to="." className="secondary-button ml-auto">
              Back
            </AnchorLink>
            <GenericButton to="response"
              disabled={
                (thread === undefined)
                || (ourResponse !== undefined)
                || !canWrite
              }
            >
              Answer
            </GenericButton>
          </div>
        </footer>
      </React.Fragment>
    </div>
  );
}
