import React from 'react';
import cn from 'classnames';
import { useCopy } from '@/logic/utils';
import { BoardPost } from '@/types/quorum';
import { useLocation } from 'react-router';
import { useModalNavigate, useAnchorLink } from '@/logic/routing';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';

interface QuorumPostAuthorProps {
  post: BoardPost;
  className?: string;
}
export default function QuorumPostAuthor({
  post,
  className,
}: QuorumPostAuthorProps) {
  const location = useLocation();
  const modalNavigate = useModalNavigate();
  const anchorLink = useAnchorLink();

  const shipsOldToNew: string[] = [...new Set(post.history.slice().reverse().map(
    ({author}) => author
  ))];
  const shipsNewToOld: string[] = shipsOldToNew.slice().reverse();

  const { didCopy, doCopy } = useCopy(shipsOldToNew.join(" "));

  const handleProfileClick = () => {
    modalNavigate(
      `${anchorLink}/profile/${shipsOldToNew[0]}`,
      {state: {backgroundLocation: location}}
    );
  };

  return (
    <div
      className={cn(
        'align-center group flex items-center py-1 space-x-2',
        className
      )}
    >
      <div onClick={handleProfileClick} className="shrink-0">
        <div className="group whitespace-nowrap rounded text-sm font-semibold text-gray-800">
          <div className="flex items-center">
            <div className="mr-2 flex flex-row-reverse">
              {shipsNewToOld.map((ship, i) => (
                <div
                  key={ship}
                  className={cn(
                    'reply-avatar relative h-6 w-6 rounded group-one-focus-within:outline-gray-50 group-one-hover:outline-gray-50',
                    i !== 0 && '-mr-3'
                  )}
                >
                  <Avatar ship={ship} size="xs" className="cursor-pointer" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div
        onClick={doCopy}
        className="text-md shrink cursor-pointer font-semibold"
      >
        {didCopy ? (
          'Copied!'
        ) : (
          <div className="flex flex-row space-x-2">
            {shipsOldToNew.map((ship, i) => (
              <ShipName
                key={ship}
                name={ship}
                showAlias
                className={cn(
                  "text-md leading-6 line-clamp-1",
                  i === 0
                    ? "font-semibold"
                    : "font-normal text-gray-600"
                )}
              />
            ))
            }
          </div>
        )}
      </div>
    </div>
  );
}
