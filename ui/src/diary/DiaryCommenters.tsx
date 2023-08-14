import React from 'react';
import Avatar from '@/components/Avatar';
import IconButton from '@/components/IconButton';
import Bubble16Icon from '@/components/icons/Bubble16Icon';
import BubbleIcon from '@/components/icons/BubbleIcon';
import { pluralize } from '@/logic/utils';

interface DiaryCommentersProps {
  quipCount: number;
  commenters: string[];
  fullSize?: boolean;
  gridItemHasImage?: boolean;
}

export default function DiaryCommenters({
  quipCount,
  commenters,
  fullSize = true,
  gridItemHasImage = false,
}: DiaryCommentersProps) {
  const noComments = () => {
    if (fullSize) {
      return (
        <>
          <Bubble16Icon className="mr-2 h-4 w-4" />
          <span>No comments</span>
        </>
      );
    }
    return (
      <IconButton
        label="comments"
        icon={<BubbleIcon className={`h-5 w-5 text-white`} />}
      />
    );
  };

  return (
    <div
      className={`relative flex items-center text-gray-600 ${
        !fullSize && commenters.length > 0 && 'rounded-lg bg-white p-1.5'
      }`}
    >
      {commenters.length > 0 ? (
        <>
          {commenters.map((ship, index) => (
            <Avatar
              key={ship}
              ship={ship}
              size="xs"
              className="relative outline outline-2 outline-white"
              style={{
                zIndex: 2 - index,
                transform: `translate(${index * -50}%)`,
              }}
            />
          ))}
          <span className="ml-2">
            {quipCount} {fullSize && pluralize('comment', quipCount)}
          </span>
        </>
      ) : (
        noComments()
      )}
    </div>
  );
}
